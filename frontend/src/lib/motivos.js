// HU-003 · Motivo del traslado
// El motivo viaja en la observación del movimiento («Motivo: … · Detalle: …») porque la API de movimientos solo
// recibe obsmub; la base (docs/supabase-sprint2-mejoras.sql) lo separa, lo valida y lo guarda en
// movimientoubicacion.codmtr y .detmub. Si ese SQL aún no está, el panel usa esta misma lista.
export const MOTIVOS_TRASLADO = [
  { nombre: "Mantenimiento o reparación en taller", detalleObligatorio: false },
  { nombre: "Traslado por venta a otra sede", detalleObligatorio: false },
  { nombre: "Reposición de stock en una sede", detalleObligatorio: false },
  { nombre: "Instalación de techo o preparación", detalleObligatorio: false },
  { nombre: "Exhibición o evento", detalleObligatorio: false },
  { nombre: "Garantía con Crosland", detalleObligatorio: false },
  { nombre: "Devolución al almacén", detalleObligatorio: false },
  { nombre: "Otro", detalleObligatorio: true },
];
const PREFIJO = "Motivo: ";
const SEPARADOR = " · Detalle: ";
export const MAX_DETALLE_MOTIVO = 400;

// Texto que se envía como observación del traslado
export const observacionConMotivo = (motivo, detalle) => `${PREFIJO}${motivo}${detalle ? `${SEPARADOR}${detalle}` : ""}`;

// Motivo y detalle de un traslado a partir de su observación (los traslados antiguos no tienen motivo)
export function leerMotivo(observacion) {
  const t = String(observacion || "").trim();
  if (!t.startsWith(PREFIJO)) return { motivo: "", detalle: t };
  const resto = t.slice(PREFIJO.length);
  const i = resto.indexOf(SEPARADOR);
  return i < 0 ? { motivo: resto, detalle: "" } : { motivo: resto.slice(0, i), detalle: resto.slice(i + SEPARADOR.length) };
}
