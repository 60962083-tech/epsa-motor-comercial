# EPSA Motor — Frontend

Web pública de clientes y panel interno de gestión comercial, hechos con React, Vite y Tailwind. Están conectados a la API de Michelle (Express + Supabase). Grupo 7 · ISIL 2026-2.

## Cómo correrlo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/ para Netlify
```

- **Web pública:** `/`, `/modelos`, `/modelos/:id`, `/nosotros` y `/sedes`.
- **Panel interno:** `/admin`. No tiene enlace en la web; se entra escribiendo la dirección.

## Conexión

- La dirección de la API (`https://epsa-motor-api.onrender.com`) y la de Supabase ya están en `vite.config.js`.
- Solo falta la clave pública **anon** de Supabase (`SUPABASE_ANON_KEY`):
  - **En tu computadora:** se toma del `.env` de la raíz del repositorio o de `frontend/.env` (ver `.env.example`).
  - **En Netlify:** se pone como variable de entorno.
- Los archivos `.env` no se suben a GitHub.
- Sin la clave, la web funciona en modo demostración y guarda los datos en el navegador.
- En el plan gratis de Render, la primera consulta del día tarda cerca de un minuto.

## Acceso al panel

| Rol | Correo | Contraseña |
|---|---|---|
| Gerente | gerente.demo@epsamotor.test | `clave1234567,` |
| Administradora | admin.demo@epsamotor.test | `clave12345678,` |
| Vendedor | vendedor.demo@epsamotor.test | `clave123456789,` |

## Sprint 1: historias conectadas a la API

| HU | Qué hace | Archivo | API |
|---|---|---|---|
| HU-007 | Login y permisos por rol | `pages/dashboard/Login.HU-007.jsx`, `context/AuthContext.jsx` | Supabase Auth + `hu007_usuario_actual` |
| HU-008 | Catálogo con filtros | `pages/Modelos.HU-008.jsx` | `GET /api/modelos` |
| HU-009 | Ficha del modelo | `pages/ModeloDetalle.HU-009.jsx` | `GET /api/modelos/:id` |
| HU-010 | Quiénes somos y sedes | `pages/Nosotros.HU-010.jsx`, `pages/Sedes.HU-010.jsx` | `GET /api/sedes` |
| HU-012 | Modelos publicados (web y panel) | `store/appStore.jsx`, `pages/dashboard/ModelosAdmin.HU-012.jsx` | `GET /api/modelos` |
| HU-013 | Cotizar y contacto por WhatsApp | `components/CotizarModal.jsx`, `components/WhatsAppButton.HU-013.jsx` | WhatsApp |
| HU-014 | Registrar interesado | `pages/dashboard/Leads.HU-014.jsx` | `POST /api/leads` |
| HU-026 | Ubicaciones | `pages/dashboard/Ubicaciones.HU-026.jsx` | `GET/POST/PUT /api/ubicaciones`, `PATCH /api/ubicaciones/:id/estado` |
| HU-034 | Compras pendientes de factura | `pages/dashboard/Compras.HU-034.jsx`, `pages/dashboard/RegistrarCompra.HU-034.jsx` | `GET/POST /api/compras` |
| HU-002 | Factura (con PDF) e identificación de motor y chasis | `pages/dashboard/CompraDetalle.HU-002.jsx` | `/api/compras/:id/factura`, `…/factura/archivo`, `…/unidades` |
| HU-004 | Techo de cada unidad | `pages/dashboard/FichaUnidad.HU-004.jsx` | `GET/PUT /api/unidades/:id/techo` |

- Todas las llamadas a la API están en `src/lib/api.js`.
- Los demás módulos del panel aún no tienen API y guardan en el navegador: Seguimiento, Ventas, Facturas, Metas, Opiniones, Equipo, recepción y traslado de unidades, y la edición de leads y modelos.

## Carpetas

- `src/pages`: páginas de la web pública. `src/pages/dashboard`: páginas del panel.
- `src/components`: menú, pie de página, carrusel, formulario de cotización, ficha técnica y componentes del panel.
- `src/lib`: conexión con la API, validaciones y utilidades.
- `src/store/appStore.jsx`: datos compartidos entre la web y el panel.
- `src/data/mockData.js`: catálogo, sedes, roles y datos de ejemplo.

En Netlify, `netlify.toml` construye con `npm run build` y publica `dist`. El archivo `public/_redirects` hace que `/admin` y las demás rutas funcionen al recargar.
