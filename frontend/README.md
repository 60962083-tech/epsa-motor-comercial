# EPSA Motor — Frontend (React + Vite + Tailwind)

## Novedades de esta vuelta

1. **Catálogo real, 7 modelos**, con datos de la línea Bajaj RE/Torito
   que vende EPSA Motor (`src/data/mockData.js`): tipo de motor (2 o 4
   tiempos), combustible (Gasolina, GLP, GNV) y uso (Pasajeros o Carga).
   Las especificaciones exactas de precio quedan "por confirmar" porque
   eso sí lo tiene que dar la empresa.
2. **Filtros en el catálogo** (`src/pages/Modelos.HU-008.jsx`), igual en
   estructura a epsamotor.com.pe: tipo de motor, combustible y uso,
   con botón para limpiar filtros y un estado vacío propio cuando
   ningún modelo coincide con el filtro elegido.
3. **Botón "Ingresar"** en el menú de la web pública, que lleva al
   login del dashboard (`src/components/Navbar.jsx`).
4. **Atajo de login para la demo**: escribir `admin` / `admin` entra
   directo como administradora (también `gerente`/`gerente` y
   `vendedor`/`vendedor`). Ver el aviso en el Anexo A del informe:
   esto se borra en cuanto Michelle conecte la autenticación real.
5. **HU-034, Registrar compra pendiente de factura**, pasada a React
   (`src/pages/dashboard/RegistrarCompra.HU-034.jsx`), con acceso
   desde el botón "+ Registrar compra" en Unidades.
6. **Sección "Consulta por un modelo"** rediseñada, con un panel
   lateral y el botón en verde de WhatsApp, más vistosa.

## Las 11 historias y su estado real

| HU | Pantalla | QA (según Reporte_de_pruebas.pdf) |
|---|---|---|
| HU-013 | Botón de WhatsApp | **Aprobada**, sin observaciones |
| HU-008 | Catálogo + filtros | Corregida (DEF-002, OBS-003) — pendiente de reconfirmar |
| HU-009 | Ficha de modelo | Corregida (DEF-003) — pendiente de reconfirmar |
| HU-010 | Quiénes somos + Sedes | Corregida (DEF-001, OBS-001, OBS-002) — pendiente de reconfirmar |
| HU-007 | Login por rol | En proceso: falta autenticación real (Supabase) |
| HU-002 | Identificar unidad | Construida, aún no auditada por QA |
| HU-004 | Techo y proveedor | Construida, aún no auditada por QA |
| HU-012 | Publicar/retirar modelos | Construida, aún no auditada por QA |
| HU-014 | Registrar interesado | Construida, aún no auditada por QA |
| HU-026 | Administrar ubicaciones | Construida, aún no auditada por QA |
| HU-034 | Registrar compra pendiente | Construida esta vuelta, aún no auditada por QA |

## Cómo probar el modo administrador

1. Entra a la web pública y haz clic en "Ingresar" (arriba a la derecha).
2. Escribe `admin` en correo y en contraseña.
3. Ya adentro puedes: retirar/publicar modelos (Modelos), desactivar
   sedes o proveedores (Ubicaciones), identificar unidades y registrar
   compras pendientes.

## Cómo correrlo

```
npm install
npm run dev
```
