import { MODO_REAL } from "./config";
import { consultarPdfFacturaApi, subirPdfFacturaApi, urlPdfFacturaApi } from "./api";
import { ApiError } from "./errores";

/**
 * Archivos adjuntos (PDF de la factura de Crosland).
 * - Conectado: se usan los endpoints del backend de Michelle (bucket privado «facturas-compra»):
 *   POST /api/compras/:id/factura/archivo (campo «archivo», multipart), GET …/archivo y GET …/archivo/url.
 *   Cada factura admite un solo PDF y se guarda como compras/{codcom}/factura.pdf.
 * - Demostración: se guardan en este navegador (IndexedDB) y, si no está disponible, en memoria.
 */
const memoria = new Map();
export const MAX_PDF = 10 * 1024 * 1024;

/** Revisión rápida (sin leer el archivo): tipo, extensión y tamaño. */
export function validarPdf(archivo) {
  if (!archivo) return "Elige un archivo.";
  const tipoOk = ["application/pdf", "application/x-pdf"].includes(archivo.type) || (!archivo.type && /\.pdf$/i.test(archivo.name || ""));
  if (!tipoOk) return "Solo se aceptan archivos PDF.";
  if (!archivo.size) return "El PDF está vacío.";
  if (archivo.size > MAX_PDF) return "El PDF supera los 10 MB.";
  return "";
}

/** Revisión del contenido: un PDF real empieza con «%PDF» (evita fotos o documentos renombrados). */
export async function validarPdfContenido(archivo) {
  const rapido = validarPdf(archivo);
  if (rapido) return rapido;
  try {
    const cabecera = await archivo.slice(0, 5).text();
    if (!cabecera.startsWith("%PDF")) return "El archivo no es un PDF válido.";
  } catch { /* si el navegador no puede leerlo, decide el servidor */ }
  return "";
}

function db() {
  return new Promise((ok, mal) => {
    try {
      const r = indexedDB.open("epsa-archivos", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("archivos");
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    } catch (e) { mal(e); }
  });
}
async function guardarLocal(clave, blob) {
  try {
    const d = await db();
    await new Promise((ok, mal) => { const t = d.transaction("archivos", "readwrite"); t.objectStore("archivos").put(blob, clave); t.oncomplete = ok; t.onerror = () => mal(t.error); });
  } catch { memoria.set(clave, blob); }
}
async function leerLocal(clave) {
  if (memoria.has(clave)) return memoria.get(clave);
  try {
    const d = await db();
    return await new Promise((ok, mal) => { const r = d.transaction("archivos").objectStore("archivos").get(clave); r.onsuccess = () => ok(r.result || null); r.onerror = () => mal(r.error); });
  } catch { return null; }
}

/** Sube el PDF y devuelve los datos del adjunto. */
export async function subirPdfFactura(codcom, archivo) {
  const error = await validarPdfContenido(archivo);
  if (error) throw new ApiError(400, error);
  const fecha = new Date().toLocaleDateString("en-CA");
  if (MODO_REAL) {
    await subirPdfFacturaApi(codcom, archivo);
    return { codcom: String(codcom), api: true, nombre: archivo.name, tamano: archivo.size, fecha };
  }
  const nombre = archivo.name.replace(/[^\w.-]+/g, "_");
  const ruta = `compra-${codcom}/${Date.now()}-${nombre}`;
  await guardarLocal(ruta, archivo);
  return { ruta, nombre: archivo.name, tamano: archivo.size, fecha };
}

/** Conectado: pregunta al backend si la factura ya tiene su PDF (lo ve cualquier gerente o administradora). */
export async function buscarPdfFactura(codcom) {
  if (!MODO_REAL) return null;
  try {
    const r = await consultarPdfFacturaApi(codcom);
    return r.data?.archivo_adjuntado ? { codcom: String(codcom), api: true, nombre: "factura.pdf" } : null;
  } catch { return null; } // sin factura registrada (404) o sin permiso: no hay PDF que mostrar
}

/** Devuelve una URL para abrir o descargar el PDF guardado. */
export async function urlPdfFactura(adjunto) {
  if (MODO_REAL) {
    if (!adjunto?.codcom) throw new ApiError(404, "Esta factura no tiene PDF adjunto.");
    const r = await urlPdfFacturaApi(adjunto.codcom);
    if (!r.data?.url) throw new ApiError(500, "No se pudo abrir el PDF.");
    return r.data.url; // enlace temporal (60 s) del bucket privado
  }
  if (!adjunto?.ruta) throw new ApiError(404, "Esta factura no tiene PDF adjunto.");
  const blob = await leerLocal(adjunto.ruta);
  if (!blob) throw new ApiError(404, "El PDF se guardó en otro navegador; adjúntalo de nuevo para verlo aquí.");
  return URL.createObjectURL(blob);
}

// Modo demostración: se recuerda el adjunto por compra para volver a abrirlo desde este equipo.
const CLAVE_ADJ = "epsa-adjuntos-factura";
export function adjuntoRecordado(codcom) {
  try { return JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}")[codcom] || null; } catch { return null; }
}
export function recordarAdjunto(codcom, adjunto) {
  try { const m = JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}"); m[codcom] = adjunto; localStorage.setItem(CLAVE_ADJ, JSON.stringify(m)); } catch { /* sin almacenamiento */ }
}
