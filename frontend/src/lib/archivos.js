// HU-002 · PDF de la factura
import { MODO_REAL } from "./config";
import { consultarPdfFacturaApi, subirPdfFacturaApi, urlPdfFacturaApi } from "./api";
import { ApiError } from "./errores";

const memoria = new Map();
export const MAX_PDF = 10 * 1024 * 1024;

// Validar el archivo
export function validarPdf(archivo) {
  if (!archivo) return "Elige un archivo.";
  const tipoOk = ["application/pdf", "application/x-pdf"].includes(archivo.type) || (!archivo.type && /\.pdf$/i.test(archivo.name || ""));
  if (!tipoOk) return "Solo se aceptan archivos PDF.";
  if (!archivo.size) return "El PDF está vacío.";
  if (archivo.size > MAX_PDF) return "El PDF supera los 10 MB.";
  return "";
}

export async function validarPdfContenido(archivo) {
  const rapido = validarPdf(archivo);
  if (rapido) return rapido;
  try {
    const cabecera = await archivo.slice(0, 5).text();
    if (!cabecera.startsWith("%PDF")) return "El archivo no es un PDF válido.";
  } catch {}
  return "";
}

// Guardado local (modo demostración)
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

// Subir, buscar y abrir el PDF
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

export async function buscarPdfFactura(codcom) {
  if (!MODO_REAL) return null;
  try {
    const r = await consultarPdfFacturaApi(codcom);
    return r.data?.archivo_adjuntado ? { codcom: String(codcom), api: true, nombre: "factura.pdf" } : null;
  } catch { return null; }
}

export async function urlPdfFactura(adjunto) {
  if (MODO_REAL) {
    if (!adjunto?.codcom) throw new ApiError(404, "Esta factura no tiene PDF adjunto.");
    const r = await urlPdfFacturaApi(adjunto.codcom);
    if (!r.data?.url) throw new ApiError(500, "No se pudo abrir el PDF.");
    return r.data.url;
  }
  if (!adjunto?.ruta) throw new ApiError(404, "Esta factura no tiene PDF adjunto.");
  const blob = await leerLocal(adjunto.ruta);
  if (!blob) throw new ApiError(404, "El PDF se guardó en otro navegador; adjúntalo de nuevo para verlo aquí.");
  return URL.createObjectURL(blob);
}

// Recordar el adjunto
const CLAVE_ADJ = "epsa-adjuntos-factura";
export function adjuntoRecordado(codcom) {
  try { return JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}")[codcom] || null; } catch { return null; }
}
export function recordarAdjunto(codcom, adjunto) {
  try { const m = JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}"); m[codcom] = adjunto; localStorage.setItem(CLAVE_ADJ, JSON.stringify(m)); } catch {}
}
