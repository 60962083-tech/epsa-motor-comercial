# EPSA Motor — Frontend (React + Vite + Tailwind)

Frontend del Proyecto Tecnológico, Grupo 7 (ISIL 2026-2). Web pública de clientes y panel interno de gestión comercial, conectados al backend de Michelle (Express + TypeScript + Supabase).

## Cómo correrlo

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para Netlify
```

- **Web pública:** `/`, `/modelos`, `/modelos/:id`, `/nosotros`, `/sedes`.
- **Panel interno:** `/admin`. No tiene botón ni enlace en la web pública; se entra escribiendo la dirección.
- En Netlify, `public/_redirects` hace que `/admin` y las demás rutas funcionen al recargar.

## Acceso al panel

Cada integrante entra con su **correo** (o su usuario) y una **contraseña temporal**. Al primer ingreso el panel pide crear una contraseña nueva (mínimo 8 caracteres, con letras y números).

| Integrante | Rol | Correo | Usuario | Contraseña temporal |
|---|---|---|---|---|
| Harold Salazar Masgo | Gerente | 75063427@mail.isil.pe | harold | 75063427 |
| Jazmín Reinoso Rojas | Administradora | 60770861@mail.isil.pe | jazmin | 60770861 |
| Adrián Dionicio Alcarraz | Administrador | 60962083@mail.isil.pe | adrian | 60962083 |
| Didier Leguía Sandoval | Vendedor | 61055074@mail.isil.pe | didier | 61055074 |
| Michelle Fuentes Villaorduña | Vendedora | 61106576@mail.isil.pe | michelle | 61106576 |

**Cuentas de prueba del backend (las de Michelle).** Funcionan en los dos modos: conectado (las valida Supabase) y demostración (sin `.env`). La contraseña termina en coma.

| Rol | Correo | Contraseña |
|---|---|---|
| Gerente | gerente.demo@epsamotor.test | `clave1234567,` |
| Administradora | admin.demo@epsamotor.test | `clave12345678,` |
| Vendedor | vendedor.demo@epsamotor.test | `clave123456789,` |

- **Modo demostración (sin `.env`):** las cuentas están en `src/data/mockData.js` (`EQUIPO` y `CUENTAS_DEMO`). Las contraseñas no se guardan en texto: solo su resumen SHA-256 (`src/lib/clave.js`). El gerente crea más usuarios en **Equipo**.
- **Modo conectado (con Supabase):** las cuentas viven en Supabase Auth y la tabla `usuario` del backend define el rol. Para crear las del equipo, seguir `docs/supabase-usuarios-equipo.sql` (5 cuentas en *Authentication → Users* y luego ese SQL).

## Publicar en Netlify

- **Con GitHub:** basta con subir el código; `netlify.toml` construye con `npm run build` y publica `dist`.
- **Subida manual:** ejecuta `npm run build` y arrastra la carpeta `dist` a la zona de carga de **Deploys**.

## Conexión con Supabase y el backend de Michelle

La dirección de la API ya viene puesta en el código: **https://epsa-motor-api.onrender.com** (la de Render que pasó Michelle), igual que la URL del proyecto de Supabase. Solo falta la clave pública *anon* de Supabase:

- **En tu computadora:** el frontend usa el `.env` de la raíz del repositorio (el de la API de Michelle, que ya tiene `SUPABASE_ANON_KEY`), así que no hay que copiarlo. Si prefieres uno propio, crea `frontend/.env` (ver `.env.example`); ese manda sobre el de la raíz. Ningún `.env` se sube a GitHub.
- **En Netlify:** variable `SUPABASE_ANON_KEY` en *Site configuration → Environment variables* y volver a desplegar.

Opcionales: `VITE_API_URL` o `SUPABASE_URL` para usar otras direcciones (también se aceptan `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`). Una dirección `localhost` (por ejemplo un `.env` antiguo con `http://localhost:3000`) se ignora y se usa la de Render, salvo que pongas `EPSA_API_LOCAL=1` para probar la API corriendo en tu computadora. Solo estas tres variables llegan al navegador (`vite.config.js`); `PORT` y cualquier otra se quedan fuera, y si por error se pone una clave *service_role*, no se usa. `EPSA_DEMO=1` fuerza el modo demostración. En el panel, el punto verde «Conectado a Supabase» muestra la dirección de la API al pasar el mouse.

Con la clave, la web entra en **modo conectado**:

- **Login (HU-007):** Supabase Auth (correo y contraseña) + rol con la RPC `hu007_usuario_actual()`. La contraseña temporal se cambia en Supabase Auth.
- **Catálogo (HU-012) y ficha (HU-009):** la web muestra los modelos que `GET /api/modelos` devuelve como publicados. Si el modelo tiene ficha en el panel (mismo nombre), se ve con su precio, colores y datos técnicos; si solo existe en Supabase, se ve igual con su nombre, descripción, características y foto, con precio «A consultar». La ficha confirma el modelo con `GET /api/modelos/:id`: si lo despublicaron, dice «Producto no disponible». Los no publicados («Modelo prueba 1» y «Modelo prueba 2») no salen.
- **Ubicaciones (HU-026), compras (HU-034), factura e identificación (HU-002):** se leen y escriben por la API.
- **PDF de la factura (HU-002):** se sube, consulta y abre con los endpoints de Michelle (`POST/GET /api/compras/:id/factura/archivo` y `GET …/archivo/url`). Queda en el bucket privado `facturas-compra` como `compras/{codcom}/factura.pdf`; el bucket y sus permisos están en `docs/supabase-storage-facturas.sql`.
- **Techo de cada unidad (HU-004):** tipos y proveedores salen de `GET /api/unidades/catalogos/…`; la configuración se lee y guarda con `GET/PUT /api/unidades/:id/techo` (solo unidades identificadas en Supabase).
- **Aún en el navegador (sin endpoint):** leads y cotizaciones, seguimiento, ventas y comprobantes, metas, opiniones, alta de usuarios, edición de modelos y recepción, traslado y liberación de unidades. Ver `docs/INTEGRACION-FRONTEND.md`.

Sin la clave, la web funciona en **modo demostración** con los mismos contratos, guardando los datos en el navegador.

### Probar conectado en tu computadora

1. **Frontend** (`frontend/`): `npm install` y `npm run dev`. Toma la clave del `.env` de la raíz (o de `frontend/.env`) y usa la API de Render.
2. *(Solo si quieres usar la API corriendo en tu computadora)*: en la raíz del repositorio, su `.env` lleva `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `PORT=3000`; `npm ci` y `npm run dev`. En `frontend/.env` agrega `VITE_API_URL=http://localhost:3000` y `EPSA_API_LOCAL=1`.
3. Entrar a `/admin` con una cuenta de Supabase. En **Modelos**, el panel avisa si algún modelo de la web no está publicado en Supabase o al revés.
4. Si Supabase aún no tiene los 9 modelos, `docs/supabase-modelos-catalogo.sql` los carga con el mismo nombre, descripción y foto (no duplica ni cambia los existentes).

Conectado, el login solo acepta cuentas de Supabase (las cuentas demo de Michelle sirven). Para volver al modo demostración, renombra `.env`.

Para Netlify, la API ya está publicada en Render (`https://epsa-motor-api.onrender.com`) y viene puesta en el código: basta la variable `SUPABASE_ANON_KEY` y volver a desplegar. En el plan gratis de Render, la primera consulta del día tarda cerca de un minuto mientras el servidor se enciende.

## Historias de usuario y archivos

| HU | Qué hace | Archivo(s) | Backend |
|---|---|---|---|
| HU-002 | Factura (con PDF) e identificación de motor y chasis | `pages/dashboard/CompraDetalle.HU-002.jsx` | `PUT /api/compras/:id/factura`, `GET/POST /api/compras/:id/unidades`, `POST/GET /api/compras/:id/factura/archivo`, `GET …/archivo/url` |
| HU-004 | Techo y fibrera (FIVESA, JAVICAR, FIBRAT) de cada unidad | `pages/dashboard/FichaUnidad.HU-004.jsx`, `Inventario.HU-004.jsx` | `GET/PUT /api/unidades/:id/techo` y catálogos; recepción y liberación pendientes |
| HU-007 | Login por correo con permisos por rol, contraseña temporal y 403 | `pages/dashboard/Login.HU-007.jsx`, `Prohibido.HU-007.jsx`, `context/AuthContext.jsx` | Supabase Auth + `hu007_usuario_actual()` |
| HU-008 | Catálogo con un solo filtro (motor, combustible y precio), búsqueda y orden | `pages/Modelos.HU-008.jsx` | `GET /api/modelos` |
| HU-009 | Ficha del modelo: colores reales, techo con precio, pestañas técnicas y errores | `pages/ModeloDetalle.HU-009.jsx`, `pages/Errores.jsx` | `GET /api/modelos/:id` |
| HU-010 | Quiénes somos, sedes y sucursales | `pages/Nosotros.HU-010.jsx`, `pages/Sedes.HU-010.jsx` | ubicaciones activas tipo Sede |
| HU-012 | Administrar modelos (colores, foto, publicar) | `pages/dashboard/ModelosAdmin.HU-012.jsx` | lectura pública lista; escritura pendiente |
| HU-013 | Cotizar y contacto por WhatsApp | `components/CotizarModal.jsx`, `components/WhatsAppButton.HU-013.jsx` | — |
| HU-014 | Registrar interesado, con aviso de celular duplicado aunque sea otro modelo | `pages/dashboard/Leads.HU-014.jsx` | pendiente (tabla `lead`) |
| HU-026 | Administrar ubicaciones (gerencia y administración) | `pages/dashboard/Ubicaciones.HU-026.jsx` | `GET/POST/PUT /api/ubicaciones`, `PATCH /:id/estado` |
| HU-034 | Registrar compra pendiente de factura | `pages/dashboard/RegistrarCompra.HU-034.jsx`, `Compras.HU-034.jsx` | `GET/POST /api/compras` con `Idempotency-Key` |

Módulos complementarios del panel: Resumen, Seguimiento, Ventas a clientes, Facturas y clientes (comprobante en PDF), Metas, Opiniones de clientes y Equipo.

## Cómo se conecta todo

- **Cotizar desde la web:** crea el lead, le asigna un vendedor por turnos, agenda su primer contacto y deja una «Solicitud web» en Ventas con color, techo y total. Si el celular ya existe, se actualiza el mismo cliente.
- **Stock en la web:** cuenta las unidades «Disponible» del Inventario. Una moto comprada aparece con stock después de: compra → factura → identificar motor y chasis → recibir en Inventario → liberar para la venta.
- **Modelos y colores:** lo que se publica, edita o retira en el panel cambia el catálogo y la ficha. Cada color marcado se ve en la web; si no hay foto de ese color, la web cambia el color de la pintura con un filtro SVG (`components/FiltrosColor.jsx`) que deja igual el blanco, el negro y los grises, así el amarillo sale amarillo de verdad.
- **Opiniones:** las que se publican en el panel salen en «Historias de éxito comercial» del inicio. Las de demostración dicen «Ejemplo».
- **Roles:**
  - **Gerente:** todo, incluido eliminar, usuarios y metas.
  - **Administradora/Administrador:** modelos, compras, facturas, inventario, ubicaciones y comprobantes. No elimina ni administra usuarios.
  - **Vendedor/Vendedora:** leads, seguimiento, ventas y consulta de stock. No ve compras, ubicaciones, modelos ni facturación (si escribe esas direcciones, ve el error 403).
