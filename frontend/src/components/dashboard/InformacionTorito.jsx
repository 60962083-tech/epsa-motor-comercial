// HU-036 · Traer la información de torito.pe a la base (todo por la API de modelos)
// Al abrir, Supabase lee torito.pe en ese momento (servicios/torito.js); si no responde, se usa la ficha oficial
// que trae el panel. Para cada modelo de la base (su codmod real) se elige su ficha y se guarda con las mismas
// rutas del panel: PUT /api/modelos/:id (precio, colores, descripción y ficha técnica completa en carmod) y
// POST/PATCH /api/modelos/:id/imagenes (fotos oficiales por enlace HTTPS). Nunca se borra nada: las fotos que el
// equipo subió se conservan y solo se ocultan fotos de torito.pe repetidas o que torito.pe ya reemplazó.
// Los modelos que torito.pe publica y aún no están en la base se crean con POST /api/modelos (precio, colores,
// descripción y ficha), se les enlazan sus fotos y se publican: aparecen en el panel y en la web.
// Cada modelo se une a su producto de torito.pe por su página (guardada en su ficha), no por el nombre comercial.
// Los modelos creados a mano en el panel («Origen: Manual», como el Torito 250 anterior) nunca se vinculan ni se
// cambian: no se les copia la ficha de otro modelo, ni se ocultan o despublican porque torito.pe no los muestre.
import { useEffect, useMemo, useState } from "react";
import { CATALOGO_TORITO } from "../../data/catalogoTorito";
import { claveModelo } from "../../lib/modelos";
import { conDatoGeneral, esFichaCompleta, textoAFicha } from "../../lib/fichaModelo";
import { crearModeloApi, editarModeloApi, estadoModeloApi } from "../../lib/api";
import { enlazarFotoModeloApi, estadoFotoModeloApi, ordenFotoModeloApi } from "../../servicios/central";
import { BUCKET_FOTOS, borrarArchivoStorage } from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { PAGINA_TORITO, catalogoEnVivo, copiarImagenTorito, esCopiaTorito, paginaDe, urlCopiaTorito } from "../../servicios/torito";
import { MODO_REAL } from "../../lib/config";
import { formatoSoles } from "../../data/mockData";
import { Aviso, Modal } from "../ui";
import { Pill } from "./Sprint2";

const deTorito = (url) => /^https:\/\/torito\.pe\//i.test(String(url || ""));
// Ficha propuesta: la de su página de torito.pe (se puede cambiar o no vincular). Un modelo manual no se vincula.
const slugDe = (o) => o.slug || PAGINA_TORITO[o.nombre] || "";
export const esManual = (m) => /^manual$/i.test(String(textoAFicha(m?.carmod).generales.origen || "").trim());
const fichaDe = (m, catalogo) => {
  if (esManual(m)) return null;
  const pagina = paginaDe(m);
  return (pagina && catalogo.find((o) => slugDe(o) === pagina)) || null;
};
const vinculoInicial = (modelos, catalogo) => Object.fromEntries(modelos.map((m) => [String(m.codmod), fichaDe(m, catalogo)?.nombre || ""]));
// Modelos de torito.pe que no tienen ningún modelo en la base (ni por su página ni por el nombre)
const nuevosDe = (modelos, catalogo) => catalogo.filter((o) => o.enVivo && o.slug && !modelos.some((m) => paginaDe(m) === o.slug || claveModelo(m.nommod) === claveModelo(o.nombre)));

// ---------------------------------------------------------------------------------------------
// Qué se guardará en cada modelo
// ---------------------------------------------------------------------------------------------
// Con «reemplazar», también se actualiza lo que ya tiene un valor distinto al de torito.pe
const igualesColores = (a = [], b = []) => a.length === b.length && a.every((c) => b.includes(c));
export function planInformacion(modelos = [], vinculo = {}, reemplazar = false, catalogo = CATALOGO_TORITO, copiaDe = null) {
  const oficialDe = (m) => (esManual(m) ? null : catalogo.find((o) => o.nombre === vinculo[String(m.codmod)]) || null);
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
    // La ficha guarda la página de torito.pe del modelo: así el vínculo no depende del nombre en las próximas veces
    let soloVinculo = false;
    const pagina = slugDe(oficial);
    const ficha = datos.carmod ?? m.carmod;
    if (pagina && textoAFicha(ficha).generales.paginaTorito !== pagina) {
      const conPagina = conDatoGeneral(ficha, "paginaTorito", pagina);
      if (conPagina !== String(ficha || "").trim()) { soloVinculo = !datos.carmod; datos.carmod = conPagina; }
    }
    // Fotos: una oficial extra no se agrega si es la principal de otro modelo (así ninguna moto se repite).
    // Con «copiaDe», cada foto de torito.pe se guarda como archivo propio en Supabase Storage y reemplaza a las
    // fotos de torito.pe anteriores (enlaces directos o copias que torito.pe ya no muestra). Las fotos que subió
    // el equipo no se tocan.
    const fotos = [];
    const imagenes = m.imagenes || [];
    const activas = imagenes.filter((x) => x.estimo !== false);
    const principal = oficial.fotos[0];
    const propia = (url) => url === principal || !principales.has(url);
    if (principal) {
      const nuevas = oficial.fotos.filter(propia).map((u) => ({ origen: u, url: copiaDe ? copiaDe(m.codmod, u) : u }));
      const quedan = new Set(nuevas.map((n) => n.url));
      for (const i of activas) {
        if (copiaDe) {
          if ((deTorito(i.urlimo) || esCopiaTorito(i.urlimo)) && !quedan.has(i.urlimo)) fotos.push({ tipo: "quitar", imagen: i });
        } else if (deTorito(i.urlimo) && i.urlimo !== principal
          && (usoFoto.get(i.urlimo) > 1 || !propia(i.urlimo) || (reemplazar && !oficial.fotos.includes(i.urlimo)))) fotos.push({ tipo: "quitar", imagen: i });
      }
      let orden = Math.max(0, ...imagenes.map((i) => Number(i.ordimo) || 0));
      const principalDestino = nuevas[0]?.url;
      const quedanOtras = activas.some((i) => i.urlimo !== principalDestino && !fotos.some((c) => c.imagen?.codimo === i.codimo));
      for (const n of nuevas) {
        const existe = imagenes.find((i) => i.urlimo === n.url);
        if (existe && existe.estimo === false) fotos.push({ tipo: "activar", imagen: existe });
        if (!existe) fotos.push({ tipo: copiaDe ? "copia" : "foto", origen: n.origen, url: n.url, ordimo: n.url === principalDestino && !quedanOtras ? 1 : ++orden });
      }
    }
    return { m, oficial, datos, fotos, soloVinculo };
  });
}

// Lo que cambia, en pocas palabras
function resumen({ datos, fotos, oficial, m, soloVinculo }) {
  const nuevas = fotos.filter((c) => c.tipo !== "quitar").length;
  const quitar = fotos.filter((c) => c.tipo === "quitar").length;
  return [
    datos.premod ? `Precio ${formatoSoles(datos.premod)}${m.premod != null && m.premod !== "" ? ` (antes ${formatoSoles(Number(m.premod))})` : ""}` : null,
    datos.colores ? `Colores: ${datos.colores.join(", ")}` : null,
    datos.desmod ? "Descripción" : null,
    datos.carmod ? (soloVinculo ? "Guarda su página de torito.pe" : `Ficha técnica (${oficial.datos} datos)`) : null,
    nuevas ? `${nuevas} foto${nuevas === 1 ? "" : "s"} de torito.pe${fotos.some((c) => c.tipo === "copia") ? " (se guardan en la base)" : ""}` : null,
    quitar ? `${fotos.some((c) => c.tipo === "copia") ? "Reemplaza" : "Ocultar"} ${quitar} foto${quitar === 1 ? "" : "s"} anterior${quitar === 1 ? "" : "es"}` : null,
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
  // Lectura en vivo de torito.pe: cargando, ok (con lo leído) o error (se usa la ficha oficial del panel)
  const [vivo, setVivo] = useState({ estado: "cargando" });
  // Modelos nuevos de torito.pe que se crearán (por su página); null = todos
  const [crear, setCrear] = useState(null);
  useEffect(() => {
    if (!abierto) return undefined;
    let vigente = true;
    setReemplazar(false); setElegidos(null); setCrear(null); setEstado({ corriendo: false, hecho: false, resultados: {} });
    setVivo({ estado: "cargando" });
    catalogoEnVivo(modelos || [])
      .then((r) => { if (!vigente) return; setVinculo(vinculoInicial(modelos || [], r.catalogo)); setVivo({ estado: "ok", ...r }); setReemplazar(true); })
      .catch((e) => {
        if (!vigente) return;
        setVinculo(vinculoInicial(modelos || [], CATALOGO_TORITO));
        setVivo({ estado: "error", error: e?.detalle?.faltaSql ? "falta habilitar la lectura de torito.pe en Supabase" : mensajeError(e) });
      });
    return () => { vigente = false; };
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const catalogo = vivo.estado === "ok" ? vivo.catalogo : CATALOGO_TORITO;
  const plan = useMemo(() => (abierto && vivo.estado !== "cargando" ? planInformacion(modelos || [], vinculo, reemplazar, catalogo, MODO_REAL ? urlCopiaTorito : null) : []), [abierto, modelos, vinculo, reemplazar, catalogo, vivo.estado]);
  const conCambios = plan.filter((p) => Object.keys(p.datos).length || p.fotos.length);
  const marcados = elegidos ?? new Set(conCambios.map((p) => String(p.m.codmod)));
  // Los nuevos se calculan una vez al leer torito.pe (así no desaparecen de la lista apenas se crean)
  const nuevos = useMemo(() => (vivo.estado === "ok" ? nuevosDe(modelos || [], vivo.catalogo) : []), [vivo]); // eslint-disable-line react-hooks/exhaustive-deps
  const porCrear = crear ?? new Set(nuevos.map((o) => o.slug));
  const total = conCambios.filter((p) => marcados.has(String(p.m.codmod))).length + nuevos.filter((o) => porCrear.has(o.slug)).length;
  if (!abierto) return null;

  function alternar(codmod) {
    const s = new Set(marcados);
    if (s.has(codmod)) s.delete(codmod); else s.add(codmod);
    setElegidos(s);
  }

  function alternarNuevo(slug) {
    const s = new Set(porCrear);
    if (s.has(slug)) s.delete(slug); else s.add(slug);
    setCrear(s);
  }

  // Modelo nuevo: se crea con su información, se enlazan sus fotos y se publica (sin foto queda como borrador)
  // Foto de torito.pe guardada en nuestro almacenamiento; si no se puede copiar, queda su enlace (se reintenta la próxima vez)
  async function guardarFoto(codmod, url, fallas) {
    if (!MODO_REAL) return url;
    try { return await copiarImagenTorito(codmod, url); }
    catch { if (fallas) fallas.n++; return url; }
  }

  async function crearNuevo(o) {
    const creado = (await crearModeloApi({ codtmo: o.codtmo, nommod: o.nombre, marmod: "Bajaj", desmod: o.descripcion, carmod: o.ficha, premod: o.precio ?? null, colores: o.colores })).data;
    const codmod = String(creado.codmod);
    try {
      let orden = 0;
      for (const url of o.fotos) await enlazarFotoModeloApi(codmod, await guardarFoto(codmod, url), ++orden);
      if (!o.fotos.length) return { ok: true, borrador: true };
      await estadoModeloApi(codmod, "Publicado");
      return { ok: true };
    } catch (e) { return { ok: false, error: `Se creó como borrador, pero no se pudo publicar: ${mensajeError(e)}` }; }
  }

  async function aplicar() {
    setEstado({ corriendo: true, hecho: false, resultados: {} });
    const resultados = {};
    for (const o of nuevos.filter((x) => porCrear.has(x.slug))) {
      const id = `nuevo:${o.slug}`;
      try { resultados[id] = await crearNuevo(o); } catch (e) { resultados[id] = { ok: false, error: mensajeError(e) }; }
      setEstado({ corriendo: true, hecho: false, resultados: { ...resultados } });
    }
    for (const p of conCambios.filter((x) => marcados.has(String(x.m.codmod)))) {
      const id = String(p.m.codmod);
      try {
        if (Object.keys(p.datos).length) await editarModeloApi(id, p.datos);
        // Primero las fotos oficiales nuevas y después se ocultan las repetidas: el modelo nunca queda sin foto
        for (const c of p.fotos.filter((x) => x.tipo === "foto")) await enlazarFotoModeloApi(id, c.url, c.ordimo);
        // Fotos copiadas a nuestro almacenamiento. Para no acumular fotos, cada foto nueva ocupa el lugar de una
        // foto anterior de torito.pe (se actualiza su enlace) y el archivo anterior se borra del almacenamiento.
        // Si una foto no se pudo copiar, se conserva su enlace a torito.pe y se reintenta la próxima vez.
        const fallas = { n: 0 };
        const conservar = new Set();
        const libres = p.fotos.filter((x) => x.tipo === "quitar").map((x) => x.imagen).sort((a, b) => (Number(a.ordimo) || 0) - (Number(b.ordimo) || 0));
        const archivosViejos = [];
        for (const c of p.fotos.filter((x) => x.tipo === "copia")) {
          const url = await guardarFoto(id, c.origen, fallas);
          if (url === c.origen) {
            const ya = (p.m.imagenes || []).find((i) => i.urlimo === url && i.estimo !== false);
            if (ya) { conservar.add(ya.codimo); continue; }
          }
          const lugar = libres.find((i) => !conservar.has(i.codimo));
          if (lugar) {
            await ordenFotoModeloApi(id, lugar.codimo, url, Math.min(Number(c.ordimo) || 1, Number(lugar.ordimo) || 1));
            conservar.add(lugar.codimo);
            if (esCopiaTorito(lugar.urlimo)) archivosViejos.push(lugar.urlimo);
          } else await enlazarFotoModeloApi(id, url, c.ordimo);
        }
        for (const c of p.fotos.filter((x) => x.tipo === "activar")) await estadoFotoModeloApi(id, c.imagen.codimo, true);
        for (const c of p.fotos.filter((x) => x.tipo === "quitar" && !conservar.has(x.imagen.codimo))) {
          await estadoFotoModeloApi(id, c.imagen.codimo, false);
          if (esCopiaTorito(c.imagen.urlimo)) archivosViejos.push(c.imagen.urlimo);
        }
        const rutas = archivosViejos.map((u) => decodeURIComponent(u.split(`/object/public/${BUCKET_FOTOS}/`)[1] || "")).filter(Boolean);
        if (rutas.length) await borrarArchivoStorage(BUCKET_FOTOS, rutas).catch(() => {});
        resultados[id] = { ok: true, fallasFotos: fallas.n };
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
          <button className="btn btn-primary !py-2" onClick={aplicar} disabled={estado.corriendo || vivo.estado === "cargando" || !total} data-aplicar-torito>{estado.corriendo ? "Guardando…" : `Guardar en ${total} modelo${total === 1 ? "" : "s"}`}</button></>}>
      <div className="space-y-4" data-informacion-torito>
        <p className="text-[13.5px] text-slate-600 dark:text-white/70">Guarda en la base la información de cada modelo en torito.pe: precio, colores, descripción, ficha técnica (motor, combustible, chasis, consumo, dimensiones y sistema eléctrico) y fotos. Todo pasa por la API de modelos y la web lo muestra desde ahí.</p>
        {vivo.estado === "cargando" && <Aviso>Leyendo torito.pe…</Aviso>}
        {vivo.estado === "ok" && <div data-torito-en-vivo><Aviso tipo="ok">Información leída ahora mismo de torito.pe.{vivo.fallas?.length ? ` No se pudo leer la página de ${vivo.fallas.join(", ")}: se usa su ficha guardada.` : ""}</Aviso></div>}
        {vivo.estado === "error" && <div data-torito-sin-conexion><Aviso tipo="aviso">No se pudo leer torito.pe ({vivo.error}). Se usa la ficha oficial que trae el panel.</Aviso></div>}
        <label className="flex items-start gap-2 text-[13.5px] font-medium text-marino dark:text-white">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={reemplazar} disabled={estado.corriendo || estado.hecho} onChange={(e) => { setReemplazar(e.target.checked); setElegidos(null); }} data-reemplazar-torito />
          <span>Actualizar también lo que ya tiene <span className="font-normal text-slate-500">(precio, colores, descripción y ficha vuelven a los de torito.pe). Sin marcar, solo se completa lo que falta.</span></span>
        </label>
        {estado.hecho && <Aviso tipo={fallas ? "aviso" : "ok"}>{fallas ? `Se guardó la información, salvo en ${fallas} modelo${fallas === 1 ? "" : "s"}. Revisa el detalle.` : "Listo: la web ya muestra la información guardada en la base."}</Aviso>}
        {vivo.estado !== "cargando" && conCambios.length === 0 && !nuevos.length && !estado.hecho && <Aviso tipo="ok">Todos los modelos ya tienen su información de torito.pe en la base.</Aviso>}
        {nuevos.length > 0 && (
          <div className="space-y-2" data-torito-nuevos>
            <p className="text-[13.5px] font-semibold text-marino dark:text-white">Modelos nuevos en torito.pe</p>
            <p className="text-[12.5px] text-slate-500">Todavía no están en el panel. Al guardar se crean con su precio, colores, descripción, ficha técnica y fotos, y se publican en la web.</p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/10 dark:border-white/10">
              {nuevos.map((o) => {
                const r = estado.resultados[`nuevo:${o.slug}`];
                const datos = [o.precio ? `Precio ${formatoSoles(o.precio)}` : "Precio a consultar", o.colores.length ? `Colores: ${o.colores.join(", ")}` : null,
                  `Ficha técnica (${o.datos} datos)`, o.fotos.length ? `${o.fotos.length} foto${o.fotos.length === 1 ? "" : "s"} oficial${o.fotos.length === 1 ? "" : "es"}` : "Sin foto: queda como borrador"].filter(Boolean);
                return (
                  <li key={o.slug} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-start" data-torito-nuevo={o.nombre}>
                    <input type="checkbox" className="mt-1 h-4 w-4" checked={porCrear.has(o.slug)} disabled={bloqueado} onChange={() => alternarNuevo(o.slug)} aria-label={`Crear ${o.nombre}`} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-marino dark:text-white">{o.nombre}</p>
                        <Pill tono="ambar">Nuevo</Pill>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">{datos.map((t) => <Pill key={t} tono="marino">{t}</Pill>)}</div>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[12.5px] font-semibold text-marino-700 dark:text-white/80">Ver la ficha que se guardará</summary>
                        <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-white/70">{o.ficha}</pre>
                      </details>
                      {r && !r.ok && <p className="mt-1 text-[12.5px] font-medium text-acento">{r.error}</p>}
                    </div>
                    {r && <Pill tono={r.ok ? "verde" : "rojo"}>{r.ok ? (r.borrador ? "Creado (borrador)" : "Creado y publicado") : "No se creó"}</Pill>}
                  </li>
                );
              })}
            </ul>
            {plan.length > 0 && <p className="pt-2 text-[13.5px] font-semibold text-marino dark:text-white">Modelos del panel</p>}
          </div>
        )}
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100 dark:divide-white/10 dark:border-white/10">
          {plan.map((p) => {
            const id = String(p.m.codmod); const r = estado.resultados[id]; const cambios = resumen(p); const manual = esManual(p.m);
            return (
              <li key={id} className="grid gap-2 px-4 py-3 sm:grid-cols-[auto_1fr_auto] sm:items-start" data-torito-modelo={p.m.nommod} data-torito-manual={manual ? "" : undefined}>
                <input type="checkbox" className="mt-1 h-4 w-4" checked={cambios.length > 0 && marcados.has(id)} disabled={bloqueado || manual || !cambios.length} onChange={() => alternar(id)} aria-label={`Guardar ${p.m.nommod}`} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-marino dark:text-white">{p.m.nommod}</p>
                    <span className="text-[12px] text-slate-400">N° {id}</span>
                  </div>
                  {manual ? <p className="mt-1 text-[12.5px] text-slate-500">Registro manual de EPSA: no se actualiza desde torito.pe.</p> : <label className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">Ficha de torito.pe
                    <select className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12.5px] dark:border-white/15 dark:bg-white/5" value={vinculo[id] || ""} disabled={bloqueado} onChange={(e) => { setVinculo({ ...vinculo, [id]: e.target.value }); setElegidos(null); }} data-vinculo-torito>
                      <option value="">No vincular</option>
                      {catalogo.map((o) => <option key={o.nombre} value={o.nombre}>{o.nombre}</option>)}
                    </select>
                  </label>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {!p.oficial ? <span className="text-[12.5px] text-slate-400">{manual ? "Se mantiene tal como está." : "Sin ficha vinculada: no se toca."}</span>
                      : cambios.length ? cambios.map((t) => <Pill key={t} tono="marino">{t}</Pill>) : <Pill tono="verde">Ya tiene toda su información</Pill>}
                  </div>
                  {p.datos.carmod && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[12.5px] font-semibold text-marino-700 dark:text-white/80">Ver la ficha que se guardará</summary>
                      <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600 dark:bg-white/5 dark:text-white/70">{p.datos.carmod}</pre>
                    </details>
                  )}
                  {r && !r.ok && <p className="mt-1 text-[12.5px] font-medium text-acento">{r.error}</p>}
                  {r?.fallasFotos > 0 && <p className="mt-1 text-[12.5px] text-amber-700 dark:text-amber-300">{r.fallasFotos} foto{r.fallasFotos === 1 ? "" : "s"} no se pudo copiar: quedó su enlace a torito.pe y se volverá a intentar la próxima vez.</p>}
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
