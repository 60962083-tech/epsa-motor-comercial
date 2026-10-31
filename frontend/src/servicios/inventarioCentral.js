// HU-001 · Lectura del inventario central: textos, estados y filtros de cada unidad
// Ubicación, preparación y situación comercial se muestran por separado: ninguna se deduce de otra.

export const TIPO_LUGAR = { Sede: "Sede", Almacen: "Almacén", Proveedor: "Fibrera o proveedor" };
export const GRUPOS_LUGAR_API = [
  { tipo: "Sede", titulo: "Sedes" },
  { tipo: "Almacen", titulo: "Almacenes" },
  { tipo: "Proveedor", titulo: "Fibreras y proveedores de techo" },
];
export const TONO_COMERCIAL = { Libre: "verde", "No disponible": "gris", Separada: "ambar", Vendida: "oscuro" };

// Dónde está la moto (y si va en camino o tiene un traslado programado)
export function ubicacionDe(u) {
  const mov = u?.movimiento_activo;
  if (mov?.estado === "En transito") return { texto: `En tránsito a ${mov.destino?.nomubi || "otra ubicación"}`, detalle: `Salió de ${mov.origen?.nomubi || "su ubicación"}`, transito: true, lugar: u.ubicacion };
  if (!u?.ubicacion) return { texto: "Sin ubicación registrada", detalle: "Falta registrar dónde está", sin: true };
  if (mov?.estado === "Pendiente") return { texto: u.ubicacion.nomubi, detalle: `Traslado programado a ${mov.destino?.nomubi}`, programado: true, lugar: u.ubicacion };
  return { texto: u.ubicacion.nomubi, detalle: TIPO_LUGAR[u.ubicacion.tipubi] || u.ubicacion.tipubi, lugar: u.ubicacion };
}

// Techo: configuración (HU-004) y avance de su instalación (HU-033), por separado
export function techoDe(p) {
  const t = p?.techo || {};
  const config = t.configuracion || "Por definir";
  const avance = t.avance || "Por definir";
  return {
    config, proveedor: t.proveedor || "", detalle: t.detalle || "", avance,
    requiereInstalacion: !["Por definir", "No requiere"].includes(avance),
    conTecho: Boolean(t.configuracion && t.configuracion !== "Sin techo"),
  };
}

// Etapa de preparación visible
export function preparacionDe(p) {
  if (!p) return { etapa: "Sin datos", tono: "gris", nota: "" };
  // Inventario central: el estado de preparación viene tal cual de la base (HU-004)
  if (p.central && p.operativa) return etapaOperativa(p.operativa);
  if (p.central) return p.estado ? { etapa: p.estado, tono: p.lista_para_entrega ? "verde" : "celeste", nota: "" } : { etapa: "Sin registrar", tono: "gris", nota: "" };
  if (p.lista_para_entrega) return { etapa: "Lista para entrega", tono: "verde", nota: "Preparación terminada. No equivale a entregada al comprador." };
  if (p.armado !== "Armado terminado") return { etapa: "Pendiente de armado", tono: "ambar", nota: (p.pendientes || []).join(". ") };
  const t = techoDe(p);
  if (t.avance === "Por definir") return { etapa: "Techo por definir", tono: "ambar", nota: "Armado terminado. Falta elegir la configuración de techo." };
  if (t.avance === "Pendiente" || t.avance === "En proceso") return { etapa: t.avance === "Pendiente" ? "Falta instalar techo" : "Techo en proceso", tono: "celeste", nota: `${t.config}${t.proveedor ? ` (${t.proveedor})` : ""}` };
  if (p.condiciones_cumplidas) return { etapa: "Por confirmar entrega", tono: "celeste", nota: "Cumple las condiciones: falta marcarla lista para entrega." };
  return { etapa: p.etapa || "Pendiente", tono: "gris", nota: (p.pendientes || []).join(". ") };
}

export const ETAPAS_FILTRO = ["Pendiente de armado", "Techo por definir", "Falta instalar techo", "Techo en proceso", "Por confirmar entrega", "Lista para entrega"];
// Con la base central (HU-033 de Michelle) la entrega no se marca a mano: está lista cuando se cumplen sus etapas
export const ETAPAS_FILTRO_CENTRAL = ["Pendiente de armado", "Techo por definir", "Falta instalar techo", "Techo en proceso", "Lista para entrega"];

// HU-033 · Etapa visible a partir de la preparación guardada (armado, techo y condiciones que faltan)
export function etapaOperativa(po) {
  if (!po) return { etapa: "Sin registrar", tono: "gris", nota: "" };
  const t = po.techo || {};
  const nota = (po.condicionesFaltantes || []).join(". ");
  if (po.preparacionCompleta) return { etapa: "Lista para entrega", tono: "verde", nota: "Cumple todas las etapas. No equivale a entregada al comprador." };
  if (po.armado !== "Terminado") return { etapa: "Pendiente de armado", tono: "ambar", nota };
  if (!t.configuracion) return { etapa: "Techo por definir", tono: "ambar", nota };
  if (t.estado === "En proceso") return { etapa: "Techo en proceso", tono: "celeste", nota };
  if (t.requiereInstalacion && t.estado !== "Instalado") return { etapa: "Falta instalar techo", tono: "celeste", nota };
  return { etapa: "Revisar techo", tono: "ambar", nota };
}
// Preparación de la base central en la forma que usan las pantallas
export function preparacionDesdeOperativa(po, nomtte) {
  const e = etapaOperativa(po);
  const t = po?.techo || {};
  const config = t.configuracion || nomtte || "";
  return {
    central: true, operativa: po, estado: e.etapa, nota: e.nota, lista_para_entrega: Boolean(po?.preparacionCompleta),
    armado: po?.armado === "Terminado" ? "Armado terminado" : "Pendiente de armado",
    techo: { configuracion: config, avance: config ? t.estado || "Pendiente" : "Por definir", proveedor: po?.proveedorTecho || "", detalle: po?.detalleTecho || "" },
  };
}

export const FILTRO_INICIAL = { color: "", techo: "", prep: "", comercial: "activas", q: "" };

// Filtros que se aplican sobre la lectura central (ubicación y modelo se piden al servidor)
export function filtrarUnidades(lista = [], f = FILTRO_INICIAL) {
  const q = String(f.q || "").trim().toLowerCase();
  return lista.filter((u) => {
    const t = techoDe(u.preparacion);
    if (f.color && String(u.coluni).toLowerCase() !== f.color.toLowerCase()) return false;
    if (f.techo === "sin" && t.config !== "Sin techo") return false;
    if (f.techo === "con" && !t.conTecho) return false;
    if (f.techo === "definir" && t.config !== "Por definir") return false;
    if (f.prep && preparacionDe(u.preparacion).etapa !== f.prep) return false;
    if (f.comercial === "activas" && u.comercial === "Vendida") return false;
    if (f.comercial && f.comercial !== "activas" && u.comercial !== f.comercial) return false;
    if (q && !`${u.coduni} ${u.nummotuni} ${u.chauni} ${u.nommod}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

// Conteo por clave
// Modelos para el filtro Modelo: salen de las motos del inventario (no del catálogo de la web), así también
// aparecen los modelos retirados de la web que aún tienen motos. Cada uno con su cantidad (cuenta). El modelo
// elegido se mantiene en la lista aunque con otro filtro quede en 0, para que se vea que no hay coincidencias.
const nombresModelo = new Map();
export function modelosDeUnidades(unidades = [], seleccionado = "", cuenta = () => true) {
  const m = new Map();
  unidades.forEach((u) => {
    if (!u.codmod) return;
    nombresModelo.set(u.codmod, u.nommod);
    const x = m.get(u.codmod) || { codmod: u.codmod, nommod: u.nommod || "Modelo", n: 0 };
    if (cuenta(u)) x.n += 1;
    m.set(u.codmod, x);
  });
  if (seleccionado && !m.has(seleccionado)) m.set(seleccionado, { codmod: seleccionado, nommod: nombresModelo.get(seleccionado) || "Modelo elegido", n: 0 });
  return [...m.values()].sort((a, b) => a.nommod.localeCompare(b.nommod, "es"));
}

export const contar = (lista, fn) => lista.reduce((o, x) => { const k = fn(x); o[k] = (o[k] || 0) + 1; return o; }, {});

// Nombre corto de la moto: modelo y motor
export const nombreUnidad = (u) => `${u?.nommod || "Moto"} · motor ${u?.nummotuni || "—"}`;
