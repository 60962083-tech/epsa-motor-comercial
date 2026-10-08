# EPSA Motor — Frontend (React + Vite + Tailwind)

Frontend del Proyecto Tecnológico, Grupo 7 (ISIL 2026-2). Web pública de clientes y panel interno de gestión comercial, conectados al backend de Michelle (Express + TypeScript + Supabase).

## Cómo correrlo

```bash
npm install
npm run imagenes   # descarga las fotos reales de torito.pe y epsamotor.com.pe a public/images
npm run dev        # http://localhost:5173
npm run build      # genera dist/ para Netlify
```

- **Web pública:** `/`, `/modelos`, `/modelos/:id`, `/nosotros`, `/sedes`.
- **Panel interno:** `/admin`. No tiene botón público; se entra escribiendo la dirección.
- En Netlify, `public/_redirects` hace que `/admin` y las demás rutas funcionen al recargar.
- **Acceso al panel** (modo demostración, sin `.env`). El login solo pide usuario y contraseña; las cuentas no se muestran en pantalla:

| Rol | Usuario | Contraseña |
|---|---|---|
| Gerente | `geren` | `geren` |
| Administradora | `admin` | `admin` |
| Vendedor | `vend` | `vend` |

La cuenta de gerente también acepta `gere` / `gere`. Los usuarios que el gerente crea en Equipo ingresan con su correo y su contraseña. En producción cada persona entra con su correo de Supabase Auth y el rol sale de la base de datos. Las cuentas de demostración se cambian en `src/data/mockData.js` (`EQUIPO`).

## Publicar en Netlify

- **Subida manual:** ejecuta `npm run build`, descomprime o copia la carpeta `dist` y arrástrala a la zona de carga al final de la página **Deploys** del sitio en Netlify. Netlify pide una carpeta, no un .zip.
- **Con GitHub:** si el sitio está conectado al repositorio, basta con subir el código; `netlify.toml` le indica a Netlify que construya con `npm run build` y publique `dist`.
- El panel queda en `https://epsa-motor-grupo7.netlify.app/admin`. `public/_redirects` hace que esa dirección funcione al abrirla o recargarla.

## Conexión con Supabase y el backend de Michelle

Copia `.env.example` a `.env` y completa estas tres variables (en Netlify van en *Site settings → Environment variables*):

| Variable | Qué es |
|---|---|
| `VITE_API_URL` | URL pública de la API de Michelle, por ejemplo `https://epsa-api.onrender.com` |
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública *anon* (nunca la service_role) |

Con las tres variables, la web entra en **modo conectado**:

- **Login:** usa Supabase Auth y obtiene el rol con la RPC `hu007_usuario_actual()`.
- **Datos:** catálogo, ubicaciones, compras, factura y unidades se leen y escriben por la API.

Sin esas variables, la web funciona en **modo demostración** con los mismos contratos, guardando los datos en el navegador.

El frontend **no lee tablas de Supabase directamente**: RLS lo impide para anon, y todo pasa por la API de Michelle. Dentro del panel, *Administración → Integración backend* muestra el estado de cada módulo y permite probar la conexión.

## Historias de usuario y archivos

| HU | Qué hace | Archivo(s) | Backend |
|---|---|---|---|
| HU-002 | Completar identificación de motos compradas (factura + motor/chasis) | `pages/dashboard/CompraDetalle.HU-002.jsx` | `PUT /api/compras/:id/factura`, `GET/POST /api/compras/:id/unidades` |
| HU-004 | Actualizar la configuración del techo: selector de techo y proveedor en la ficha de la unidad, instalación y observación comercial | `pages/dashboard/FichaUnidad.HU-004.jsx`, `pages/dashboard/Inventario.HU-004.jsx` | pendiente de endpoint |
| HU-007 | Acceso con permisos por rol (login de usuario y contraseña), 403 | `pages/dashboard/Login.HU-007.jsx`, `Prohibido.HU-007.jsx`, `context/AuthContext.jsx` | Supabase Auth + `hu007_usuario_actual()` |
| HU-008 | Explorar modelos en un catálogo: un solo filtro (motor, combustible, techo y precio) con conteos, búsqueda, orden y etiquetas removibles; en móvil se abre como panel | `pages/Modelos.HU-008.jsx` | `GET /api/modelos` |
| HU-009 | Ficha del modelo (colores, 360°, pestañas técnicas, errores) | `pages/ModeloDetalle.HU-009.jsx`, `pages/Errores.jsx` | `GET /api/modelos` |
| HU-010 | Información de EPSA Motor, sedes y sucursales | `pages/Nosotros.HU-010.jsx`, `pages/Sedes.HU-010.jsx` | ubicaciones activas tipo Sede |
| HU-012 | Administrar modelos publicados | `pages/dashboard/ModelosAdmin.HU-012.jsx` | lectura pública lista; escritura pendiente |
| HU-013 | Contacto por WhatsApp | `components/WhatsAppButton.HU-013.jsx`, `components/CotizarModal.jsx` | — |
| HU-014 | Registrar manualmente un interesado: datos mínimos, aviso de duplicado en vivo y modo ausencia | `pages/dashboard/Leads.HU-014.jsx` | pendiente (tabla `lead`) |
| HU-026 | Administrar ubicaciones | `pages/dashboard/Ubicaciones.HU-026.jsx` | `GET/POST/PUT /api/ubicaciones`, `PATCH /:id/estado` |
| HU-034 | Registrar compra pendiente de factura | `pages/dashboard/RegistrarCompra.HU-034.jsx` (formulario, ruta `/admin/compras/nueva`), `pages/dashboard/Compras.HU-034.jsx` (listado) | `GET/POST /api/compras` con `Idempotency-Key` |

Módulos complementarios del panel, sin HU en el Sprint 1: Resumen, Seguimiento, Ventas a clientes (con comprobantes manuales), Metas, Equipo (usuarios y equipo del proyecto) e Integración.

## Cómo se conecta todo

- **Cotizar desde la web:** crea el lead (Leads), le asigna un vendedor por turnos, agenda su primer contacto (Seguimiento) y deja una «Solicitud web» pendiente en Ventas. Con el modo ausencia activo, el lead queda «Sin asignar».
- **Modelos:** publicar, editar o retirar un modelo cambia el catálogo y la ficha públicos. El stock que ve el cliente sale del Inventario.
- **Ubicaciones:** las sedes activas aparecen en *Sedes y sucursales*. Una ubicación con unidades no se puede desactivar.
- **Compras a proveedor:**
  1. Compra (HU-034).
  2. Factura (HU-002).
  3. Identificación de motor y chasis: las unidades nacen «No disponible».
  4. Recepción en Inventario.
  5. Techo y preparación (HU-004).
  6. Liberar para la venta.
  7. Separación con adelanto.
  8. Entrega.
- **Avisos y confirmaciones:**
  - Toda eliminación pide confirmación.
  - Los formularios avisan si sales con cambios sin guardar.
  - Las ediciones piden confirmar antes de guardar.
- **Roles:**
  - **Gerente:** todo: elimina, administra sedes y ubicaciones, usuarios y metas, y emite comprobantes manuales.
  - **Administradora:** edita modelos y descripciones, registra compras, facturas e identificación, y gestiona inventario y techo. No elimina, no edita sedes ni usuarios.
  - **Vendedor:** leads, seguimiento y ventas; en la ficha de una unidad solo deja observaciones comerciales.

## Imágenes reales

- **En la web:** se usan las fotos oficiales de torito.pe (incluidas las versiones roja y azul de Crom Plus y 2T), sus íconos técnicos, el logo Torito y el sello Bajaj.
- **Copia local:** `npm run imagenes` guarda todo en `public/images` para no depender de esas webs. Si una foto no carga, la web usa la copia local y, si tampoco existe, una silueta neutra.
- **Vista 360°:** el Torito 250 4V GLP usa las 8 fotos de ángulo que publica torito.pe (arrastre, barra «360°» y botón Girar). Para otro modelo, agrega su lista `angulos360` en `src/data/mockData.js`.

## Pendientes para el backend

Ver `docs/INTEGRACION-FRONTEND.md`: lista los endpoints que el frontend ya está listo para consumir y el contrato sugerido para cada uno, según las tablas del esquema.
