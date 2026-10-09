# Integración frontend ↔ backend (EPSA Motor, Grupo 7)

Documento para el equipo: qué servicios del backend ya consume el frontend y cuáles faltan publicar. Los contratos sugeridos respetan las tablas del esquema de Supabase (`tests/fixtures/esquema-base.sql`) y el formato de respuesta del proyecto: `{ ok, data, message }`.

## 1. Ya conectado (frontend listo y backend publicado en el repositorio)

| HU | Pantalla | Servicio |
|---|---|---|
| HU-007 | Login del panel `/admin` | Supabase Auth (`/auth/v1/token`) + RPC `hu007_usuario_actual()`; token Bearer y renovación automática con `refresh_token` |
| HU-012 | Catálogo `/modelos` y ficha `/modelos/:id` | `GET /api/modelos` (sin token, sin parámetros) |
| HU-026 | Panel → Ubicaciones | `GET /api/ubicaciones`, `POST`, `PUT /:id`, `PATCH /:id/estado` (baja lógica) |
| HU-034 | Panel → Compras a proveedor | `GET /api/compras?limite&offset`, `GET /:id`, `POST` con `Idempotency-Key` (UUID por intención; se reutiliza al reintentar) |
| HU-002 | Panel → Compras → detalle | `PUT /api/compras/:id/factura`, `GET` y `POST /api/compras/:id/unidades` (lotes de 1 a 100, conflicto 409 con `conflicto.campo` y `conflicto.unidad`) |

### Requisitos para que funcione en Netlify

1. Publicar la API en un servidor accesible por HTTPS (Render, Railway u otro). Netlify no puede llamar a `localhost:3000`.
2. Habilitar CORS para el dominio de Netlify (hoy `app.use(cors())` ya acepta cualquier origen).
3. Cargar en Netlify `VITE_API_URL`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, y volver a desplegar.
4. Probar desde Panel → Administración → Integración backend.

## 2. Frontend listo, falta el endpoint (hoy guarda en el navegador)

### 2.1 Sedes públicas (HU-010)

`GET /api/sedes` sin token: ubicaciones `tipubi = 'Sede'` y `estubi = true`, unidas a `sede` activa.

```json
{ "ok": true, "data": [ { "codubi": "1", "nomubi": "Comas", "dirubi": "Av. 22 de Agosto 852, Comas, Lima", "telsed": "51907721481", "horsed": "Lunes a Sábado de 9:00 AM a 5:00 PM" } ] }
```

Además, que `POST/PUT /api/ubicaciones` acepte `telsed` y `horsed` opcionales cuando `tipubi = 'Sede'`.

### 2.2 Leads desde la web y manuales (HU-013 / HU-014)

`POST /api/leads` sin token (formulario «Cotizar» de la web):

```json
{ "nomlea": "Juan Pérez", "tellea": "987654321", "codmod": "2", "orilea": "Web", "canlea": "Formulario web", "obslea": "Techo: Básico · Pago: Financiamiento · Sede: Comas · Color: Rojo" }
```

- Regla HU-014: si existe un lead abierto con el mismo `tellea` y `codmod`, responder 200 con ese lead y una nota, no crear otro.
- El backend asigna `codusu` por turnos. El frontend ya lo hace en modo demostración: vendedor activo de la sede con menos leads.
- Con token: `GET /api/leads?estado&canal&codusu`, `POST /api/leads` (manual), `PATCH /api/leads/:id` (`estlea`, `codusu`, `obslea`).

### 2.3 Seguimiento (tabla `seguimientolead`)

- `GET /api/leads/:id/seguimientos`
- `POST /api/leads/:id/seguimientos` con `{ "tipsle": "Llamada", "dessle": "Primer contacto", "fecprosle": "2026-10-08" }`
- `PATCH /api/seguimientos/:id` con `{ "dessle": "Resultado…" }`

Cada cotización web debe crear automáticamente el primer seguimiento para hoy. El frontend ya lo hace.

### 2.4 Administrar modelos (HU-012, escritura)

- `GET /api/admin/modelos`: todos los estados (Borrador, Publicado, No publicado). Gerente y Administradora.
- `POST /api/modelos` con `{ codtmo, nommod, marmod, desmod, carmod }`; nace en `Borrador`.
- `PUT /api/modelos/:id`
- `PATCH /api/modelos/:id/estado` con `{ "estmod": "Publicado" | "No publicado" }`
- `POST /api/modelos/:id/imagenes` con `{ urlimo, ordimo }`

Datos que la web muestra y que el esquema aún no tiene: **precio «desde»**, **colores**, **foto por color** y **ficha técnica por pestañas** (motor, chasis, consumo, dimensiones, sistema eléctrico). Hay dos opciones:

- **Columnas nuevas:** `premod NUMERIC(10,2)`, `colmod TEXT[]`.
- **JSON en `carmod`:** guardar ahí la ficha técnica estructurada.

### 2.5 Unidades: recepción, techo y traslados (HU-004)

- `GET /api/unidades?codubi&estcomuni&codmod`
- `POST /api/unidades/:id/recepcion` con `{ "codubi": "1" }`
- `PATCH /api/unidades/:id/techo` con `{ "codtte": "3", "codpro": "1", "codepr": "2", "dettecuni": "…" }`. Si `tipotecho.reqprotte` es verdadero, exigir proveedor.
- `POST /api/unidades/:id/traslados` con `{ "codubides": "2", "obsmub": "…" }`: inserta en `movimientoubicacion`.
- `PATCH /api/unidades/:id/disponibilidad` con `{ "estcomuni": "Disponible" }`, para liberar la unidad para la venta.

### 2.6 Ventas y separaciones (complemento)

- `POST /api/clientes`: `codtdo`, `numdoccli`, `nomcli`, `telcli`…
- `POST /api/separaciones`: `{ coduni, codcli, metpagsep, monadesep, refsep }`. `monadesep` debe ser mayor a 0, como exige la tabla.
- `POST /api/ventas`: `{ coduni, codcli, modcomven }`. Al entregar, la unidad pasa a «Vendida».

### 2.7 Archivo de la factura (HU-002)

Falta definir el almacenamiento privado (bucket de Supabase Storage), la carga autenticada, el tipo y tamaño permitidos, y la descarga autorizada. Hasta entonces, el botón «Adjuntar PDF» aparece deshabilitado y la ficha de factura muestra `archivo_adjuntado: false`.

### 2.8 Usuarios del panel (HU-007)

`POST /api/usuarios` (solo gerente): crea la cuenta en Supabase Auth desde el backend y su fila en `usuario` con `codrol`. `PATCH /api/usuarios/:id` cambia rol, sede o estado (`estusu`). El frontend ya tiene el formulario en Equipo: nombre, correo, celular, rol, sede, si recibe leads y contraseña temporal.

### 2.9 Diferencia de permisos por confirmar (HU-026)

En el backend, `exigirGestion` permite a la administradora crear, editar y desactivar ubicaciones. Por pedido del equipo, en el frontend solo el gerente administra sedes y ubicaciones; la administradora las consulta. Si el Product Owner confirma esta regla, hay que ajustar los permisos de esas rutas en el backend; si no, se vuelve a habilitar en `ROLES` (`src/data/mockData.js`).

## 3. Reglas del backend que el frontend ya respeta

- **Compras (HU-034):** solo se envían `codmod`, `colcom` y `cancom`, porque los campos extra dan 400. El color se normaliza.
- **Idempotencia (HU-034):** la clave se conserva ante errores de red y se reintenta con la misma.
- **Factura (HU-002):** se envían emisor (hasta 160 caracteres), número (hasta 80), fecha `YYYY-MM-DD` y cantidad entera.
- **Discrepancia de factura (HU-002):** si la cantidad difiere de la compra, se registra con aviso de revisión y la identificación queda bloqueada.
- **Series (HU-002):** motor y chasis van en mayúsculas, con espacios agrupados y hasta 100 caracteres. Se detectan duplicados dentro del lote.
- **Unidades identificadas (HU-002):** nacen «No disponible» y sin ubicación. No se crean unidades fuera de una compra.
- **Ubicaciones (HU-026):** sin DELETE en el backend. Se desactivan, y no se pueden desactivar si tienen unidades.
- **Permisos (HU-007):** el rol sale de la base de datos, no del frontend. La interfaz oculta lo que el rol no puede hacer y el backend lo vuelve a validar.
