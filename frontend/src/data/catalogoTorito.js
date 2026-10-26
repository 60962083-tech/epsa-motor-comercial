// Información oficial de torito.pe de cada modelo (HU-036)
// Precio, colores, descripción, ficha técnica completa (motor, combustible, chasis, consumo, dimensiones,
// sistema eléctrico) y fotos oficiales. La herramienta «Traer información de torito.pe» (Modelos) la guarda en
// la base con la API de modelos; la web de clientes muestra siempre lo que está en la base.
import { MODELOS } from "./mockData";
import { fichaATexto } from "../lib/fichaModelo";

const https = (u) => /^https:\/\//i.test(String(u || ""));

export const CATALOGO_TORITO = MODELOS.map((m) => {
  const colorFoto = m.colorFoto || m.colores?.[0] || "Rojo";
  // Foto de cada color: la principal en su color y las demás oficiales
  const fotosColor = { ...(https(m.imagen) ? { [colorFoto]: m.imagen } : {}), ...Object.fromEntries(Object.entries(m.fotosColor || {}).filter(([, u]) => https(u))) };
  const ficha = fichaATexto({ ...m, colorFoto, fotosColor });
  return {
    nombre: m.nombre,
    precio: Number(m.precioDesde) || null,
    colores: [...(m.colores || [])],
    descripcion: m.descripcion || "",
    ficha,
    datos: ficha.split("\n").filter((l) => /^[^:]+:\s*\S/.test(l) && !/:\s*https:\/\//.test(l)).length,
    // Foto principal primero y luego la de cada color, sin repetir
    fotos: [...new Set([m.imagen, ...Object.values(m.fotosColor || {})].filter(https))],
  };
});
