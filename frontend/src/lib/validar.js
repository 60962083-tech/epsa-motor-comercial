/**
 * Reglas de validación compartidas por todos los formularios (web y panel).
 * Los campos numéricos solo aceptan dígitos mientras se escribe y tienen su largo exacto.
 */
export const soloDigitos = (v, max) => String(v ?? "").replace(/\D/g, "").slice(0, max);
export const soloLetras = (v, max = 80) => String(v ?? "").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]/g, "").replace(/\s{2,}/g, " ").slice(0, max);
export const soloMonto = (v) => {
  const limpio = String(v ?? "").replace(/[^\d.]/g, "");
  const [ent, ...dec] = limpio.split(".");
  return dec.length ? `${ent.slice(0, 7)}.${dec.join("").slice(0, 2)}` : ent.slice(0, 7);
};

/** Nombre de persona: solo letras y signos de nombres, con al menos 2 letras («...» o «- -» no pasan). */
export const esNombre = (v) => { const t = String(v ?? "").trim(); return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,80}$/.test(t) && (t.match(/\p{L}/gu) || []).length >= 2; };
/** Nombre y apellido: al menos dos palabras con letras. */
export const esNombreCompleto = (v) => esNombre(v) && String(v).trim().split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 2;
export const esCelular = (v) => /^9\d{8}$/.test(String(v ?? ""));
export const esDni = (v) => /^\d{8}$/.test(String(v ?? ""));
/** RUC peruano: 11 dígitos, prefijo válido y dígito verificador (módulo 11 de SUNAT). */
export const esRuc = (v) => {
  const s = String(v ?? "");
  if (!/^(10|15|17|20)\d{9}$/.test(s)) return false;
  const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, f, i) => a + f * Number(s[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 10) dv = 0; else if (dv === 11) dv = 1;
  return dv === Number(s[10]);
};
export const esCorreo = (v) => { const t = String(v ?? "").trim(); return t.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(t); };

// Fechas en hora local (Lima), no en UTC: después de las 7 p. m. toISOString() ya da la fecha de mañana.
export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoyLocal = () => fechaLocal(new Date());
export const mesLocal = () => hoyLocal().slice(0, 7);
export const sumarDias = (n, desde = new Date()) => { const d = new Date(desde); d.setDate(d.getDate() + n); return fechaLocal(d); };
/** Texto libre: sin espacios al inicio/fin ni repetidos. */
export const limpiarTexto = (v) => String(v ?? "").trim().replace(/\s+/g, " ");

export const MSJ = {
  nombre: "Escribe un nombre válido (solo letras, mínimo 3).",
  nombreCompleto: "Escribe nombre y apellido (solo letras).",
  celular: "Celular de 9 dígitos que empiece con 9.",
  dni: "El DNI debe tener 8 dígitos.",
  ruc: "RUC no válido: 11 dígitos, empieza con 10, 15, 17 o 20 y su último dígito debe ser el verificador.",
  correo: "Escribe un correo válido (ejemplo: nombre@empresa.com).",
};

// Documento de identidad: DNI 8 dígitos, CE 9 dígitos, RUC 11 dígitos.
export const DOCUMENTOS = { DNI: 8, CE: 9, RUC: 11 };
export function validarDocumento(tipo, num, obligatorio = true) {
  if (!num) return obligatorio ? `Ingresa el ${tipo}.` : "";
  if (tipo === "RUC") return esRuc(num) ? "" : MSJ.ruc;
  return num.length === DOCUMENTOS[tipo] ? "" : `El ${tipo} debe tener ${DOCUMENTOS[tipo]} dígitos.`;
}
