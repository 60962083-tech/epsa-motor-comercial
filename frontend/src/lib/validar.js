// Limpiar lo que se escribe
// Validaciones de formularios
export const soloDigitos = (v, max) => String(v ?? "").replace(/\D/g, "").slice(0, max);
export const soloLetras = (v, max = 80) => String(v ?? "").replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]/g, "").replace(/\s{2,}/g, " ").slice(0, max);
export const soloMonto = (v) => {
  const limpio = String(v ?? "").replace(/[^\d.]/g, "");
  const [ent, ...dec] = limpio.split(".");
  return dec.length ? `${ent.slice(0, 7)}.${dec.join("").slice(0, 2)}` : ent.slice(0, 7);
};

// Nombre, celular, RUC y correo
export const esNombre = (v) => { const t = String(v ?? "").trim(); return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]{3,80}$/.test(t) && (t.match(/\p{L}/gu) || []).length >= 2; };
export const esNombreCompleto = (v) => esNombre(v) && String(v).trim().split(/\s+/).filter((w) => /\p{L}{2,}/u.test(w)).length >= 2;
// Nombres de personas (Sprint 2 y cuentas del equipo): solo letras y espacios, sin números ni símbolos
const LETRAS = "A-Za-zÁÉÍÓÚÜÑáéíóúüñ";
export const soloLetrasNombre = (v, max = 60) => String(v ?? "").replace(new RegExp(`[^${LETRAS} ]`, "g"), "").replace(/\s{2,}/g, " ").replace(/^\s+/, "").slice(0, max);
export const esNombrePersona = (v, min = 2) => { const t = String(v ?? "").trim().replace(/\s+/g, " "); return t.length >= min && t.length <= 80 && new RegExp(`^[${LETRAS}]+( [${LETRAS}]+)*$`).test(t); };
export const esNombreYApellido = (v) => esNombrePersona(v, 5) && String(v).trim().split(/\s+/).filter((w) => w.length >= 2).length >= 2;
export const esCelular = (v) => /^9\d{8}$/.test(String(v ?? ""));
export const esRuc = (v) => {
  const s = String(v ?? "");
  if (!/^(10|15|17|20)\d{9}$/.test(s)) return false;
  const suma = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2].reduce((a, f, i) => a + f * Number(s[i]), 0);
  let dv = 11 - (suma % 11);
  if (dv === 10) dv = 0; else if (dv === 11) dv = 1;
  return dv === Number(s[10]);
};
export const esCorreo = (v) => { const t = String(v ?? "").trim(); return t.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(t); };

// Teléfono de contacto: celular (9 dígitos, empieza con 9) o fijo con código: 01 + 7 dígitos (Lima) o 0XX + 6 dígitos (provincias)
export const esTelefono = (v) => /^(9\d{8}|01\d{7}|0[4-8]\d{7})$/.test(String(v ?? ""));
export const limpiarTelefono = (v) => String(v ?? "").replace(/\D/g, "").replace(/^51(?=9\d{8}$)/, "");
export function formatoTelefono(v) {
  const t = limpiarTelefono(v);
  if (/^9\d{8}$/.test(t)) return `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;
  if (/^01\d{7}$/.test(t)) return `(01) ${t.slice(2, 5)} ${t.slice(5)}`;
  if (/^0\d{8}$/.test(t)) return `(${t.slice(0, 3)}) ${t.slice(3, 6)} ${t.slice(6)}`;
  return t;
}

// EMT-97 · Contacto de una ubicación: opcional y guardado como texto (conserva +, ceros y separadores).
// Mismas reglas que la API: hasta 30 caracteres, solo números, espacios, guiones, paréntesis y un + inicial, de 6 a 15 dígitos.
export function validarContacto(v) {
  const valor = String(v ?? "").trim().replace(/\s+/g, " ");
  if (!valor) return { valor: "", error: "" };
  if ([...valor].length > 30) return { valor, error: "El contacto admite hasta 30 caracteres." };
  if (!/^\+?[0-9() -]+$/.test(valor)) return { valor, error: "Solo números, espacios, guiones, paréntesis y un + al inicio." };
  const n = valor.replace(/\D/g, "").length;
  if (n < 6 || n > 15) return { valor, error: "El número debe tener entre 6 y 15 dígitos." };
  return { valor, error: "" };
}

// Documento de identidad: DNI (8), carné de extranjería (9) o RUC (11 con dígito verificador)
export const DOCUMENTOS = { DNI: 8, CE: 9, RUC: 11 };
export function validarDocumento(tipo, num) {
  const n = String(num ?? "");
  const largo = DOCUMENTOS[tipo];
  if (!largo) return "Elige el tipo de documento.";
  if (!n) return `Ingresa el ${tipo}.`;
  if (!/^\d+$/.test(n)) return "Solo números.";
  if (n.length !== largo) return `El ${tipo} tiene ${largo} dígitos.`;
  if (tipo === "RUC" && !esRuc(n)) return MSJ.ruc;
  if (/^(\d)\1+$/.test(n)) return `Ese ${tipo} no es válido.`;
  return "";
}

// Fechas en hora de Lima
export const fechaLocal = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const hoyLocal = () => fechaLocal(new Date());
export const mesLocal = () => hoyLocal().slice(0, 7);
export const sumarDias = (n, desde = new Date()) => { const d = new Date(desde); d.setDate(d.getDate() + n); return fechaLocal(d); };
export const limpiarTexto = (v) => String(v ?? "").trim().replace(/\s+/g, " ");
// Días entre dos fechas (YYYY-MM-DD o ISO), contando en hora de Lima
const soloFecha = (f) => (String(f).length > 10 ? fechaLocal(new Date(f)) : String(f));
export const diasEntre = (desde, hasta = hoyLocal()) => Math.round((new Date(`${soloFecha(hasta)}T00:00:00`) - new Date(`${soloFecha(desde)}T00:00:00`)) / 86400000);
// Fecha y hora legibles: "17 oct, 10:20"
export function fechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-PE", { day: "numeric", month: "short" }).replace(".", "")}, ${d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}
export function fechaLarga(f) {
  if (!f) return "";
  const d = new Date(String(f).length > 10 ? f : `${f}T12:00:00`);
  return d.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
}
// "hace 5 min", "hace 2 h", "hace 3 días"
export function haceCuanto(iso, ahora = Date.now()) {
  if (!iso) return "";
  const min = Math.max(0, Math.round((ahora - new Date(iso).getTime()) / 60000));
  if (min < 1) return "hace un momento";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hace 1 día" : `hace ${d} días`;
}

// Mensajes de error
export const MSJ = {
  nombre: "Escribe un nombre válido (solo letras, mínimo 3).",
  nombreCompleto: "Escribe nombre y apellido (solo letras).",
  celular: "Celular de 9 dígitos que empiece con 9.",
  ruc: "RUC no válido: 11 dígitos, empieza con 10, 15, 17 o 20 y su último dígito debe ser el verificador.",
  correo: "Escribe un correo válido (ejemplo: nombre@empresa.com).",
  telefono: "Celular de 9 dígitos que empiece con 9, o teléfono fijo con su código (01 y 7 dígitos en Lima).",
};
