// Secciones del panel, agrupadas por tema
// Una sola lista para el menú lateral y para la pantalla «Roles y permisos». La clave (seccion) es la misma que
// usan ROLES (data/mockData.js) y la tabla permiso_rol (docs/supabase-permisos-roles.sql).
import { MODO_REAL } from "../lib/config";

export const GRUPOS_PANEL = [
  { titulo: "Inicio", items: [
    { to: "/admin", label: "Resumen", seccion: "resumen", end: true, fija: true, descripcion: "Página de inicio del panel. Siempre visible." },
  ] },
  { titulo: "Ventas", items: [
    { to: "/admin/leads", label: "Leads", seccion: "leads", descripcion: "Interesados, su responsable y el registro de interesados nuevos." },
    { to: "/admin/seguimiento", label: "Seguimiento", seccion: "seguimiento", descripcion: "Llamadas y recordatorios con cada interesado." },
    // HU-005 no es del Sprint 2: con la base conectada no se muestra
    ...(MODO_REAL ? [] : [{ to: "/admin/separaciones", label: "Separaciones", seccion: "separaciones", descripcion: "Motos separadas con adelanto." }]),
    { to: "/admin/ventas", label: "Ventas a clientes", seccion: "ventas", descripcion: "Pedidos, adelantos y entregas a clientes." },
    { to: "/admin/facturas", label: "Facturas y clientes", seccion: "facturas", descripcion: "Comprobantes de venta y datos de los clientes." },
    { to: "/admin/metas", label: "Metas", seccion: "metas", descripcion: "Metas de venta del mes por sede." },
  ] },
  { titulo: "Motos", items: [
    { to: "/admin/disponibilidad", label: "Disponibilidad", seccion: "disponibilidad", descripcion: "Motos libres por modelo y ubicación, igual para todo el equipo." },
    { to: "/admin/inventario", label: "Inventario", seccion: "inventario", descripcion: "Ficha de cada moto: ubicación, techo y preparación." },
    { to: "/admin/movimientos", label: "Movimientos", seccion: "movimientos", descripcion: "Traslados entre almacén, talleres y sedes." },
    { to: "/admin/preparacion", label: "Preparación", seccion: "preparacion", descripcion: "Armado, techo y condición de entrega de cada moto." },
  ] },
  { titulo: "Compras", items: [
    { to: "/admin/compras", label: "Compras a proveedor", seccion: "compras", descripcion: "Compras a Crosland, sus facturas y las motos por identificar." },
    { to: "/admin/facturas-recibidas", label: "Facturas recibidas", seccion: "facturasRecibidas", descripcion: "Facturas que llegan por correo y su revisión." },
  ] },
  { titulo: "Web y catálogo", items: [
    { to: "/admin/modelos", label: "Modelos", seccion: "modelos", descripcion: "Modelos, precios y fotos que se ven en la web." },
    { to: "/admin/opiniones", label: "Opiniones de clientes", seccion: "opiniones", descripcion: "Opiniones que se publican en la web." },
  ] },
  { titulo: "Configuración", items: [
    { to: "/admin/ubicaciones", label: "Ubicaciones", seccion: "ubicaciones", descripcion: "Sedes, almacenes y talleres, con su número de contacto." },
    { to: "/admin/equipo", label: "Equipo", seccion: "equipo", descripcion: "Cuentas del panel y el rol de cada persona." },
    { to: "/admin/permisos", label: "Roles y permisos", seccion: "permisos", soloGerente: true, descripcion: "Qué secciones ve cada rol." },
  ] },
];

// Roles que el gerente puede limitar y su nombre en la base de datos
export const ROLES_LIMITABLES = [
  { id: "administradora", nombre: "Administradora" },
  { id: "vendedor", nombre: "Vendedor" },
];
