// HU-036 · Galería de fotos de un modelo (panel)
import { useMemo, useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { COLORES } from "../../data/mockData";
import { useGaleria } from "../../servicios/imagenes";
import { aplicarGaleria } from "../../lib/galeria";
import ModeloImg from "../ModeloImg";
import MotoIllustration from "../MotoIllustration";
import { Aviso, Modal, btnMini, btnMiniPeligro } from "../ui";
import { ColorPunto, EstadoConexion, Pill } from "./Sprint2";

// Foto con respaldo si el enlace no carga
function Foto({ src, alt, className }) {
  const [fallo, setFallo] = useState(false);
  if (!src || fallo) return <span className="grid h-full w-full place-items-center p-4 text-center"><MotoIllustration className="h-16 w-24 opacity-30" /><span className="text-[12px] text-slate-400">{src ? "No se pudo cargar la foto" : "Cargando…"}</span></span>;
  return <img src={src} alt={alt} className={className} referrerPolicy="no-referrer" loading="lazy" onError={() => setFallo(true)} />;
}

export default function GaleriaModelo({ modelo, onClose }) {
  return <Modal abierto={!!modelo} onClose={onClose} titulo={modelo ? `Fotos de ${modelo.nombre}` : ""} ancho="max-w-5xl" sinAvisoCambios confirmarGuardar={false}
    pie={<button className="btn btn-primary !py-2" onClick={onClose}>Listo</button>}>
    {modelo && <Contenido modelo={modelo} />}
  </Modal>;
}

function Contenido({ modelo }) {
  const g = useGaleria(modelo);
  const { imagenes = [], urlsFotos = {} } = useApp();
  const [aviso, setAviso] = useState(null);
  const [panel, setPanel] = useState("");
  const [enlace, setEnlace] = useState(""); const [colorEnlace, setColorEnlace] = useState("");
  const [oficiales, setOficiales] = useState([]);
  const [subiendo, setSubiendo] = useState(false);
  const mostrar = (r) => { if (r?.error) setAviso({ tipo: "error", t: r.error }); else if (r?.ok) setAviso({ tipo: "ok", t: r.ok }); };
  // Vista previa: cómo queda la web con estas fotos
  const vista = useMemo(() => aplicarGaleria([modelo], imagenes.filter((i) => i.modelo === modelo.id), urlsFotos, { [modelo.id]: true })[0], [modelo, imagenes, urlsFotos]);

  async function subir(e) {
    const archivos = [...(e.target.files || [])]; e.target.value = "";
    if (!archivos.length) return;
    setSubiendo(true);
    try { mostrar(await g.subir(archivos)); } catch (er) { setAviso({ tipo: "error", t: er.message || "No se pudo subir la foto." }); } finally { setSubiendo(false); }
  }
  function agregarEnlace(e) {
    e.preventDefault();
    const r = g.agregarEnlace(enlace, colorEnlace);
    mostrar(r); if (r.ok) { setEnlace(""); setColorEnlace(""); setPanel(""); }
  }
  function traer() {
    const r = g.importarOficiales(oficiales);
    mostrar(r); if (r.ok) { setOficiales([]); setPanel(""); }
  }

  return (
    <div className="space-y-5" data-galeria={modelo.id}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-slate-500"><b className="text-marino dark:text-white">{g.fotos.length}</b> de {g.max} fotos, <b className="text-marino dark:text-white">{g.activas.length}</b> visibles en la web.</p>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoConexion hu="HU-036" />
          <label className={`btn btn-primary !py-2 text-[13.5px] ${subiendo || g.fotos.length >= g.max ? "pointer-events-none opacity-50" : "cursor-pointer"}`}>
            {subiendo ? "Subiendo…" : "Subir fotos"}
            <input id="gal-subir" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={subir} disabled={subiendo} />
          </label>
          <button className="btn btn-secondary !py-2 text-[13.5px]" aria-expanded={panel === "enlace"} onClick={() => setPanel(panel === "enlace" ? "" : "enlace")}>Agregar enlace</button>
          <button className="btn btn-secondary !py-2 text-[13.5px]" aria-expanded={panel === "oficiales"} disabled={!g.oficialesFaltantes.length} title={g.oficialesFaltantes.length ? "" : "Ya están todas las fotos oficiales"} onClick={() => { setOficiales(g.oficialesFaltantes.map((o) => o.url)); setPanel(panel === "oficiales" ? "" : "oficiales"); }}>Traer fotos oficiales{g.oficialesFaltantes.length ? ` (${g.oficialesFaltantes.length})` : ""}</button>
        </div>
      </div>
      <p className="-mt-2 text-[12.5px] text-slate-400">JPG, PNG o WEBP de hasta 2 MB. Se ajustan solas al tamaño de la web.</p>

      {aviso && <Aviso tipo={aviso.tipo}>{aviso.t}</Aviso>}

      {panel === "enlace" && (
        <form onSubmit={agregarEnlace} className="grid gap-3 rounded-xl2 border border-slate-200 p-4 sm:grid-cols-[1fr_180px_auto] sm:items-end dark:border-white/10" noValidate>
          <div><label className="field-label" htmlFor="gal-enlace">Enlace de la foto</label><input id="gal-enlace" className="field-input" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://torito.pe/wp-content/uploads/…png" /></div>
          <div><label className="field-label" htmlFor="gal-enlace-color">Color de la moto</label><select id="gal-enlace-color" className="field-input" value={colorEnlace} onChange={(e) => setColorEnlace(e.target.value)}><option value="">Sin color</option>{COLORES.map((c) => <option key={c}>{c}</option>)}</select></div>
          <button className="btn btn-primary !py-2.5">Agregar</button>
        </form>
      )}
      {panel === "oficiales" && (
        <div className="rounded-xl2 border border-slate-200 p-4 dark:border-white/10">
          <p className="text-[13.5px] font-semibold text-marino dark:text-white">Fotos oficiales de torito.pe que aún no están en la galería</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {g.oficialesFaltantes.map((o) => (
              <label key={o.url} className={`cursor-pointer overflow-hidden rounded-xl border-2 ${oficiales.includes(o.url) ? "border-marino-700 dark:border-white/50" : "border-slate-200 dark:border-white/10"}`}>
                <div className="grid aspect-[4/3] place-items-center bg-escenario dark:bg-escenario-oscuro"><Foto src={o.url} alt={`Foto oficial ${o.color}`} className="h-full w-full object-contain p-2" /></div>
                <span className="flex items-center gap-2 px-3 py-2 text-[13px]"><input type="checkbox" className="accent-[#0e2c52]" checked={oficiales.includes(o.url)} onChange={() => setOficiales(oficiales.includes(o.url) ? oficiales.filter((x) => x !== o.url) : [...oficiales, o.url])} /><ColorPunto color={o.color} className="h-2.5 w-2.5" />{o.color || "Sin color"}</span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end"><button className="btn btn-primary !py-2 text-[13.5px]" onClick={traer}>Agregar seleccionadas</button></div>
        </div>
      )}

      {/* Fotos */}
      {g.fotos.length === 0 ? (
        <p className="rounded-xl2 border-2 border-dashed border-slate-200 py-10 text-center text-[14px] text-slate-500 dark:border-white/10">Este modelo aún no tiene fotos. Sube una o trae las oficiales de torito.pe.</p>
      ) : (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fotos en orden">
          {g.fotos.map((f, i) => (
            <li key={f.id} className={`overflow-hidden rounded-xl2 border ${f.principal ? "border-marino-700 ring-2 ring-marino-700/15 dark:border-white/40" : "border-slate-200 dark:border-white/10"} ${f.activa ? "" : "opacity-60"}`} data-foto={f.id}>
              <div className="relative grid aspect-[4/3] place-items-center bg-escenario dark:bg-escenario-oscuro">
                <Foto src={f.src} alt={`Foto ${i + 1} de ${modelo.nombre}`} className="h-full w-full object-contain p-3" />
                <span className="absolute left-2 top-2 flex gap-1.5">{f.principal && <Pill tono="marino">Principal</Pill>}{!f.activa && <Pill tono="gris">Oculta</Pill>}</span>
                <span className="absolute right-2 top-2"><Pill tono={f.origen === "Oficial" ? "celeste" : f.origen === "Subida" ? "verde" : "gris"}>{f.origen === "Oficial" ? "Oficial" : f.origen === "Subida" ? "Subida" : "Enlace"}</Pill></span>
                <span className="cifra absolute bottom-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11.5px] font-bold text-marino dark:bg-black/50 dark:text-white">{i + 1}</span>
              </div>
              <div className="space-y-2.5 p-3">
                <label className="flex items-center gap-2 text-[13px]"><span className="text-slate-500">Color</span>
                  <select aria-label={`Color de la foto ${i + 1}`} className="field-input !py-1.5 !text-[13px]" value={f.color || ""} onChange={(e) => mostrar(g.cambiarColor(f, e.target.value))}><option value="">Sin color</option>{COLORES.map((c) => <option key={c}>{c}</option>)}</select>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {!f.principal && f.activa && <button className={btnMini} onClick={() => mostrar(g.hacerPrincipal(f))}>Hacer principal</button>}
                  <button className={btnMini} onClick={() => mostrar(g.alternarActiva(f))}>{f.activa ? "Ocultar" : "Mostrar"}</button>
                  <button className={btnMini} disabled={i === 0} aria-label="Mover antes" onClick={() => mostrar(g.mover(f, -1))}>Antes</button>
                  <button className={btnMini} disabled={i === g.fotos.length - 1} aria-label="Mover después" onClick={() => mostrar(g.mover(f, 1))}>Después</button>
                  <button className={btnMiniPeligro} onClick={async () => mostrar(await g.quitar(f))}>Quitar</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* Así se verá en la web */}
      {vista && (modelo.colores || []).length > 0 && (
        <section className="rounded-xl2 bg-slate-50 p-4 dark:bg-white/5">
          <p className="text-[13.5px] font-semibold text-marino dark:text-white">Así se verá en la web</p>
          <p className="text-[12.5px] text-slate-500">La principal va en el catálogo. Al elegir un color se muestra su foto; si no tiene, la web pinta la principal en ese color.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            {modelo.colores.map((c) => (
              <figure key={c} className="w-28 rounded-xl bg-white p-2 text-center shadow-card dark:bg-[#121a2b]">
                <div className="grid h-16 place-items-center"><ModeloImg modelo={vista} color={c} className="h-full w-full object-contain" /></div>
                <figcaption className="mt-1 flex items-center justify-center gap-1 text-[12px] font-semibold"><ColorPunto color={c} className="h-2.5 w-2.5" />{c}{vista.fotosColor?.[c] ? "" : <span className="font-normal text-slate-400">, pintada</span>}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
