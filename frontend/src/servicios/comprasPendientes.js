// HU-023 · Consultar compras pendientes de identificación o recepción (solo lectura)
// Hoy se calcula con las compras de la API (HU-034) y las motos de este navegador.
// Al conectar con la base: GET /api/compras/pendientes → { porIdentificar: [...], porRecibir: [...] }
// con días de espera y motos faltantes, calculado en el servidor.
import { diasEntre } from "../lib/validar";

export const tonoEspera = (dias) => (dias > 7 ? "rojo" : dias > 3 ? "ambar" : "gris");
export const textoEspera = (dias) => (dias <= 0 ? "Hoy" : dias === 1 ? "1 día" : `${dias} días`);

export function pendientesDeCompras(compras = [], unidades = []) {
  const porIdentificar = compras.filter((c) => c.estcom !== "Identificada").map((c) => {
    const sinFactura = c.estcom === "Pendiente de factura";
    const faltan = sinFactura ? Number(c.cancom) || 0 : Number(c.cantidad_pendiente) || 0;
    return { ...c, falta: sinFactura ? "Factura de Crosland" : `Series de ${faltan} moto${faltan === 1 ? "" : "s"}`, accion: sinFactura ? "Adjuntar factura" : "Identificar motos", faltan, espera: c.feccom ? diasEntre(c.feccom) : 0 };
  }).sort((a, b) => b.espera - a.espera);
  const porRecibir = unidades.filter((u) => !u.ubicacion && u.disponibilidad !== "Vendida").map((u) => {
    const desde = (u.historial || []).map((h) => h.fecha).sort()[0] || "";
    return { ...u, desde, espera: desde ? diasEntre(desde) : 0, compra: compras.find((c) => String(c.codcom) === String(u.codcom)) || null };
  }).sort((a, b) => b.espera - a.espera);
  return { porIdentificar, porRecibir };
}
