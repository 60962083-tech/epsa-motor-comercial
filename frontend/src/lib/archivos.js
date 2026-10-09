import { MODO_REAL, SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";
import { leerSesion } from "./api";
import { ApiError } from "./errores";

/**
 * Archivos adjuntos (PDF de la factura de Crosland).
 * - Conectado: se suben al almacenamiento privado de Supabase (bucket «facturas-compra»).
 *   El bucket y sus permisos se crean con docs/supabase-storage-facturas.sql.
 * - Demostración: se guardan en este navegador (IndexedDB) y, si no está disponible, en memoria.
 */
const BUCKET = "facturas-compra";
const memoria = new Map();
export const MAX_PDF = 10 * 1024 * 1024;

export function validarPdf(archivo) {
  if (!archivo) return "Elige un archivo.";
  if (archivo.type !== "application/pdf" && !/\.pdf$/i.test(archivo.name)) return "Solo se aceptan archivos PDF.";
  if (archivo.size > MAX_PDF) return "El PDF supera los 10 MB.";
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

const cabeceras = () => ({ apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${leerSesion()?.access_token || ""}` });

/** Sube el PDF y devuelve los datos que se guardan en la factura. */
export async function subirPdfFactura(codcom, archivo) {
  const error = validarPdf(archivo);
  if (error) throw new ApiError(400, error);
  const nombre = archivo.name.replace(/[^\w.-]+/g, "_");
  const ruta = `compra-${codcom}/${Date.now()}-${nombre}`;
  if (MODO_REAL) {
    let r;
    try {
      r = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${ruta}`, { method: "POST", headers: { ...cabeceras(), "Content-Type": "application/pdf", "x-upsert": "true" }, body: archivo });
    } catch { throw new ApiError(0, "No se pudo subir el PDF: sin conexión con Supabase."); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new ApiError(r.status, j.message || j.error || "No se pudo subir el PDF de la factura."); }
  } else {
    await guardarLocal(ruta, archivo);
  }
  return { ruta, nombre: archivo.name, tamano: archivo.size, fecha: new Date().toISOString().slice(0, 10) };
}

/** Conectado: busca en el almacenamiento el último PDF de la compra (lo ve cualquier usuario del panel). */
export async function buscarPdfFactura(codcom) {
  if (!MODO_REAL) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${BUCKET}`, { method: "POST", headers: { ...cabeceras(), "Content-Type": "application/json" }, body: JSON.stringify({ prefix: `compra-${codcom}/`, limit: 20, sortBy: { column: "created_at", order: "desc" } }) });
    const lista = r.ok ? await r.json() : [];
    const a = Array.isArray(lista) ? lista.find((x) => /\.pdf$/i.test(x.name)) : null;
    return a ? { ruta: `compra-${codcom}/${a.name}`, nombre: a.name.replace(/^\d+-/, ""), tamano: a.metadata?.size || 0, fecha: String(a.created_at || "").slice(0, 10) } : null;
  } catch { return null; }
}

/** Devuelve una URL para abrir o descargar el PDF guardado. */
export async function urlPdfFactura(adjunto) {
  if (!adjunto?.ruta) throw new ApiError(404, "Esta factura no tiene PDF adjunto.");
  if (MODO_REAL) {
    const r = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${adjunto.ruta}`, { method: "POST", headers: { ...cabeceras(), "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: 600 }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !j.signedURL) throw new ApiError(r?.status || 0, j.message || "No se pudo abrir el PDF.");
    return `${SUPABASE_URL}/storage/v1${j.signedURL}`;
  }
  const blob = await leerLocal(adjunto.ruta);
  if (!blob) throw new ApiError(404, "El PDF se guardó en otro navegador; adjúntalo de nuevo para verlo aquí.");
  return URL.createObjectURL(blob);
}

// Con el backend conectado, la API de compras aún no devuelve la ruta del PDF:
// se recuerda aquí (por compra) para poder volver a abrirlo desde este equipo.
const CLAVE_ADJ = "epsa-adjuntos-factura";
export function adjuntoRecordado(codcom) {
  try { return JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}")[codcom] || null; } catch { return null; }
}
export function recordarAdjunto(codcom, adjunto) {
  try { const m = JSON.parse(localStorage.getItem(CLAVE_ADJ) || "{}"); m[codcom] = adjunto; localStorage.setItem(CLAVE_ADJ, JSON.stringify(m)); } catch { /* sin almacenamiento */ }
}
