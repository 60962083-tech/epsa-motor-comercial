# Integración frontend ↔ backend (EPSA Motor, Grupo 7)

Documento para el equipo: qué servicios del backend ya consume el frontend y cuáles faltan publicar. Los contratos sugeridos respetan las tablas del esquema de Supabase (`tests/fixtures/esquema-base.sql`) y el formato de respuesta del proyecto: `{ ok, data, message }`.

## 1. Ya conectado (frontend listo y backend publicado en el repositorio)

| HU | Pantalla | Servicio |
|---|---|---|
| HU-007 | Login del panel `/admin` | Supabase Auth (`/auth/v1/token`) + RPC `hu007_usuario_actual()`; token Bearer y renovación automática con `refresh_token` |
| HU-012 | Catálogo `/modelos` | `GET /api/modelos` (sin token, sin parámetros) |
| HU-009 | Ficha `/modelos/:id` | `GET /api/modelos/:id` (sin token); 404 → «Producto no disponible» |
| HU-026 | Panel → Ubicaciones | `GET /api/ubicaciones`, `POST`, `PUT /:id`, `PATCH /:id/estado` (baja lógica) |
| HU-034 | Panel → Compras a proveedor | `GET /api/compras?limite&offset`, `GET /:id`, `POST` con `Idempotency-Key` (UUID por intención; se reutiliza al reintentar) |
| HU-002 | Panel → Compras → detalle | `PUT /api/compras/:id/factura`, `GET` y `POST /api/compras/:id/unidades` (lotes de 1 a 100, conflicto 409 con `conflicto.campo` y `conflicto.unidad`) |
| HU-002 | PDF de la factura | `POST /api/compras/:id/factura/archivo` (multipart, campo `archivo`), `GET …/archivo` (`archivo_adjuntado`), `GET …/archivo/url` (enlace firmado de 60 s) |
| HU-004 | Panel → Inventario → Ficha y techo | `GET /api/unidades/catalogos/tipos-techo`, `GET …/proveedores-techo`, `GET` y `PUT /api/unidades/:id/techo` (`{ codtte, codpro, detalle }`) |

### Requisitos para que funcione en Netlify

1. API publicada en Render: `https://epsa-motor-api.onrender.com`. Netlify no puede llamar a `localhost:3000` (el frontend ignora esa dirección).
2. Habilitar CORS para el dominio de Netlify (hoy `app.use(cors())` ya acepta cualquier origen).
3. Cargar en Netlify `SUPABASE_ANON_KEY` (la misma de la API) y volver a desplegar. La API (`https://epsa-motor-api.onrender.com`) y la URL de Supabase ya vienen puestas en `vite.config.js`; si Netlify tiene `VITE_API_URL`, debe ser esa misma dirección.
4. Crear las cuentas del equipo con `docs/supabase-usuarios-equipo.sql` y el bucket de facturas con `docs/supabase-storage-facturas.sql`.
5. Probar el login con un correo del equipo: el panel pide cambiar la contraseña temporal y entra con el rol de la tabla `usuario`.

## 2. Frontend listo, falta el endpoint (hoy guarda en el navegador)

### 2.1 Sedes públicas (HU-010)

`GET /api/sedes` sin token: ubicaciones `tipubi = 'Sede'` y `estubi = true`, unidas a `sede` activa.

```json
{ "ok": true, "data": [ { "codubi": "1", "nomubi": "Comas", "dirubi": "Av. 22 de Agosto 852, Comas, Lima", "telsed": "907721481", "horsed": "Lunes a Sábado de 9:00 AM a 5:00 PM" } ] }
```

Además, que `POST/PUT /api/ubicaciones` acepte `telsed` y `horsed` opcionales cuando `tipubi = 'Sede'`.

### 2.2 Leads desde la web y manuales (HU-013 / HU-014)

`POST /api/leads` sin token (formulario «Cotizar» de la web):

```json
{ "nomlea": "Juan Pérez", "tellea": "987654321", "codmod": "2", "orilea": "Web", "canlea": "Formulario web", "obslea": "Techo: Básico · Pago: Financiamiento · Sede: Comas · Color: Rojo" }
```

- Regla HU-014 (CP-014-03): si existe un lead abierto con el mismo `tellea`, aunque sea por otro modelo, responder 200 con ese lead y una nota, no crear otro.
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

### 2.5 Unidades: recepción y traslados (HU-004)

El techo ya está conectado (sección 1). Falta:

- `GET /api/unidades?codubi&estcomuni&codmod` (hoy `GET /api/compras` solo lista las compras pendientes, así que no hay forma de leer todas las unidades).
- `POST /api/unidades/:id/recepcion` con `{ "codubi": "1" }`
- `POST /api/unidades/:id/traslados` con `{ "codubides": "2", "obsmub": "…" }`: inserta en `movimientoubicacion`.
- `PATCH /api/unidades/:id/disponibilidad` con `{ "estcomuni": "Disponible" }`, para liberar la unidad para la venta.

### 2.6 Ventas y separaciones (complemento)

- `POST /api/clientes`: `codtdo`, `numdoccli`, `nomcli`, `telcli`…
- `POST /api/separaciones`: `{ coduni, codcli, metpagsep, monadesep, refsep }`. `monadesep` debe ser mayor a 0, como exige la tabla.
- `POST /api/ventas`: `{ coduni, codcli, modcomven }`. Al entregar, la unidad pasa a «Vendida».

### 2.7 Archivo de la factura (HU-002)

Ya conectado con los endpoints de Michelle (sección 1). El bucket privado `facturas-compra` necesita sus dos permisos para Gerente y Administradora (`docs/supabase-storage-facturas.sql`); si al subir aparece «No tienes permisos para acceder al archivo de factura», falta ejecutar ese SQL. El frontend revisa antes de subir que el archivo sea un PDF real (empieza con `%PDF`) y de hasta 10 MB.

### 2.8 Usuarios del panel (HU-007)

Hoy las cuentas se crean como indica HU-007 (SQL administrativo): `docs/supabase-usuarios-equipo.sql` vincula cada cuenta de Supabase Auth con su fila en `usuario` y su rol, y marca la contraseña como temporal (`user_metadata.clave_temporal`). En modo conectado, Equipo muestra la tabla `usuario` (solo lectura).

Mejora sugerida: `POST /api/usuarios` (solo gerente) para crear la cuenta desde el panel y `PATCH /api/usuarios/:id` para cambiar rol o estado (`estusu`). El formulario de Equipo ya tiene nombre, usuario, correo, celular, rol, sede y contraseña temporal.

### 2.9 Inventario conectado (HU-004)

El backend crea las unidades al identificarlas (HU-002) y ya guarda su techo, pero aún no expone su recepción ni su liberación. Mientras tanto, el panel pasa esas unidades a su Inventario para recibirlas y liberarlas, y la web cuenta como stock las «Disponible». Cuando exista `GET /api/unidades` (2.5), el Inventario se leerá de ahí.

## 3. Reglas del backend que el frontend ya respeta

- **Compras (HU-034):** solo se envían `codmod`, `colcom` y `cancom`, porque los campos extra dan 400. El color solo puede ser uno de los del modelo.
- **Idempotencia (HU-034):** la clave se conserva ante errores de red y se reintenta con la misma; mientras tanto el formulario queda bloqueado para no reenviar datos distintos. Tras una respuesta definitiva se genera una clave nueva.
- **Factura (HU-002):** se envían emisor (hasta 160 caracteres), número tal como figura en el documento (hasta 80, sin formato impuesto), fecha `YYYY-MM-DD` (hora local, no futura) y cantidad entera.
- **Discrepancia de factura (HU-002):** si la cantidad difiere de la compra, se registra con aviso de revisión y la identificación queda bloqueada.
- **Series (HU-002):** motor y chasis van en mayúsculas, con espacios agrupados y hasta 100 caracteres. Se detectan duplicados dentro del lote.
- **Unidades identificadas (HU-002):** nacen «No disponible» y sin ubicación. No se crean unidades fuera de una compra.
- **Ubicaciones (HU-026):** sin DELETE en el backend. Se desactivan, y no se pueden desactivar si tienen unidades.
- **Permisos (HU-007):** el rol sale de la base de datos, no del frontend. La interfaz oculta lo que el rol no puede hacer y el backend lo vuelve a validar. Gerente y Administradora gestionan ubicaciones, igual que `exigirGestion`.
- **Modelos (HU-012):** la web solo muestra los modelos que devuelve `GET /api/modelos`; se emparejan solo por nombre porque los códigos de Supabase son distintos (en Supabase el código 1 es «Modelo prueba 1», no el «Torito 4V GSL»). Un modelo publicado en Supabase sin ficha en el panel también sale en la web, con los datos de Supabase y precio «A consultar»; se puede cotizar y comprar, pero el pedido de venta pide crearle ficha con precio en Modelos. El formulario de compras usa siempre el `codmod` de Supabase.
- **Errores:** los mensajes del backend se muestran tal cual (por ejemplo PT409 «Resolver unidades o traslados activos antes de desactivar»).
- **Pruebas:** el frontend se probó contra la API real de este repositorio (Express) conectada a un PostgreSQL con el esquema base y las migraciones HU-026, HU-034, HU-002, HU-007, HU-012, HU-004 y HU-009; solo Auth, PostgREST y Storage se emularon. Pasaron login con las cuentas demo, rol, catálogo publicado, modelo nuevo publicado desde Supabase, ficha despublicada, ubicaciones (incluido PT409), compras con idempotencia, factura con PDF (subir, ver, descargar, rechazar archivos falsos), identificación, conflicto 409 y techo de la unidad.
- **Catálogo en Supabase:** `docs/supabase-modelos-catalogo.sql` carga los 9 modelos de la web (publicados, con su foto) si aún no existen. El panel (Modelos) avisa qué modelos no coinciden entre Supabase y la web.
