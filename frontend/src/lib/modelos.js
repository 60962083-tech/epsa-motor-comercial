// Modelos: unir los de Supabase con el catálogo de la web
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

// Emparejar por nombre
export function emparejarModelos(apiModelos = [], locales = []) {
  const porLocal = new Map();
  const usados = new Set();
  for (const m of locales) {
    const a = apiModelos.find((x) => !usados.has(x) && claveModelo(x.nommod) === claveModelo(m.nombre));
    if (a) { porLocal.set(m.id, a); usados.add(a); }
  }
  return { porLocal, sinFicha: apiModelos.filter((x) => !usados.has(x)) };
}

export const slugModelo = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Modelo que solo existe en Supabase
export function modeloDesdeApi(a, idsOcupados = new Set()) {
  const nombre = String(a.nommod || "").trim();
  const pares = String(a.carmod || "").split("·").map((x) => x.trim()).filter(Boolean)
    .map((x) => { const i = x.indexOf(":"); return i > 0 ? [x.slice(0, i).trim(), x.slice(i + 1).trim()] : null; })
    .filter((p) => p && p[0] && p[1]);
  const dato = (re) => pares.find(([k]) => re.test(k))?.[1] || "";
  const textoComb = `${dato(/combustible/i)} ${nombre}`;
  const combustible = /\bglp\b/i.test(textoComb) ? "GLP" : /\bgnv\b/i.test(textoComb) ? "GNV" : /gasolina|\bgsl\b/i.test(textoComb) ? "Gasolina" : dato(/combustible/i) || "Por confirmar";
  const motor = dato(/^motor/i);
  const tipoMotor = /2\s*tiempos|\b2t\b/i.test(`${motor} ${nombre}`) ? "2 tiempos" : /4\s*tiempos|\b4v\b|v[aá]lvulas/i.test(`${motor} ${nombre}`) ? "4 tiempos" : "Por confirmar";
  const familia = /crom/i.test(nombre) ? "Motores Crom Plus" : /\b2t\b|2\s*tiempos/i.test(nombre) ? "Motores 2 Tiempos" : /\b4v\b|v[aá]lvulas/i.test(nombre) ? "Motores 4 Válvulas" : "Otros modelos";
  const resumen = Object.fromEntries([["Motor", motor], ["Cilindrada", dato(/cilindrada/i)], ["Llantas", dato(/llanta|neum/i)], ["Potencia", dato(/potencia/i)], ["Torque", dato(/torque/i)]].filter(([, v]) => v));
  const fotos = [...(a.imagenes || [])].sort((x, y) => (x.ordimo ?? 0) - (y.ordimo ?? 0)).map((i) => i.urlimo).filter(Boolean);
  let id = slugModelo(nombre) || `modelo-${a.codmod}`;
  if (idsOcupados.has(id)) id = `${id}-${a.codmod}`;
  return {
    id, codmod: String(a.codmod), codmodApi: String(a.codmod), nombre, marca: a.marmod || "Bajaj", familia, tipoMotor, combustible, uso: "Pasajeros",
    estado: a.estmod === "Publicado" || !a.estmod ? "Publicado" : "Borrador", soloBackend: true, precioDesde: a.premod == null ? null : Number(a.premod), colores: Array.isArray(a.colores) ? a.colores : [], badges: [], destacados: [],
    descripcion: a.desmod || "", imagen: fotos[0] || "", imagenApi: fotos[0] || undefined, fotos,
    resumen, specs: { motor: pares, chasis: [], consumo: [], dimensiones: [], electrico: [] },
  };
}
