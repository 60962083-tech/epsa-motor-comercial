/**
 * mockData.js
 * -----------------------------------------------------------------
 * Datos de ejemplo para que las pantallas se vean y se comporten
 * como van a comportarse de verdad (incluyendo los avisos de
 * duplicado), mientras Michelle no conecta Supabase.
 *
 * TODO (Michelle): cada arreglo de aquí debería reemplazarse por una
 * consulta real, por ejemplo:
 *   const { data } = await supabase.from("unidades").select("*")
 * Mientras eso no exista, el frontend lee estos arreglos directamente.
 * -----------------------------------------------------------------
 */

// Modelos publicados en el catálogo (HU-008, HU-009, HU-012)
export const MODELOS = [
  {
    id: "torito",
    nombre: "Torito",
    estado: "Publicado", // Publicado | Borrador
    techo: "Clásico o especial, según la unidad",
    uso: "Dato por confirmar con EPSA Motor",
    capacidad: "Dato por confirmar con EPSA Motor",
    motor: "Dato por confirmar con EPSA Motor",
  },
  {
    id: "cross",
    nombre: "Cross",
    estado: "Publicado",
    techo: "Clásico o especial, según la unidad",
    uso: "Dato por confirmar con EPSA Motor",
    capacidad: "Dato por confirmar con EPSA Motor",
    motor: "Dato por confirmar con EPSA Motor",
  },
  {
    id: "modelo-3",
    nombre: "Modelo 3",
    estado: "Borrador", // No debe verse en el catálogo público
    techo: "Por definir",
    uso: "Por definir",
    capacidad: "Por definir",
    motor: "Por definir",
  },
];

// Sedes y proveedores (HU-010, HU-026)
// "tipo" distingue una sede propia de un almacén o proveedor externo.
export const UBICACIONES = [
  { id: 1, nombre: "Comas", tipo: "Sede propia", direccion: "Av. 22 de Agosto, Comas, Lima", activo: true },
  { id: 2, nombre: "Ventanilla", tipo: "Sede propia", direccion: "Av. José Olaya Balandra Mz. Z, Lote 9, Ventanilla, Callao", activo: true },
  { id: 3, nombre: "Puente Piedra", tipo: "Sede propia", direccion: "Asoc. Viv. Los Rosales, Mz. C, Lote 9, Puente Piedra, Lima", activo: true },
  { id: 4, nombre: "Crosland - Ancón", tipo: "Almacén externo", direccion: "", activo: true },
  { id: 5, nombre: "FIVESA", tipo: "Proveedor de techo", direccion: "", activo: true },
  { id: 6, nombre: "JAVICAR", tipo: "Proveedor de techo", direccion: "", activo: false },
  { id: 7, nombre: "FIBRAT", tipo: "Proveedor de techo", direccion: "", activo: true },
];

// Unidades ya registradas, usadas para detectar motor/chasis duplicado (HU-002)
export const UNIDADES = [
  { id: "MC-001", modelo: "Torito", ubicacion: "Ventanilla", techo: "Clásico", estado: "Disponible", motor: "BJM-10234", chasis: "BJC-88214" },
  { id: "MC-002", modelo: "Cross", ubicacion: "Comas", techo: "Especial", estado: "Separada", motor: "BJM-10391", chasis: "BJC-88339" },
  { id: "MC-003", modelo: "Torito", ubicacion: "Almacén Crosland", techo: "Por definir", estado: "Pendiente de factura", motor: "", chasis: "" },
];

// Interesados / leads, usados para detectar contacto duplicado (HU-014)
export const LEADS = [
  { id: 1, contacto: "Cliente de prueba", telefono: "900111222", canal: "WhatsApp 2", modelo: "Torito", responsable: "César", estado: "Nuevo" },
  { id: 2, contacto: "Cliente de prueba", telefono: "900333444", canal: "Formulario web", modelo: "Cross", responsable: "Deysi", estado: "En seguimiento" },
];

// Tipos de techo disponibles (HU-004)
export const TIPOS_TECHO = ["Sin techo", "Lona", "Techo clásico de fibra", "Techo de fibra deportiva"];
export const PROVEEDORES_TECHO = ["FIVESA", "JAVICAR", "FIBRAT"];

// Roles válidos del sistema (HU-007) y qué rutas del dashboard puede ver cada uno
export const ROLES = {
  gerente: { nombre: "Gerente", puede: ["resumen", "unidades", "modelos", "ubicaciones", "leads"] },
  administradora: { nombre: "Administradora", puede: ["resumen", "unidades", "modelos", "ubicaciones", "leads"] },
  vendedor: { nombre: "Vendedor", puede: ["resumen", "unidades", "leads"] },
};
