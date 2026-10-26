// Modelos: unir los de Supabase con el catálogo de la web
import { esFichaCompleta, textoAFicha } from "./fichaModelo";
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

// Modelo tal como viene de la API (HU-036): toda su información sale de la base
// Precio (premod), colores, descripción (desmod), fotos (imagenes) y la ficha técnica completa de carmod.
// Si carmod todavía tiene el formato corto, familia, motor y combustible se deducen del nombre.
const FAMILIA_TMO = { 2: "Motores 2 Tiempos", 3: "Motores 4 Válvulas", 4: "Motores Crom Plus" };
export function modeloDesdeApi(a, idsOcupados = new Set()) {
  const nombre = String(a.nommod || "").trim();
  const ficha = textoAFicha(a.carmod);
  const g = ficha.generales;
  const pares = [...Object.entries(ficha.resumen), ...ficha.specs.motor];
  const dato = (re) => pares.find(([k]) => re.test(k))?.[1] || "";
  const textoComb = `${g.combustible || dato(/combustible/i)} ${nombre}`;
  const combustible = /\bglp\b/i.test(textoComb) ? "GLP" : /\bgnv\b/i.test(textoComb) ? "GNV" : /gasolina|\bgsl\b/i.test(textoComb) ? "Gasolina" : g.combustible || "Por confirmar";
  const motor = dato(/^motor/i);
  const tipoMotor = g.tipoMotor || (/2\s*tiempos|\b2t\b/i.test(`${motor} ${nombre}`) ? "2 tiempos" : /4\s*tiempos|\b4v\b|v[aá]lvulas/i.test(`${motor} ${nombre}`) ? "4 tiempos" : "Por confirmar");
  const familia = g.familia || FAMILIA_TMO[a.codtmo] || (/crom/i.test(nombre) ? "Motores Crom Plus" : /\b2t\b|2\s*tiempos/i.test(nombre) ? "Motores 2 Tiempos" : /\b4v\b|v[aá]lvulas/i.test(nombre) ? "Motores 4 Válvulas" : "Otros modelos");
  const resumen = Object.keys(ficha.resumen).length ? ficha.resumen
    : Object.fromEntries([["Motor", motor], ["Cilindrada", dato(/cilindrada/i)], ["Llantas", dato(/llanta|neum/i)], ["Potencia", dato(/potencia/i)], ["Torque", dato(/torque/i)]].filter(([, v]) => v));
  const fotos = [...(a.imagenes || [])].filter((i) => i.estimo !== false).sort((x, y) => (x.ordimo ?? 0) - (y.ordimo ?? 0)).map((i) => i.urlimo).filter(Boolean);
  const colores = Array.isArray(a.colores) ? a.colores : [];
  const colorFoto = g.colorFoto || colores[0] || "";
  // Foto oficial de la ficha (la de su color); si el equipo sube otra como principal, la web la muestra tal cual
  const oficial = ficha.fotosColor[colorFoto] || Object.values(ficha.fotosColor)[0] || fotos[0] || "";
  let id = slugModelo(nombre) || `modelo-${a.codmod}`;
  if (idsOcupados.has(id)) id = `${id}-${a.codmod}`;
  return {
    id, codmod: String(a.codmod), codmodApi: String(a.codmod), nombre, marca: a.marmod || "Bajaj", familia, tipoMotor, combustible, uso: g.uso || "Pasajeros", tipoTecho: g.tipoTecho || "",
    estado: a.estmod === "Publicado" || !a.estmod ? "Publicado" : "Borrador", soloBackend: true, precioDesde: a.premod == null || a.premod === "" ? null : Number(a.premod), colores,
    badges: ficha.badges, destacados: ficha.destacados, descripcion: a.desmod || "", imagen: oficial, imagenApi: fotos[0] || undefined, fotos,
    colorFoto, fotosColor: ficha.fotosColor, resumen, specs: ficha.specs, fichaCompleta: esFichaCompleta(a.carmod),
  };
}

// Orden del catálogo: por familia y luego por precio
const ORDEN_FAMILIA = ["Motores 4 Válvulas", "Motores 2 Tiempos", "Motores Crom Plus"];
export const ordenCatalogo = (a, b) => ((ORDEN_FAMILIA.indexOf(a.familia) + 1 || 9) - (ORDEN_FAMILIA.indexOf(b.familia) + 1 || 9))
  || ((a.precioDesde ?? Infinity) - (b.precioDesde ?? Infinity)) || a.nombre.localeCompare(b.nombre);
