# EPSA Motor — Frontend (React + Vite + Tailwind)

Las 10 historias de usuario del Sprint 1 asignadas a Didier (UX/UI y
Frontend), maquetadas y funcionando con datos de ejemplo.

## Cómo correrlo

```
npm install
npm run dev
```

## Historias cubiertas y dónde están

| HU | Pantalla | Archivo |
|----|----------|---------|
| HU-008 | Catálogo (responsive 375px, estado vacío) | `src/pages/Modelos.jsx` |
| HU-009 | Ficha de modelo + error de ruta inválida | `src/pages/ModeloDetalle.jsx` |
| HU-010 | Institucional + tarjetas de sedes | `src/pages/Nosotros.jsx` |
| HU-013 | Botón WhatsApp con mensaje predeterminado | `src/components/WhatsAppButton.jsx` |
| HU-007 | Login, menú por rol, pantalla 403 | `src/pages/dashboard/Login.jsx`, `Prohibido.jsx`, `src/components/dashboard/DashboardLayout.jsx` |
| HU-002 | Vincular unidad + error por duplicado | `src/pages/dashboard/VincularUnidad.jsx` |
| HU-026 | Catálogo de ubicaciones, activar/desactivar | `src/pages/dashboard/Ubicaciones.jsx` |
| HU-004 | Selector de techo y proveedor | `src/pages/dashboard/Techo.jsx` |
| HU-012 | Publicar/retirar modelos | `src/pages/dashboard/ModelosAdmin.jsx` |
| HU-014 | Registrar interesado + aviso de duplicado | `src/pages/dashboard/Leads.jsx` |

## Cómo probar un rol distinto

En `/dashboard/login` hay un selector "Rol (demo)". Entra como
`vendedor` y vas a ver que el menú no muestra Modelos ni
Ubicaciones; si escribes la URL a mano igual te manda a la
pantalla 403 (`ProtectedRoute.jsx`).

## Qué es simulado y qué conecta Michelle después

Todo lo que necesita guardarse de verdad vive en
`src/data/mockData.js`. Busca los comentarios `TODO (Michelle)` en:

- `src/data/mockData.js`
- `src/context/AuthContext.jsx` (login real con Supabase Auth)
- `src/pages/dashboard/VincularUnidad.jsx` (el UPDATE real)
- `src/pages/Home.jsx` y `src/pages/dashboard/Leads.jsx` (los INSERT reales)

## Pendiente de EPSA Motor

- Fotos reales y autorizadas de cada modelo (hoy hay una ilustración
  vectorial de marcador, ver `MotoIllustration.jsx`).
- Horarios de las tres sedes.
- Confirmar si el WhatsApp es un número único o los cuatro de la
  entrevista (hoy usa el único que aparece en epsamotor.com.pe).
