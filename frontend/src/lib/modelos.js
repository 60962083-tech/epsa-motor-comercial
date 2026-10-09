/**
 * Emparejar los modelos de Supabase (GET /api/modelos) con el catálogo de la web.
 * La web tiene precio, colores y ficha técnica; Supabase decide qué modelos están publicados.
 * Se compara por nombre de forma tolerante (mayúsculas, tildes, espacios, «Torito», «4 válvulas» = «4V»…).
 */
export const claveModelo = (t) =>
  String(t || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(torito|bajaj|motocar|mototaxi)\b/g, " ")
    .replace(/gasolina/g, "gsl")
    .replace(/4\s*valvulas?/g, "4v")
    .replace(/2\s*tiempos/g, "2t")
    .replace(/\bug\b/g, " ")
    .replace(/[^a-z0-9]/g, "");

/**
 * Devuelve { porLocal: Map(idLocal → modeloApi), sinFicha: modelosApi que la web no conoce }.
 * Solo por nombre: los códigos de Supabase no corresponden a los del catálogo de la web
 * (por ejemplo, el código 1 de Supabase puede ser «Modelo prueba 1» y no el «Torito 4V GSL»).
 */
export function emparejarModelos(apiModelos = [], locales = []) {
  const porLocal = new Map();
  const usados = new Set();
  for (const m of locales) {
    const a = apiModelos.find((x) => !usados.has(x) && claveModelo(x.nommod) === claveModelo(m.nombre));
    if (a) { porLocal.set(m.id, a); usados.add(a); }
  }
  return { porLocal, sinFicha: apiModelos.filter((x) => !usados.has(x)) };
}
