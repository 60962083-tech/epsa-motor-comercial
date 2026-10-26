// HU-036 · Traer la información oficial de torito.pe a la base (todo por la API de modelos)
// Para cada modelo de la base (su codmod real) se elige su ficha de torito.pe y se guarda con las mismas rutas
// del panel: PUT /api/modelos/:id (precio, colores, descripción y ficha técnica completa en carmod) y
// POST/PATCH /api/modelos/:id/imagenes (fotos oficiales por enlace HTTPS). No borra nada: completa lo que está
// vacío, deja la ficha técnica completa y oculta solo las fotos de torito.pe que el modelo comparte con otro.
import { useEffect, useMemo, useState } from "react";
import { CATALOGO_TORITO } from "../../data/catalogoTorito";
import { claveModelo } from "../../lib/modelos";
import { esFichaCompleta } from "../../lib/fichaModelo";
import { editarModeloApi } from "../../lib/api";
import { enlazarFotoModeloApi, estadoFotoModeloApi } from "../../servicios/central";
import { mensajeError } from "../../lib/errores";
import { formatoSoles } from "../../data/mockData";
import { Aviso, Modal } from "../ui";
import { Pill } from "./Sprint2";

const deTorito = (url) => /^https:\/\/torito\.pe\//i.test(String(url || ""));
const porNombre = (nombre) => CATALOGO_TORITO.find((o) => o.nombre === nombre) || null;
// Ficha propuesta: la de torito.pe con el mismo nombre (se puede cambiar o no vincular)
const vinculoInicial = (modelos) => Object.fromEntries(modelos.map((m) => [String(m.codmod), CATALOGO_TORITO.find((o) => claveModelo(o.nombre) === claveModelo(m.nommod))?.nombre || ""]));

// ---------------------------------------------------------------------------------------------
// Qué se guardará en cada modelo
// ---------------------------------------------------------------------------------------------
// Con «reemplazar», también se actualiza lo que ya tiene un valor distinto al de torito.pe
const igualesColores = (a = [], b = []) => a.length === b.length && a.every((c) => b.includes(c));
export function planInformacion(modelos = [], vinculo = {}, reemplazar = false) {
  const oficialDe = (m) => porNombre(vinculo[String(m.codmod)]);
  // Fotos activas en uso y foto principal oficial de cada modelo vinculado
  const usoFoto = new Map();
  for (const m of modelos) for (const i of m.imagenes || []) if (i.estimo !== false) usoFoto.set(i.urlimo, (usoFoto.get(i.urlimo) || 0) + 1);
  const principales = new Set(modelos.map((m) => oficialDe(m)?.fotos[0]).filter(Boolean));
  return modelos.map((m) => {
    const oficial = oficialDe(m);
    if (!oficial) return { m, oficial: null, datos: {}, fotos: [] };
    const datos = {};
    const sinPrecio = m.premod === null || m.premod === undefined || m.premod === "";
    if (oficial.precio && (sinPrecio || (reemplazar && Number(m.premod) !== oficial.precio))) datos.premod = oficial.precio;
    if (oficial.colores.length && (!(m.colores || []).length || (reemplazar && !igualesColores(m.colores || [], oficial.colores)))) datos.colores = oficial.colores;
    if (oficial.descripcion && (String(m.desmod || "").trim().length < 40 || (reemplazar && String(m.desmod || "").trim() !== oficial.descripcion))) datos.desmod = oficial.descripcion;
    if (!esFichaCompleta(m.carmod) || (reemplazar && String(m.carmod || "").trim() !== oficial.ficha)) datos.carmod = oficial.ficha;
    // Fotos: una oficial extra no se agrega si es la principal de otro modelo (así ninguna moto se repite)
    const fotos = [];
    const imagenes = m.imagenes || [];
    const principal = oficial.fotos[0];
    const propia = (url) => url === principal || !principales.has(url);
    if (principal) {
      for (const i of imagenes.filter((x) => x.estimo !== false && deTorito(x.urlimo) && x.urlimo !== principal)) {
        if (usoFoto.get(i.urlimo) > 1 || !propia(i.urlimo)) fotos.push({ tipo: "quitar", imagen: i });
      }
      let orden = Math.max(0, ...imagenes.map((i) => Number(i.ordimo) || 0));
      const quedanOtras = imagenes.some((i) => i.estimo !== false && i.urlimo !== principal && !fotos.some((c) => c.imagen?.codimo === i.codimo));
      for (const url of oficial.fotos.filter(propia)) {
        const existe = imagenes.find((i) => i.urlimo === url);
        if (existe && existe.estimo === false) fotos.push({ tipo: "activar", imagen: existe });
        if (!existe) fotos.push({ tipo: "foto", url, ordimo: url === principal && !quedanOtras ? 1 : ++orden });
      }
    }
    return { m, oficial, datos, fotos };
  });
}

// Lo que cambia, en pocas palabras
function resumen({ datos, fotos, oficial }) {
  const nuevas = fotos.filter((c) => c.tipo !== "quitar").length;
  const quitar = fotos.filter((c) => c.tipo === "quitar").length;
  return [
    datos.premod ? `Precio ${formatoSoles(datos.premod)}` : null,
    datos.colores ? `Colores: ${datos.colores.join(", ")}` : null,
    datos.desmod ? "Descripción" : null,
    datos.carmod ? `Ficha técnica (${oficial.datos} datos)` : null,
    nuevas ? `${nuevas} foto${nuevas === 1 ? "" : "s"} oficial${nuevas === 1 ? "" : "es"}` : null,
    quitar ? `Ocultar ${quitar} foto${quitar === 1 ? "" : "s"} repetida${quitar === 1 ? "" : "s"}` : null,
  ].filter(Boolean);
}

// ---------------------------------------------------------------------------------------------
// Ventana: revisar y guardar
// ---------------------------------------------------------------------------------------------
export default function InformacionTorito({ abierto, modelos, onClose, onHecho }) {
  const [vinculo, setVinculo] = useState({});
  const [reemplazar, setReemplazar] = useState(false);
  const [elegidos, setElegidos] = useState(null);
  const [estado, setEstado] = useState({ corriendo: false, hecho: false, resultados: {} });
  useEffect(() => { if (abierto) { setVinculo(vinculoInicial(modelos || [])); setReemplazar(false); setElegidos(null); setEstado({ corriendo: false, hecho: false, resultados: {} }); } }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const plan = useMemo(() => (abierto ? planInformacion(modelos || [], vinculo, reemplazar) : []), [abierto, modelos, vinculo, reemplazar]);
  const conCambios = plan.filter((p) => Object.keys(p.datos).length || p.fotos.length);
  const marcados = elegidos ?? new Set(conCambios.map((p) => String(p.m.codmod)));
  if (!abierto) return null;

  function alternar(codmod) {
    const s = new Set(marcados);
    if (s.has(codmod)) s.delete(codmod); else s.add(codmod);
    setElegidos(s);
  }

  async function aplicar() {
    setEstado({ corriendo: true, hecho: false, resultados: {} });
    const resultados = {};
    for (const p of conCambios.filter((x) => marcados.has(String(x.m.codmod)))) {
      const id = String(p.m.codmod);
      try {
        if (Object.keys(p.datos).length) await editarModeloApi(id, p.datos);
        // Primero las fotos oficiales nuevas y después se ocultan las repetidas: el modelo nunca queda sin foto
        for (const c of p.fotos.filter((x) => x.tipo === "foto")) await enlazarFotoModeloApi(id, c.url, c.ordimo);
        for (const c of p.fotos.filter((x) => x.tipo === "activar")) await estadoFotoModeloApi(id, c.imagen.codimo, true);
        for (const c of p.fotos.filter((x) => x.tipo === "quitar")) await estadoFotoModeloApi(id, c.imagen.codimo, false);
        resultados[id] = { ok: true };
      } catch (e) { resultados[id] = { ok: false, error: mensajeError(e) }; }
      setEstado({ corriendo: true, hecho: false, resultados: { ...resultados } });
    }
    setEstado({ corriendo: false, hecho: true, resultados });
    onHecho?.();
  }

  const fallas = Object.values(estado.resultados).filter((r) => !r.ok).length;
  const bloqueado = estado.corriendo || estado.hecho;
  return (
    <Modal abierto onClose={estado.corriendo ? () => {} : onClose} titulo="Traer información de torito.pe" ancho="max-w-3xl" sinAvisoCambios confirmarGuardar={false}
      pie={estado.hecho
        ? <button className="btn btn-primary !py-2" onClick={onClose}>Listo</button>
        : <><button className="btn btn-secondary !py-2" onClick={onClose} disabled={estado.corriendo}>Cancelar</button>
          <button className="btn btn-primary !py-2" onClick={aplicar} disabled={estado.corriendo || !conCambios.some((p) => marcados.has(String(p.m.codmod)))} data-aplicar-torito>{estado.corriendo ? "Guardando…" : `Guardar en ${conCambios.filter((p) => marcados.has(String(p.m.codmod))).length} modelo${conCambios.filter((p) => marcados.has(String(p.m.codmod))).length === 1 ? "" : "s"}`}</button></>}>
      <div className="space-y-4" data-informacion-torito>
        <p className="text-[13.5px] text-slate-600 dark:text-white/70">Guarda en la base la ficha oficial de cada modelo: precio, colores, descripción, ficha técnica (motor, combustible, chasis, consumo, dimensiones y sistema eléctrico) y fotos. Todo pasa por la API de modelos y la web lo muestra desde ahí.</p>
        <label className="flex items-start gap-2 text-[13.5px] font-medium text-marino dark:text-white">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={reemplazar} disabled={estado.corriendo || estado.hecho} onChange={(e) => { setReemplazar(e.target.checked); setElegidos(null); }} data-reemplazar-torito />
          <span>Actualizar también lo que ya tiene <span className="font-normal text-slate-500">(precio, colores, descripción y ficha vuelven a los de torito.pe). Sin marcar, solo se completa lo que falta.</span></span>
        </label>
        {estado.hecho && <Aviso tipo={fallas ? "aviso" : "ok"}>{fallas ? `Se guardó la información, salvo en ${fallas} modelo${fallas === 1 ? "" : "s"}. Revisa el detalle.` : "Listo: la web ya muestra la información guardada en la base."}</Aviso>}
        {conCambios.length === 0 && !estado.hecho && <Aviso tipo="ok">Todos los modelos ya tienen su información de torito.pe en la base.</Aviso>}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/10 dark:border-white/10">
          {plan.map((p) => {
            const id = String(p.m.codmod); const r = estado.resultados[id]; const cambios = resumen(p);
            return (
              <li key={id} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-start" data-torito-modelo={p.m.nommod}>
                <input type="checkbox" className="mt-1 h-4 w-4" checked={cambios.length > 0 && marcados.has(id)} disabled={bloqueado || !cambios.length} onChange={() => alternar(id)} aria-label={`Guardar ${p.m.nommod}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-marino dark:text-white">{p.m.nommod}</p>
                    <span className="text-[12px] text-slate-400">N° {id}</span>
                  </div>
                  <label className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">Ficha de torito.pe
                    <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px] dark:border-white/15 dark:bg-white/5" value={vinculo[id] || ""} disabled={bloqueado} onChange={(e) => { setVinculo({ ...vinculo, [id]: e.target.value }); setElegidos(null); }} data-vinculo-torito>
                      <option value="">No vincular</option>
                      {CATALOGO_TORITO.map((o) => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                    </select>
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!p.oficial ? <span className="text-[12.5px] text-slate-400">Sin ficha vinculada: no se toca.</span>
                      : cambios.length ? cambios.map((t) => <Pill key={t} tono="marino">{t}</Pill>) : <Pill tono="verde">Ya tiene toda su información</Pill>}
                  </div>
                  {p.datos.carmod && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-marino-700 dark:text-white/80">Ver la ficha que se guardará</summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-white/70">{p.datos.carmod}</pre>
                    </details>
                  )}
                  {r && !r.ok && <p className="mt-1 text-[12.5px] font-medium text-acento">{r.error}</p>}
                </div>
                {r && <Pill tono={r.ok ? "verde" : "rojo"}>{r.ok ? "Guardado" : "No se guardó"}</Pill>}
              </li>
            );
          })}
        </ul>
      </div>
    </Modal>
  );
}
