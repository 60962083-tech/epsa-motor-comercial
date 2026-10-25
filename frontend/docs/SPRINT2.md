# Sprint 2 en el panel · pantallas, reglas y guion de prueba

Todas las historias del Sprint 2 trabajan con la base central (API + Supabase). Nada de lo que se ve en estas pantallas sale del navegador: si se borra el historial o se entra desde otra computadora, los datos siguen ahí.

**Comportamiento común de las pantallas conectadas**

- Se actualizan solas cada 30 segundos y al volver a la pestaña. Muestran «Actualizado hace…, a las HH:MM» y el botón **Actualizar**.
- Si la conexión falla, se conserva lo que se estaba viendo y aparece el aviso «No se pudo actualizar: lo que ves puede estar desactualizado». No se promete tiempo real.
- Al registrar algo, la ventana envía lo que la persona vio (ubicación, versión o responsable). Si otra sesión lo cambió antes, el servidor responde con un conflicto, la ventana muestra el dato vigente y no se sobrescribe nada.
- Si la red se cae al guardar, se puede volver a intentar: la operación usa la misma clave de reintento y no se registra dos veces.
- Ocultar botones no es la protección: la API vuelve a validar el rol, los datos y el estado en cada operación.
- Si el servidor publicado todavía no tiene una ruta del Sprint 2 (por ejemplo, sigue la API del Sprint 1), la vista muestra «Esta sección todavía no está disponible» y lo demás del panel sigue funcionando. La ruta que falta no se muestra a las personas: queda en la consola del navegador y en el atributo `data-sin-api`, para el equipo técnico. Lo que la API envía como 404 en JSON («no se encontró») se muestra como un error normal.
- Los textos del panel no usan palabras técnicas (API, servidor, base de datos, códigos de HU).

Cuentas para probar: gerente (Harold), administradora (Jazmín o Adrián) y vendedor (Didier o Michelle). Conviene usar dos navegadores o dos computadoras a la vez.

---

## HU-001 · Consultar disponibilidad compartida

**Dónde:** Motos → Disponibilidad (los tres roles), Motos → Inventario y la ficha de cada moto (gestión).

- Unidades identificadas con su ubicación, modelo, color, techo, preparación y situación comercial, mostradas por separado.
- Filtros: ubicación y modelo (en el servidor); preparación, situación comercial, techo, color y búsqueda por motor, chasis o N° (en pantalla). Los filtros se conservan al actualizarse la lista.
- Vistas por modelo, por ubicación y lista.
- Las compras sin identificar aparecen en un bloque aparte («motos compradas sin identificar») y no se suman a las unidades.
- El vendedor no ve clientes, costos, facturas, pedidos ni botones de boletas. La API tampoco se los entrega.

**Guion de prueba**

1. Vendedor: abrir Disponibilidad, filtrar por «Crossland Ancón» y un modelo. Solo aparecen esas motos, con color, techo y preparación.
2. Buscar un motor que no existe: aparece «No hay unidades que coincidan con estos filtros» y no se muestra stock ficticio.
3. Con la pantalla del vendedor abierta, el gerente registra un traslado en otra computadora. En menos de 35 segundos la lista del vendedor cambia sola y conserva el filtro.
4. Desconectar la red del vendedor y pulsar Actualizar: aparece el aviso de datos desactualizados y la lista sigue visible. Al volver la red, el aviso desaparece.
5. Cerrar sesión, borrar los datos del navegador y volver a entrar: el inventario sigue completo.
6. Pedir a la API, con la sesión del vendedor, `/api/documentos-compra` o `/api/compras-pendientes`: responde 403.

## HU-003 · Registrar movimientos de ubicación

**Dónde:** Motos → Movimientos (pestañas En tránsito, En almacén, Sin ubicación e Historial), Inventario y ficha de la moto. Solo gerente y administradora registran; el vendedor consulta. Sigue el diseño del backend de Michelle (rama `feature/HU-003-movimientos-ubicacion`).

- **Registrar traslado:** la moto sale desde su ubicación confirmada hacia un destino activo y queda «en tránsito». Si ya llegó, se registran la salida y la llegada en el mismo paso. No hay traslados programados ni cancelaciones.
- **Confirmar llegada:** la moto pasa a figurar en el destino y queda registrado quién la recibió y cuándo.
- Cada movimiento guarda origen, destino, autor de la salida, autor de la recepción, fecha, hora y observación. Trasladar no cambia la situación comercial.
- Una moto sin ubicación confirmada no se puede trasladar: primero se registra dónde está (ubicación inicial, si la API la ofrece).
- Si otra sesión movió la moto antes, el servidor responde con conflicto y la ventana muestra la ubicación vigente sin guardar nada.

**Guion de prueba**

1. Ficha de una moto con ubicación confirmada → Registrar traslado a Puente Piedra con «Ya llegó al destino» y una observación. El historial muestra origen, destino, salida y llegada con su autor.
2. Moto en Ancón → traslado a FIVESA «Sale ahora». Sigue figurando en Ancón y en tránsito; Confirmar llegada la pasa a FIVESA.
3. Abrir la misma moto en dos sesiones, registrar un traslado en la primera y luego en la segunda: la segunda muestra el conflicto y la ubicación vigente.
4. Destino inactivo (por ejemplo Comas) o vendedor por la API: se rechaza sin cambiar nada.

## HU-033 · Actualizar la preparación de una unidad

**Dónde:** Motos → Preparación (pestañas Armado, Techo, Por confirmar, Listas y Todas) y la ficha de la moto.

- Tres etapas: armado (se termina en Ventanilla), techo (la configuración es de HU-004 y aquí se registra su instalación) y condición de entrega.
- El techo deportivo (FIVESA, JAVICAR o FIBRAT) admite registrar el aviso del proveedor y el detalle de accesorios solo si existen. El aviso no cambia la ubicación.
- «Lista para entrega» solo se marca si se cumplen las etapas; si falta algo, la ventana dice qué falta. Lista para entrega no significa entregada.
- Volver una etapa atrás exige explicar el motivo. Todo queda en el historial con autor y fecha.

**Guion de prueba**

1. Moto importada: aparece pendiente de armado y con techo por definir.
2. Intentar «Marcar lista para entrega»: la ventana muestra lo pendiente y no deja registrar.
3. Marcar armado terminado. En la ficha, elegir techo de fibra deportiva con FIVESA. Registrar avance «Instalado» como aviso de FIVESA con accesorio «Cámara de retroceso».
4. Marcar lista para entrega: aparece en la pestaña Listas y en Disponibilidad como «Lista para entrega»; sigue libre para vender.

## HU-030 · Facturas recibidas por correo

**Dónde:** Compras → Facturas recibidas (gerente y administradora). Pestañas Documentos, Equivalencias de modelos y Ajustes del proceso.

- **Ajustes (solo gerente):** fecha de inicio, remitentes autorizados (uno por línea, por ejemplo `@crosland.com.pe`), ubicación inicial de las motos importadas y la credencial del proceso automático. La credencial se muestra una sola vez; se puede revocar o generar otra.
- **Documentos:** cada factura con su estado (Importado, Pendiente de revisión, Error, Descartado, Resuelto manualmente), fecha de recepción, fecha de emisión, vehículos registrados y motivo. El detalle muestra líneas del XML, motos registradas, compra vinculada, historial y el PDF/XML originales.
- **Equivalencias:** el código de material de Crosland se relaciona con un modelo del sistema. Nunca se adivina por el nombre ni se crea un modelo.
- **Resolver incidencia:** vincular a una compra manual previa, registrar como compra nueva, resolver a mano con HU-002 o descartar, siempre con motivo.

**Guion de prueba**

1. Gerente: Ajustes → fecha de inicio, remitente `@crosland.com.pe`, ubicación «Crossland Ancón» → Guardar. Generar credencial y entregarla a quien configura la lectura automática del correo (parte del backend: un script de Google en la cuenta de Gmail con la dirección de la API y esa credencial).
2. Llega la factura F067-00015880 con un código nuevo: queda «Pendiente de revisión» y no crea motos.
3. Confirmar la equivalencia B3-4TLPG250UG4V → Torito 250 4V GLP. Marcar los aceites como «No es vehículo». Reintentar: queda «Importado» con 2 motos en Ancón, pendientes de armado.
4. Reenviar el mismo correo: no se duplica nada y el intento queda en el historial.
5. El vendedor, en otra computadora, ve las 2 motos en Disponibilidad sin hacer nada más.

## HU-023 · Compras pendientes

**Dónde:** Compras a proveedor → pestaña Pendientes (gerente y administradora).

- Compras manuales sin factura, compras con factura pero sin identificar, compras identificadas con motos que aún no llegan a EPSA, y documentos de HU-030 con incidencia que no tienen compra.
- Cantidades comprada, identificada y pendiente por separado. Filtros por situación y por origen (manual o importada).
- Un documento sin compra lleva al registro documental, no a una compra inventada.

**Guion de prueba**

1. Registrar una compra manual con N° de pedido de Asiri. Cuando llega la factura con ese pedido y la misma cantidad, la compra se completa sin crear otra.
2. Si la factura no trae un pedido que coincida y hay compras manuales parecidas, queda «Pendiente de revisión»: se resuelve eligiendo la compra correcta.
3. Filtrar por «Factura importada»: solo quedan las compras automáticas.

## HU-015 · Asignar o transferir un interesado

**Dónde:** Ventas → Leads. Gerente y administradora asignan y transfieren; el vendedor ve solo los suyos.

- Asignar a un interesado sin responsable; transferir exige un motivo breve. Se elige entre usuarios comerciales activos.
- No cambia la etapa, el canal, el número de WhatsApp que recibió la consulta ni los seguimientos. No envía mensajes.
- Historial de asignaciones con responsable anterior, nuevo, autor, fecha y motivo.

**Guion de prueba**

1. Administradora: asignar un lead sin responsable a Didier. Didier, en su computadora, lo ve en su lista; Michelle no.
2. Transferir a Michelle con motivo «vacaciones». El historial muestra las dos operaciones.
3. Con el lead abierto en dos sesiones, transferir en una y luego en la otra: la segunda muestra el responsable vigente y no sobrescribe.
4. Un vendedor que intenta asignarse un lead por la API recibe 403.

## HU-036 · Fotos de modelos en el almacenamiento central

**Dónde:** Web y catálogo → Modelos → botón Fotos (gerente y administradora).

- Subir una foto (JPG, PNG o WebP, hasta 6 MB) la guarda en el bucket `modelos` de Supabase (`<codmod>/<uuid>.<ext>`, con la sesión de quien sube) y registra su dirección en el modelo con las rutas de HU-012. Si el registro falla, se borra solo el archivo nuevo; la foto anterior no se toca. También se puede registrar una dirección HTTPS existente.
- Ordenar, hacer principal, reemplazar, desactivar y activar. Un modelo publicado no puede quedarse sin fotos activas.
- La web pública y la ficha usan esas fotos desde cualquier equipo.

**Guion de prueba**

1. Subir un archivo dañado o de más de 6 MB: se rechaza y la galería no cambia.
2. Subir una foto válida y hacerla principal. En otro navegador, sin sesión, el catálogo y la ficha muestran esa foto.
3. Intentar desactivar la última foto activa de un modelo publicado: no se permite.

## EMT-97 · Contacto en ubicaciones

**Dónde:** Configuración → Ubicaciones (gerente y administradora editan; el vendedor no entra).

- Número de contacto opcional, guardado tal como se escribe (con +, ceros, espacios, guiones o paréntesis). Entre 6 y 15 dígitos y hasta 30 caracteres.
- Vacío se guarda como vacío y se muestra «Sin número», nunca como 0.

**Guion de prueba**

1. Escribir letras: el formulario lo rechaza. Escribir `+51 (01) 555-0099`: se guarda igual.
2. En otra sesión, la administradora ve el mismo número.
3. Vaciar el campo: vuelve a «Sin número».
