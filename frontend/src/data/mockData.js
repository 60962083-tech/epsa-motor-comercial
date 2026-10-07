/**
 * mockData.js
 * Datos de ejemplo del Sprint 1. Mientras no haya conexión a Supabase,
 * el frontend lee estos arreglos directamente.
 */

// Modelos del catálogo (HU-008, HU-009, HU-012).
// "imagen" sigue un patrón fijo: /images/modelos/modelo-1.jpg ... modelo-7.jpg,
// en el mismo orden en que aparecen aquí abajo. Para poner las fotos reales,
// solo hay que descargar la imagen de cada modelo y guardarla en
// public/images/modelos con ese mismo nombre (modelo-1.jpg, modelo-2.jpg...),
// sin tocar nada del código. Todas se recortan igual (object-cover) para que
// el catálogo se vea parejo aunque las fotos originales tengan tamaños distintos.
//
// Los datos técnicos son de la línea Bajaj RE / Torito que vende EPSA Motor.
// Precio y color quedan "por confirmar": la propia web de EPSA Motor tampoco
// muestra precios fijos, solo un botón para cotizar por WhatsApp o evaluar
// crédito, así que seguimos ese mismo patrón en vez de inventar un número.
export const MODELOS = [
  {
    id: "torito-re-2t-pasajeros",
    nombre: "Torito RE 2T Pasajeros",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-1.jpg",
    tipoMotor: "2 tiempos",
    combustible: "Gasolina",
    uso: "Pasajeros",
    cilindrada: "150 CC",
    potencia: "Dato por confirmar con EPSA Motor",
    techo: "Clásico o especial, según la unidad",
    tipoTecho: "Clásico",
    colores: ["Rojo", "Blanco", "Azul"],
    precio: "Cotizar",
  },
  {
    id: "torito-4t-crom-ug-gsl",
    nombre: "Torito 4T CROM UG GSL",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-2.jpg",
    tipoMotor: "4 tiempos",
    combustible: "Gasolina",
    uso: "Pasajeros",
    cilindrada: "150 CC",
    potencia: "11.4 HP",
    techo: "Clásico o especial, según la unidad",
    tipoTecho: "Clásico",
    colores: ["Rojo", "Blanco", "Azul"],
    precio: "Cotizar",
  },
  {
    id: "torito-crom-plus-gnv",
    nombre: "Torito CROM PLUS GNV",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-3.jpg",
    tipoMotor: "4 tiempos",
    combustible: "GNV",
    uso: "Pasajeros",
    cilindrada: "200 CC",
    potencia: "Dato por confirmar con EPSA Motor",
    techo: "Clásico o especial, según la unidad",
    tipoTecho: "Especial",
    colores: ["Rojo", "Blanco"],
    precio: "Cotizar",
  },
  {
    id: "torito-re-glp-carga",
    nombre: "Torito RE GLP Carga",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-4.jpg",
    tipoMotor: "4 tiempos",
    combustible: "GLP",
    uso: "Carga",
    cilindrada: "200 CC",
    potencia: "Dato por confirmar con EPSA Motor",
    techo: "Especial, según la unidad",
    tipoTecho: "Especial",
    colores: ["Rojo", "Blanco"],
    precio: "Cotizar",
  },
  {
    id: "torito-re-carga",
    nombre: "Torito RE Carga",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-5.jpg",
    tipoMotor: "4 tiempos",
    combustible: "Gasolina",
    uso: "Carga",
    cilindrada: "200 CC",
    potencia: "Dato por confirmar con EPSA Motor",
    techo: "Sin techo (plataforma de carga)",
    tipoTecho: "Sin techo",
    colores: ["Rojo", "Blanco"],
    precio: "Cotizar",
  },
  {
    id: "torito-250",
    nombre: "Torito 250",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-6.jpg",
    tipoMotor: "4 tiempos",
    combustible: "Gasolina",
    uso: "Pasajeros",
    cilindrada: "250 CC",
    potencia: "20 HP",
    techo: "Clásico o especial, según la unidad",
    tipoTecho: "Clásico",
    colores: ["Rojo", "Blanco", "Azul"],
    precio: "Cotizar",
  },
  {
    id: "torito-re-2t-glp",
    nombre: "Torito RE 2T GLP Pasajeros",
    estado: "Publicado",
    imagen: "/images/modelos/modelo-7.jpg",
    tipoMotor: "2 tiempos",
    combustible: "GLP",
    uso: "Pasajeros",
    cilindrada: "150 CC",
    potencia: "Dato por confirmar con EPSA Motor",
    techo: "Clásico o especial, según la unidad",
    tipoTecho: "Clásico",
    colores: ["Rojo", "Blanco", "Azul"],
    precio: "Cotizar",
  },
  {
    id: "modelo-3",
    nombre: "Modelo 3",
    estado: "Borrador", // no se ve en el catálogo público (OBS-003)
    imagen: "/images/modelos/modelo-8.jpg",
    tipoMotor: "Por definir",
    combustible: "Por definir",
    uso: "Por definir",
    cilindrada: "Por definir",
    potencia: "Por definir",
    techo: "Por definir",
    tipoTecho: "Por definir",
    colores: [],
    precio: "Cotizar",
  },
];

// Filtros del catálogo, mismo criterio que usa epsamotor.com.pe.
export const FILTROS_CATALOGO = {
  tipoMotor: ["2 tiempos", "4 tiempos"],
  combustible: ["Gasolina", "GLP", "GNV"],
  uso: ["Pasajeros", "Carga"],
  tipoTecho: ["Clásico", "Especial", "Sin techo"],
};

// Sedes y proveedores (HU-010, HU-026). "tipo" distingue sede propia,
// almacén y proveedor. "horario" es el mismo en las tres sedes propias.
//
// Nota sobre conexión real: en Supabase la tabla se llama "ubicacion" y usa
// otros nombres de columna (codubi, nomubi, tipubi, dirubi, estubi), y el
// tipo solo acepta "Sede" / "Almacen" / "Proveedor" sin el detalle que
// mostramos aquí. Además esa API hoy pide sesión iniciada, así que no sirve
// todavía para esta página pública — ver el mensaje al equipo sobre esto.
const HORARIO_SEDE = "Lunes a Sábado de 9:00 AM a 5:00 PM";
const HORARIO_NOTA = "Domingos: consultar por WhatsApp o en sede";

export const UBICACIONES = [
  {
    id: 1,
    nombre: "Comas",
    tipo: "Sede propia",
    direccion: "Av. 22 de Agosto 852, Comas, Lima",
    telefono: "51 907 721 481",
    correo: "inversionesepsamotor@gmail.com",
    horario: HORARIO_SEDE,
    horarioNota: HORARIO_NOTA,
    activo: true,
  },
  {
    id: 2,
    nombre: "Ventanilla",
    tipo: "Sede propia",
    direccion: "Av. José Olaya Balandra Mz. Z, Lote 9, Ventanilla, Callao",
    telefono: "51 907 721 481",
    correo: "inversionesepsamotor@gmail.com",
    horario: HORARIO_SEDE,
    horarioNota: HORARIO_NOTA,
    activo: true,
  },
  {
    id: 3,
    nombre: "Puente Piedra",
    tipo: "Sede propia",
    direccion: "Asoc. de Viv. Los Rosales, Mz. C, Lote 9, Puente Piedra, Lima",
    telefono: "51 907 721 481",
    correo: "inversionesepsamotor@gmail.com",
    horario: HORARIO_SEDE,
    horarioNota: HORARIO_NOTA,
    activo: true,
  },
  { id: 4, nombre: "Crosland - Ancón", tipo: "Almacén externo", direccion: "", telefono: "", correo: "", activo: true },
  { id: 5, nombre: "FIVESA", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: true },
  { id: 6, nombre: "JAVICAR", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: false },
  { id: 7, nombre: "FIBRAT", tipo: "Proveedor de techo", direccion: "", telefono: "", correo: "", activo: true },
];

// Enlace de Google Maps a partir de una dirección de texto (sirve el botón
// "Cómo llegar" sin necesitar coordenadas exactas).
export function enlaceGoogleMaps(direccion) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;
}

// Enlace de un mapa embebido (sin API key) para mostrar el mini mapa de cada sede.
export function enlaceMapaEmbebido(direccion) {
  return `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed`;
}

// Unidades registradas, para detectar motor/chasis duplicado (HU-002)
export const UNIDADES = [
  { id: "MC-001", modelo: "Torito", ubicacion: "Ventanilla", techo: "Clásico", estado: "Disponible", motor: "BJM-10234", chasis: "BJC-88214" },
  { id: "MC-002", modelo: "Cross", ubicacion: "Comas", techo: "Especial", estado: "Separada", motor: "BJM-10391", chasis: "BJC-88339" },
  { id: "MC-003", modelo: "Torito", ubicacion: "Almacén Crosland", techo: "Por definir", estado: "Pendiente de factura", motor: "", chasis: "" },
];

// Interesados / leads, para detectar contacto duplicado (HU-014)
export const LEADS = [
  { id: 1, contacto: "Cliente de prueba", telefono: "900111222", canal: "WhatsApp 2", modelo: "Torito", responsable: "César", estado: "Nuevo" },
  { id: 2, contacto: "Cliente de prueba", telefono: "900333444", canal: "Formulario web", modelo: "Cross", responsable: "Deysi", estado: "En seguimiento" },
];

// Tipos de techo disponibles (HU-004)
export const TIPOS_TECHO = ["Sin techo", "Lona", "Techo clásico de fibra", "Techo de fibra deportiva"];
export const PROVEEDORES_TECHO = ["FIVESA", "JAVICAR", "FIBRAT"];

// Roles del sistema (HU-007) y qué secciones del dashboard ve cada uno.
// Las claves de abajo son internas; en Supabase los roles están guardados
// como "Gerente", "Administradora" y "Vendedor" (tabla rol.nomrol).
export const ROLES = {
  gerente: { nombre: "Gerente", puede: ["resumen", "unidades", "modelos", "ubicaciones", "leads"] },
  administradora: { nombre: "Administradora", puede: ["resumen", "unidades", "modelos", "ubicaciones", "leads"] },
  vendedor: { nombre: "Vendedor", puede: ["resumen", "unidades", "leads"] },
};
