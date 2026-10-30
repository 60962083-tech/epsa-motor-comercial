# EPSA Motor — Frontend

Web pública de clientes y panel interno de gestión comercial, hechos con React, Vite y Tailwind. Están conectados a la API del proyecto (Express + Supabase). Grupo 7 · ISIL 2026-2.

## Cómo correrlo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/ para Netlify
```

- **Web pública:** `/`, `/modelos`, `/modelos/:id`, `/nosotros` y `/sedes`. No muestra stock ni cantidades de motos: la disponibilidad la confirma un asesor.
- **Panel interno:** `/admin`. No tiene enlace en la web; se entra escribiendo la dirección.

## Conexión

- La dirección de la API (`https://epsa-motor-api.onrender.com`) y la de Supabase ya están en `vite.config.js`.
- Solo falta la clave pública **anon** de Supabase (`SUPABASE_ANON_KEY`):
  - **En tu computadora:** se toma del `.env` de la raíz del repositorio o de `frontend/.env` (ver `.env.example`).
  - **En Netlify:** se pone como variable de entorno.
- Para probar con la API corriendo en tu computadora: `EPSA_API_LOCAL=1` y `VITE_API_URL=http://localhost:3000` en el `.env` (sin `EPSA_API_LOCAL=1` se usa la de Render).
- La clave `service_role` nunca va en el frontend: si alguien la pone por error, `vite.config.js` la descarta.
- Los archivos `.env` no se suben a GitHub.
- Sin la clave, la web funciona en **modo demostración**: guarda los datos en el navegador y sirve solo para mostrar las pantallas.
- En el plan gratis de Render, la primera consulta del día tarda cerca de un minuto.

## Acceso al panel

Se entra con el correo y la contraseña de cada persona (Supabase Auth). Las cuentas las crea el gerente en **Equipo**. Si alguien olvida su contraseña, el gerente le pone una temporal desde **Equipo** y la persona crea la suya al entrar.

- Funciones de la pantalla **Equipo**: `docs/supabase-login-equipo.sql`. Las cuentas del equipo y sus contraseñas están en un archivo privado que no se sube al repositorio.
- Pantalla **Roles y permisos** (solo gerente): `docs/supabase-permisos-roles.sql`. Sin ese script cada rol ve sus secciones de siempre.
- Fotos repetidas en el catálogo (opcional): `docs/supabase-fotos-repetidas.sql` le da a cada modelo su propia foto.
- Conexiones del Sprint 2 sin ruta en la API: `docs/supabase-sprint2-conexiones.sql`. La cotización de la web queda como interesado en Leads, el vendedor registra su seguimiento y sus ventas concretadas, y se registra la ubicación inicial de una moto identificada a mano.
- Datos de prueba: `docs/supabase-borrar-datos-prueba.sql` borra solo lo marcado como prueba (interesados «Prueba …» y compras con factura «F999-…», con sus motos y movimientos).
- Precios y fichas iniciales (HU-036): `docs/supabase-catalogo-torito.sql` carga el precio, los colores, la descripción y la ficha técnica de los 9 modelos de torito.pe, solo donde falten.
- Facturas recibidas (HU-030): las facturas de Crosland llegan por correo y la API de Michelle las registra solas. En **Compras › Facturas recibidas** se ven todas con sus motos y lo que quedó por revisar, se puede subir una factura (XML y PDF; el XML se lee en el navegador con el mismo código de la API, `src/hu030/`, y se registra con `importar_documento_compra`) y se asignan los códigos de producto de Crosland a cada modelo. Las funciones del panel están en `docs/supabase-sprint2-mejoras.sql`.
- Facturas de prueba (HU-030): `docs/supabase-borrar-facturas-prueba.sql` borra solo las facturas con serie F999- y lo que crearon (motos, compras, intentos y el código B3-PRUEBA-NUEVO).
- Mejoras del Sprint 2: `docs/supabase-sprint2-mejoras.sql` guarda el motivo obligatorio de cada traslado (tabla `motivotraslado` y columnas `movimientoubicacion.codmtr` y `detmub`), el historial de cada interesado (tabla `historiallead`) con su última actualización (`lead.fecactlea`, `detactlea` y `codusuact`) y liga cada venta a quien la concretó (el vendedor ve solo las suyas).
- Mejoras finales del Sprint 2: `docs/supabase-sprint2-final.sql` agrega a `compra` el proveedor (`codpro`) y el grupo de compras registradas juntas (`grupocom`), y las funciones para registrar varias compras a la vez desde la pantalla tipo tienda (`hu034_registrar_carrito`), guardar el pedido de Asiri (`hu034_guardar_pedido`), listar todas las compras (`hu034_compras_listar`), eliminar un modelo sin registros (`hu012_eliminar_modelo`, solo gerencia), ver cada correo recibido con su estado (`hu030_correos_listar`) y la preparación de todas las motos (`hu033_preparacion_listar`) y poner a la venta una moto lista para entrega (`hu001_cambiar_situacion_comercial`). Corrige también el origen, la fecha y los archivos de las facturas que llegan por correo.
- Información de torito.pe en vivo (HU-036): `docs/supabase-torito-en-vivo.sql` deja que Supabase lea torito.pe. En **Modelos**, el botón «Traer información de torito.pe» lee la web oficial en ese momento y guarda con la API de modelos el precio, los colores, la descripción, la ficha técnica completa (en `carmod`) y las fotos. Las fotos se descargan desde Supabase (`hu036_imagen_torito`) y se guardan como archivo propio en Storage (bucket `modelos`, `<codmod>/torito-<huella>.<ext>`): cada foto nueva ocupa el lugar de la anterior y el archivo viejo se borra, así no se acumulan. Si torito.pe publica un modelo nuevo, lo crea (`POST /api/modelos`), le guarda sus fotos y lo publica. Sin ese script, el botón usa la ficha oficial que trae el panel. La web arma cada modelo solo con lo que devuelve `GET /api/modelos`.

## Sprint 2: historias conectadas a la base central

Todas las pantallas del Sprint 2 leen y guardan en la API. Las listas se actualizan solas cada pocos segundos y al volver a la pestaña, tienen botón **Actualizar** y avisan si la conexión falla. Detalle por historia y guion de prueba: [`docs/SPRINT2.md`](docs/SPRINT2.md).

| HU | Qué hace | Dónde | API |
|---|---|---|---|
| HU-001 | Inventario central compartido: ubicación, modelo, color, techo, preparación y situación comercial | Motos → Disponibilidad, Inventario y ficha | `GET /api/inventario`, `GET /api/inventario/unidades/:id` |
| HU-003 | Salida en tránsito y recepción (diseño de Michelle), con conflicto si otra sesión movió la moto | Motos → Movimientos, Inventario y ficha | `GET/POST /api/unidades/:id/movimientos` (`{codubiori, codubides, obsmub}`), `PATCH …/movimientos/:codmub/recepcion`; vista general `GET /api/movimientos` |
| HU-015 | Asignar o transferir un interesado, con motivo y trazabilidad | Ventas → Leads | `GET /api/leads`, `PUT /api/leads/:id/responsable`, `GET …/asignaciones` |
| HU-023 | Compras pendientes de factura, identificación o recepción, y documentos con incidencia | Compras → Pendientes | función `hu023_consultar_compras_pendientes` (la misma de `GET /api/compras-pendientes`) |
| HU-030 | Facturas que llegan a Gmail registran la compra y sus motos en Ancón | Compras → Facturas recibidas | `/api/documentos-compra`, `/api/equivalencias`, `/api/importaciones/*` |
| HU-033 | Preparación por etapas: armado y techo; la moto queda lista para entrega al cumplirlas | Motos → Preparación y ficha | funciones `hu033_consultar_preparacion_unidad` y `hu033_actualizar_preparacion_unidad` (las mismas de `/api/unidades/:id/preparacion`) |
| HU-036 | Fotos de cada modelo en el almacenamiento central | Web y catálogo → Modelos → Fotos | Supabase Storage, bucket `modelos` (`<codmod>/<uuid>.<ext>`), y rutas de HU-012 `POST/PUT /api/modelos/:id/imagenes` |
| EMT-97 | Número de contacto opcional en las ubicaciones | Configuración → Ubicaciones | `POST/PUT /api/ubicaciones` (`telubi`) |

HU-005 (separaciones) y HU-011 (consultas desde la web) no son del Sprint 2: con la base conectada no se muestran. En el modo demostración siguen visibles como vista previa.

**Si la API publicada todavía es la del Sprint 1:** el login, los roles y todo lo del Sprint 1 siguen funcionando. Cada vista del Sprint 2 muestra «Esta sección todavía no está disponible» (la ruta que falta queda en la consola del navegador para el equipo técnico); Compras abre la lista del Sprint 1 mientras falte `GET /api/compras-pendientes`; cada moto identificada en una compra abre su ficha con movimientos (HU-003, si la API ya los tiene) y su configuración de techo (HU-004); Inventario y Movimientos permiten abrir una compra o una moto por su número, y Ubicaciones avisa si el teléfono no se guardó. Cuando la API del Sprint 2 esté publicada, esas vistas cargan sin cambiar nada en el front.

## Sprint 1: historias conectadas a la API

| HU | Qué hace | Archivo | API |
|---|---|---|---|
| HU-007 | Login y permisos por rol (el gerente los ajusta en Roles y permisos) | `pages/dashboard/Login.HU-007.jsx`, `pages/dashboard/RolesPermisos.jsx`, `context/AuthContext.jsx` | Supabase Auth + `hu007_usuario_actual`, `permisos_listar`, `permisos_guardar` |
| HU-008 | Catálogo con filtros | `pages/Modelos.HU-008.jsx` | `GET /api/modelos` |
| HU-009 | Ficha del modelo | `pages/ModeloDetalle.HU-009.jsx` | `GET /api/modelos/:id` |
| HU-010 | Quiénes somos y sedes | `pages/Nosotros.HU-010.jsx`, `pages/Sedes.HU-010.jsx` | `GET /api/sedes` |
| HU-012 | Modelos publicados (web y panel) | `store/appStore.jsx`, `pages/dashboard/ModelosAdmin.HU-012.jsx` | `GET /api/modelos`, `/api/modelos/admin` |
| HU-013 | Cotizar y contacto por WhatsApp | `components/CotizarModal.jsx`, `components/WhatsAppButton.HU-013.jsx` | WhatsApp |
| HU-014 | Registrar interesado | `pages/dashboard/Leads.HU-014.jsx` | `POST /api/leads` |
| HU-026 | Ubicaciones | `pages/dashboard/Ubicaciones.HU-026.jsx` | `GET/POST/PUT /api/ubicaciones`, `PATCH /api/ubicaciones/:id/estado` |
| HU-034 | Compras pendientes de factura | `pages/dashboard/Compras.HU-034.jsx`, `pages/dashboard/RegistrarCompra.HU-034.jsx` | `GET/POST /api/compras` |
| HU-002 | Factura (con PDF) e identificación de motor y chasis | `pages/dashboard/CompraDetalle.HU-002.jsx` | `/api/compras/:id/factura`, `…/factura/archivo`, `…/unidades` |
| HU-004 | Techo de cada unidad | `pages/dashboard/FichaCentral.HU-004.jsx` | `GET/PUT /api/unidades/:id/techo` |

- Todas las llamadas a la API están en `src/lib/api.js` (Sprint 1) y `src/servicios/central.js` (Sprint 2).
- Los módulos que aún no tienen historia en la base guardan en el navegador: Seguimiento, Ventas, Facturas de venta, Metas y Opiniones.

## Carpetas

- `src/pages`: páginas de la web pública. `src/pages/dashboard`: páginas del panel (el nombre del archivo indica su HU).
- `src/components`: menú, pie de página, carrusel, formulario de cotización y componentes del panel. Los del Sprint 2 conectado: `components/dashboard/Central.jsx`, `ModalesCentral.jsx`, `LeadsCentral.jsx`, `ComprasPendientesCentral.jsx` y `GaleriaCentral.jsx`.
- `src/servicios`: consultas a la base central con actualización automática (`central.js`) y reglas de presentación del inventario (`inventarioCentral.js`).
- `src/lib`: conexión con la API, validaciones y utilidades.
- `src/store/appStore.jsx`: datos compartidos entre la web y el panel.
- `src/data/mockData.js`: catálogo, sedes, roles y datos del modo demostración.

En Netlify, `netlify.toml` construye con `npm run build` y publica `dist`. El archivo `public/_redirects` hace que `/admin` y las demás rutas funcionen al recargar.
