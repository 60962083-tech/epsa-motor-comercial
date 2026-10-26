// HU-036 · Ficha completa del modelo dentro de la API
// Toda la información de la moto viaja en la misma API de modelos (GET/PUT /api/modelos): nombre, precio
// (premod), colores, descripción (desmod), fotos (imagenes) y la ficha técnica en carmod como texto legible
// por secciones. El panel la escribe y la web la lee de vuelta, sin depender de datos guardados en el front.
//
// Formato de carmod (una línea por dato, una sección por bloque):
//   Familia: Motores 4 Válvulas
//   Tipo de motor: 4 tiempos
//   Combustible: Gasolina
//   ...
//   Destacados
//   - Motor 4 válvulas de 236.2 cc
//   Resumen
//   Potencia: 10.73 HP
//   Motor
//   Cilindrada: 236.2 cc
//   ...
//   Fotos por color
//   Azul: https://...

// ---------------------------------------------------------------------------------------------
// Secciones y datos generales
// ---------------------------------------------------------------------------------------------
export const SECCIONES_FICHA = [
  { id: "motor", titulo: "Motor" },
  { id: "chasis", titulo: "Chasis y Carrocería" },
  { id: "consumo", titulo: "Consumo y Rendimiento" },
  { id: "dimensiones", titulo: "Dimensiones" },
  { id: "electrico", titulo: "Sistema eléctrico" },
];
const GENERALES = [
  ["familia", "Familia"], ["tipoMotor", "Tipo de motor"], ["combustible", "Combustible"], ["uso", "Uso"],
  ["tipoTecho", "Techo"], ["colorFoto", "Color de la foto"], ["paginaTorito", "Página en torito.pe"],
];
const RESUMEN = ["Motor", "Cilindrada", "Llantas", "Potencia", "Torque"];
const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const limpio = (t) => String(t ?? "").replace(/\s+/g, " ").trim();
const par = (linea) => { const i = linea.indexOf(":"); return i > 0 ? [limpio(linea.slice(0, i)), limpio(linea.slice(i + 1))] : null; };

// ---------------------------------------------------------------------------------------------
// Ficha → texto de carmod
// ---------------------------------------------------------------------------------------------
export function fichaATexto(m = {}) {
  const b = [];
  for (const [k, t] of GENERALES) if (limpio(m[k])) b.push(`${t}: ${limpio(m[k])}`);
  if ((m.badges || []).length) b.push(`Etiquetas: ${m.badges.map(limpio).filter(Boolean).join(", ")}`);
  const bloque = (titulo, lineas) => { if (lineas.length) b.push("", titulo, ...lineas); };
  bloque("Destacados", (m.destacados || []).map(limpio).filter(Boolean).map((d) => `- ${d}`));
  bloque("Resumen", Object.entries(m.resumen || {}).filter(([, v]) => limpio(v)).map(([k, v]) => `${limpio(k)}: ${limpio(v)}`));
  for (const s of SECCIONES_FICHA) bloque(s.titulo, (m.specs?.[s.id] || []).filter(([k, v]) => limpio(k) && limpio(v)).map(([k, v]) => `${limpio(k)}: ${limpio(v)}`));
  bloque("Fotos por color", Object.entries(m.fotosColor || {}).filter(([, u]) => /^https:\/\//i.test(String(u || ""))).map(([c, u]) => `${limpio(c)}: ${String(u).trim()}`));
  return b.join("\n").trim();
}

// ¿El carmod ya trae la ficha completa por secciones?
export const esFichaCompleta = (t) => /\n/.test(String(t || "")) && /^(familia|tipo de motor|combustible)\s*:/im.test(String(t || ""));

// ---------------------------------------------------------------------------------------------
// Texto de carmod → ficha (también entiende el formato corto «Motor: x · Cilindrada: y»)
// ---------------------------------------------------------------------------------------------
export function textoAFicha(texto) {
  const ficha = { generales: {}, badges: [], destacados: [], resumen: {}, specs: Object.fromEntries(SECCIONES_FICHA.map((s) => [s.id, []])), fotosColor: {} };
  const t = String(texto || "").trim();
  if (!t) return ficha;

  // Formato corto de una sola línea: cada par va al resumen y a la pestaña Motor
  if (!t.includes("\n")) {
    for (const p of t.split("·").map(par).filter((x) => x && x[0] && x[1])) {
      const k = RESUMEN.find((r) => sinTildes(r) === sinTildes(p[0]));
      if (k) ficha.resumen[k] = p[1];
      if (/^combustible$/i.test(p[0])) ficha.generales.combustible = p[1];
      ficha.specs.motor.push(p);
    }
    return ficha;
  }

  const porTitulo = new Map([
    ["destacados", "destacados"], ["resumen", "resumen"], ["fotos por color", "fotos"],
    ...SECCIONES_FICHA.map((s) => [sinTildes(s.titulo), s.id]),
    ["chasis", "chasis"], ["consumo", "consumo"], ["consumo y rendimiento", "consumo"], ["sistema electrico", "electrico"], ["electrico", "electrico"],
  ]);
  const generales = new Map(GENERALES.map(([k, titulo]) => [sinTildes(titulo), k]));
  let seccion = null;
  for (const bruta of t.split("\n")) {
    const linea = bruta.trim();
    if (!linea) continue;
    const titulo = porTitulo.get(sinTildes(linea.replace(/:$/, "")));
    if (titulo && !/:\s*\S/.test(linea)) { seccion = titulo; continue; }
    if (seccion === "destacados") { const d = limpio(linea.replace(/^[-•*]\s*/, "")); if (d) ficha.destacados.push(d); continue; }
    const p = par(linea);
    if (!p || !p[1]) continue;
    if (!seccion) {
      const k = generales.get(sinTildes(p[0]));
      if (k) ficha.generales[k] = p[1];
      else if (sinTildes(p[0]) === "etiquetas") ficha.badges = p[1].split(",").map(limpio).filter(Boolean);
      continue;
    }
    if (seccion === "resumen") ficha.resumen[p[0]] = p[1];
    else if (seccion === "fotos") { if (/^https:\/\//i.test(p[1])) ficha.fotosColor[p[0]] = p[1]; }
    else ficha.specs[seccion].push(p);
  }
  return ficha;
}
