# HU-030 / EMT-35 — Fase 2: importación transaccional

## Alcance

La Fase 2 incorpora la persistencia transaccional de un XML UBL ya parseado y validado. El servicio interno recibe el `Buffer`, ejecuta el parser, valida identidad fiscal e importes, consulta equivalencias activas y envía un payload preparado a `public.importar_documento_compra(jsonb)`. No añade ruta HTTP, Gmail, Apps Script ni autenticación HMAC. Las migraciones 001 y 002 se conservan sin cambios.

En el alcance de Fase 2, el servicio de importación invocaba la RPC con una sesión autenticada de Gerente o Administradora; no utilizaba `service_role`. Fase 3 añadió posteriormente el wrapper técnico HMAC para Render. La RPC conserva sus validaciones de perfil, proveedor, equivalencias, seriales, pedidos y capacidad de compra.

## Actor técnico

`compra.codusu` requiere una fila de usuario y el esquema mantiene `public.usuario.uuidusu NOT NULL`. Antes de aplicar la migración, un administrador debe provisionar mediante Supabase Auth Admin API la identidad técnica `integracion.facturas@epsa.internal`. La migración solo busca esa identidad por correo en `auth.users`; no inserta, actualiza ni elimina filas de Auth. Si no existe exactamente una identidad, falla con `ACTOR_TECNICO_AUTH_NO_PROVISIONADO`. La migración vincula ese UUID con una fila `public.usuario` de nombre `Integracion Facturas` y rol activo `Administradora`, resuelto por nombre. No se fija ningún `codusu` ni `codrol`, y no se guarda contraseña ni credencial de Auth en el repositorio.

Este usuario técnico solo atribuye auditoría (`compra.codusu`, `referenciacompra.codusuaut` e intentos); no autentica ni autoriza la llamada a la RPC. Al cierre de Fase 2, `importar_documento_compra` requería una sesión `authenticated` con rol Gerente o Administradora mediante `hu026_rol_actual()`. Fase 3 incorporó después una ruta HMAC y wrappers técnicos para la invocación desde Render, sin usar una sesión humana. La `SUPABASE_SECRET_KEY` de Render es privilegiada y omite RLS; no es una credencial de mínimo privilegio.

La RPC registra compras y referencias con ese actor. Los vínculos documentales automáticos o conciliados dejan `codusucon` nulo porque no hubo una persona que confirmara manualmente la conciliación.

## Persistencia y reglas

- La identidad documental se serializa por proveedor, tipo, serie y número. El checksum idéntico permite reintentar; un checksum diferente deja el documento en `Pendiente de revision` con `DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO` y no reemplaza la cabecera existente.
- Cada línea se resuelve de nuevo contra una equivalencia activa del proveedor. Los accesorios se guardan como procesados y nunca crean compra ni unidad. Códigos desconocidos, equivalencias ambiguas y vehículos no clasificables quedan en revisión.
- Vehículos se agrupan por modelo homologado y color operativo. El color operativo usa espacios normalizados y capitalización (`NEGRO` → `Negro`); `colororiginal` conserva el valor documental.
- La ubicación inicial se resuelve en cada ejecución mediante `ALMACEN_CROSLAND_ANCON`, comprobando clave activa, ubicación activa y `tipubi='Almacen'`. Nunca se fija `codubi` en código.
- Para satisfacer el trigger de HU-002, la RPC inserta `factura_compra` antes de insertar unidades cuando falta. Si ya existe, la conserva y comprueba que `cantidad_motos` coincida con `compra.cancom`; no reemplaza sus datos. La fila canónica de HU-030 sigue siendo `documentocompra`; la fila de HU-002 es la compatibilidad requerida para sus validaciones existentes.
- HU-002 determina el estado de compra a partir de la factura y las unidades realmente identificadas: con factura y menos unidades que `cancom`, queda `Pendiente de identificación`; cuando las unidades alcanzan `cancom`, queda `Identificada`. La importación no asigna el estado a mano ni permite que un reintento de documento retroceda una compra ya identificada.
- `unidad.codpro`, techo, preparación, estado comercial, movimientos y otros datos operativos no se asignan ni se actualizan. Las unidades nuevas usan el estado predeterminado de HU-002 y no se ofrecen como listas para entrega.
- Los seriales se normalizan igual que HU-002 y se protegen con advisory locks y los índices únicos existentes. Duplicados del XML o seriales ya usados quedan en revisión; nunca se actualiza una unidad existente.
- `PedidoCrosland` conserva cada pedido individual y su vínculo a compra. La conciliación se realiza solo por pedido exacto normalizado. Más de una compra asociada o una compra incompatible produce revisión en vez de duplicar la compra. Si falta la fila de HU-002, la compra manual debe coincidir en modelo, color, capacidad disponible y cantidad del grupo para que la importación no invente la cantidad de factura requerida por ese esquema. `UNIQUE(coddoc,codcom)` se mantiene; no se cambia la política de facturación parcial.
- Un intento se crea como `Procesando` y se cierra como `Exito`, `Parcial` o `Error`. Los errores técnicos dentro de la transacción se revierten en un subbloque y se registran con un código y mensaje sanitizados cuando PostgreSQL permite continuar la transacción.

## Respuesta RPC

La RPC devuelve `coddoc`, `estadoDocumento`, `reintento`, `error`, compras, unidades con motor/chasis enmascarados, líneas en revisión, conteos y advertencias. Los estados de documento usados son `Importado`, `Importado parcialmente`, `Pendiente de revision` y `Error`. No se devuelven seriales completos.

## Límites al cierre de Fase 2

- Al cierre de Fase 2 todavía no existían el cliente Gmail/Apps Script ni la ruta HMAC. La ruta técnica y los wrappers se incorporaron en Fase 3; el cliente de Apps Script se añadió localmente en Fase 4. La RPC no es una API para `anon`.
- El servicio transforma errores de Supabase en códigos genéricos. Los detalles internos no se devuelven ni se registran.
- `factura_compra` guarda un único registro por compra (regla HU-002). Para compra manual conciliada, la importación valida una factura existente o crea la fila faltante; nunca reemplaza una factura diferente.
- Se mantiene el límite existente de cardinalidad documental: una compra aún puede tener varios documentos. No se agrega `UNIQUE(codcom)`.
- La prueba local usa fixtures sintéticos y PGlite. No se ejecuta contra Supabase remoto ni se incluye el XML real en el repositorio.
