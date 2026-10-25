// Catálogo oficial de torito.pe (precio, colores y fotos de cada modelo)
// Es la ficha pública de cada Torito en torito.pe. La herramienta «Traer datos de torito.pe» (Modelos, HU-036)
// la guarda en la base con la API del panel; la web de clientes muestra siempre lo que está en la base.
import { MODELOS } from "./mockData";
export { claveModelo } from "../lib/modelos";

const https = (u) => (/^https:\/\//i.test(String(u || "")) ? u : null);

export const CATALOGO_TORITO = MODELOS.map((m) => ({
  nombre: m.nombre,
  precio: Number(m.precioDesde) || null,
  colores: [...(m.colores || [])],
  // Foto principal primero y luego la de cada color, sin repetir
  fotos: [...new Set([https(m.imagen), ...Object.values(m.fotosColor || {}).map(https)].filter(Boolean))],
}));
