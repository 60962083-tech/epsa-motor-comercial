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

export const esNombre = (v) => /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,80}$/.test(String(v ?? "").trim());
export const esCelular = (v) => /^9\d{8}$/.test(String(v ?? ""));
export const esDni = (v) => /^\d{8}$/.test(String(v ?? ""));
export const esRuc = (v) => /^(10|15|17|20)\d{9}$/.test(String(v ?? ""));
export const esCorreo = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? "").trim());

export const MSJ = {
  nombre: "Escribe un nombre válido (solo letras, mínimo 3).",
  celular: "Celular de 9 dígitos que empiece con 9.",
  dni: "El DNI debe tener 8 dígitos.",
  ruc: "RUC de 11 dígitos (empieza con 10 o 20).",
  correo: "Escribe un correo válido.",
};

// Documento de identidad: DNI 8 dígitos, CE 9 dígitos, RUC 11 dígitos.
export const DOCUMENTOS = { DNI: 8, CE: 9, RUC: 11 };
export function validarDocumento(tipo, num, obligatorio = true) {
  if (!num) return obligatorio ? `Ingresa el ${tipo}.` : "";
  if (tipo === "RUC") return esRuc(num) ? "" : MSJ.ruc;
  return num.length === DOCUMENTOS[tipo] ? "" : `El ${tipo} debe tener ${DOCUMENTOS[tipo]} dígitos.`;
}
