// HU-036 · Imágenes de un modelo en el almacenamiento central (panel de gerencia y administración)
// Se consultan por codmod y codimo reales. Subir un archivo lo guarda en el almacenamiento central y registra su
// referencia HTTPS; también se puede registrar una URL HTTPS existente. El orden, la sustitución y la baja
// lógica usan las operaciones de HU-012, que impiden dejar un modelo publicado sin imágenes activas.
import { useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { enlazarFotoModeloApi, estadoFotoModeloApi, ordenFotoModeloApi, reemplazarFotoModeloApi, sinRespuesta, subirFotoModeloApi } from "../../servicios/central";
import MotoIllustration from "../MotoIllustration";
import { Aviso, Modal, btnMini, useConfirm } from "../ui";
import { EstadoConexion, Pill } from "./Sprint2";

export const MAX_FOTO_CENTRAL = 6 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

// Validación en el navegador (el servidor vuelve a validar tipo real, tamaño y contenido)
export async function validarFotoCentral(archivo) {
  if (!archivo) return "Elige una foto.";
  if (!TIPOS.includes(archivo.type)) return "Usa una foto JPG, PNG o WebP.";
  if (archivo.size === 0) return "El archivo está vacío.";
  if (archivo.size > MAX_FOTO_CENTRAL) return `La foto pesa ${(archivo.size / 1048576).toFixed(1)} MB; el máximo es 6 MB.`;
  try {
    if (typeof createImageBitmap === "function") { const b = await createImageBitmap(archivo); const ok = b.width > 0 && b.height > 0; b.close?.(); if (!ok) return "No se pudo leer la foto."; }
  } catch { return "No se pudo leer la foto: el archivo está dañado o no es una imagen."; }
  return "";
}

export function validarUrlFoto(url) {
  const t = String(url || "").trim();
  if (!t) return "Pega el enlace de la foto (empieza con https://).";
  if (/\s/.test(t)) return "La dirección no puede tener espacios.";
  try {
    const u = new URL(t);
    if (u.protocol !== "https:") return "Usa una dirección que empiece con https://";
    if (!/\.[a-z]{2,}$/i.test(u.hostname) || u.username || u.password) return "Esa dirección no es válida.";
  } catch { return "Esa dirección no es válida."; }
  if (t.length > 2048) return "La dirección es demasiado larga.";
  return "";
}

function Foto({ src, alt }) {
  const [fallo, setFallo] = useState(false);
  useEffect(() => setFallo(false), [src]);
  if (!src || fallo) return <span className="grid h-full w-full place-items-center p-4 text-center"><MotoIllustration className="h-14 w-20 opacity-30" /><span className="text-[12px] text-slate-400">Imagen no disponible</span></span>;
  return <img src={src} alt={alt} className="h-full w-full object-contain p-3" referrerPolicy="no-referrer" loading="lazy" onError={() => setFallo(true)} />;
}

export default function GaleriaCentral({ modelo, onClose, onCambio }) {
  return (
    <Modal abierto={!!modelo} onClose={onClose} titulo={modelo ? `Fotos de ${modelo.nombre}` : ""} ancho="max-w-5xl" sinAvisoCambios confirmarGuardar={false}
      pie={<button className="btn btn-primary !py-2" onClick={onClose}>Listo</button>}>
      {modelo && <Contenido modelo={modelo} onCambio={onCambio} />}
    </Modal>
  );
}

function Contenido({ modelo, onCambio }) {
  const confirmar = useConfirm();
  const codmod = modelo.codmodApi;
  const [fotos, setFotos] = useState(null);
  const [estadoMod, setEstadoMod] = useState(modelo.estmod || "");
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState(null);
  const [ocupado, setOcupado] = useState("");
  const [enlace, setEnlace] = useState(""); const [panelEnlace, setPanelEnlace] = useState(false);
  const entrada = useRef(null); const reemplazo = useRef(null); const [aReemplazar, setAReemplazar] = useState(null);

  // Referencias centrales del modelo (GET /api/modelos/admin, por codmod real)
  async function cargar() {
    try {
      const r = await api.modelosAdminApi();
      const a = (r.data || []).find((x) => String(x.codmod) === String(codmod));
      if (!a) { setError("Este modelo ya no existe."); setFotos([]); return; }
      setEstadoMod(a.estmod);
      setFotos([...(a.imagenes || [])].sort((x, y) => x.ordimo - y.ordimo || Number(x.codimo) - Number(y.codimo)));
      setError("");
    } catch (e) { setError(mensajeError(e)); setFotos((f) => f || []); }
  }
  useEffect(() => { cargar(); }, [codmod]); // eslint-disable-line react-hooks/exhaustive-deps
  const activas = useMemo(() => (fotos || []).filter((f) => f.estimo), [fotos]);
  const publicado = estadoMod === "Publicado";
  const siguiente = (fotos || []).reduce((m, f) => Math.max(m, f.ordimo), 0) + 1;
  async function tras(promesa, ok) {
    setAviso(null);
    try { await promesa; setAviso({ tipo: "ok", t: ok }); await cargar(); onCambio?.(); }
    catch (e) {
      setAviso({ tipo: "error", t: sinRespuesta(e) ? "No se pudo confirmar la operación. Se recargó la galería: revisa si el cambio quedó antes de reintentar." : `${mensajeError(e)} La imagen anterior se conserva.` });
      await cargar();
    } finally { setOcupado(""); }
  }

  async function subir(e) {
    const archivo = e.target.files?.[0]; e.target.value = "";
    if (!archivo) return;
    const m = await validarFotoCentral(archivo);
    if (m) { setAviso({ tipo: "error", t: m }); return; }
    setOcupado("subir");
    await tras(subirFotoModeloApi(codmod, archivo, siguiente), "Foto subida al almacenamiento central. Ya se ve igual desde cualquier equipo.");
  }
  async function reemplazar(e) {
    const archivo = e.target.files?.[0]; e.target.value = "";
    const f = aReemplazar; setAReemplazar(null);
    if (!archivo || !f) return;
    const m = await validarFotoCentral(archivo);
    if (m) { setAviso({ tipo: "error", t: m }); return; }
    if (!(await confirmar({ titulo: "¿Reemplazar esta foto?", texto: "La foto nueva toma su lugar y su orden. Si la subida falla, se conserva la anterior.", boton: "Reemplazar" }))) return;
    setOcupado(`reemplazar-${f.codimo}`);
    await tras(reemplazarFotoModeloApi(codmod, f.codimo, archivo, f.ordimo), "Foto reemplazada.");
  }
  async function agregarEnlace(e) {
    e.preventDefault();
    const m = validarUrlFoto(enlace);
    if (m) { setAviso({ tipo: "error", t: m }); return; }
    if ((fotos || []).some((f) => f.urlimo === enlace.trim())) { setAviso({ tipo: "error", t: "Esa dirección ya está registrada en este modelo." }); return; }
    setOcupado("enlace");
    await tras(enlazarFotoModeloApi(codmod, enlace.trim(), siguiente), "Foto agregada desde el enlace.");
    setEnlace(""); setPanelEnlace(false);
  }
  async function alternar(f) {
    if (f.estimo && publicado && activas.length === 1) { setAviso({ tipo: "error", t: "Es la única foto activa de un modelo publicado. Agrega otra antes de desactivarla." }); return; }
    if (f.estimo && !(await confirmar({ titulo: "¿Desactivar esta foto?", texto: "Deja de verse en el catálogo y la ficha. Queda registrada y puedes volver a activarla.", boton: "Desactivar" }))) return;
    setOcupado(`estado-${f.codimo}`);
    await tras(estadoFotoModeloApi(codmod, f.codimo, !f.estimo), f.estimo ? "Foto desactivada (baja lógica): ya no se muestra en la web." : "Foto activada: se muestra en la web.");
  }
  // Mover: intercambia el orden con la vecina usando la operación de HU-012
  async function mover(i, paso) {
    const a = fotos[i]; const b = fotos[i + paso];
    if (!a || !b) return;
    const ordenA = a.ordimo === b.ordimo ? b.ordimo + paso : b.ordimo;
    setOcupado(`orden-${a.codimo}`);
    await tras(Promise.all([ordenFotoModeloApi(codmod, a.codimo, a.urlimo, Math.max(1, ordenA)), ordenFotoModeloApi(codmod, b.codimo, b.urlimo, a.ordimo)]), "Orden actualizado. La primera foto activa es la principal del catálogo.");
  }
  async function principal(f) {
    const primera = activas[0];
    if (!primera || primera.codimo === f.codimo) return;
    setOcupado(`orden-${f.codimo}`);
    await tras(Promise.all([ordenFotoModeloApi(codmod, f.codimo, f.urlimo, primera.ordimo), ordenFotoModeloApi(codmod, primera.codimo, primera.urlimo, f.ordimo === primera.ordimo ? f.ordimo + 1 : f.ordimo)]), "Foto principal actualizada.");
  }

  if (!codmod) return <Aviso tipo="aviso">Este modelo todavía no está guardado. Guárdalo con Editar y luego administra sus fotos aquí.</Aviso>;
  return (
    <div className="space-y-5" data-galeria-central={codmod}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] text-slate-500">{fotos === null ? "Cargando…" : <><b className="text-marino dark:text-white">{(fotos || []).length}</b> foto{(fotos || []).length === 1 ? "" : "s"} registrada{(fotos || []).length === 1 ? "" : "s"}, <b className="text-marino dark:text-white">{activas.length}</b> activa{activas.length === 1 ? "" : "s"} en la web. {publicado ? "Modelo publicado." : "Modelo en borrador: subir fotos no lo publica."}</>}</p>
        <div className="flex flex-wrap items-center gap-2">
          <EstadoConexion hu="HU-036" />
          <button className="btn btn-primary !py-2 text-[13.5px]" disabled={!!ocupado || fotos === null} onClick={() => entrada.current?.click()}>{ocupado === "subir" ? "Subiendo…" : "Subir foto"}</button>
          <input ref={entrada} id="gal-central-subir" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={subir} />
          <input ref={reemplazo} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={reemplazar} />
          <button className="btn btn-secondary !py-2 text-[13.5px]" aria-expanded={panelEnlace} onClick={() => setPanelEnlace(!panelEnlace)}>Agregar desde un enlace</button>
        </div>
      </div>
      <p className="-mt-2 text-[12.5px] text-slate-400">JPG, PNG o WebP de hasta 6 MB. Sube solo fotos autorizadas que correspondan a este modelo y su variante.</p>
      {error && <Aviso tipo="error">{error}</Aviso>}
      {aviso && <div data-aviso-galeria={aviso.tipo}><Aviso tipo={aviso.tipo}>{aviso.t}</Aviso></div>}
      {panelEnlace && (
        <form onSubmit={agregarEnlace} className="grid gap-3 rounded-xl2 border border-slate-200 p-4 sm:grid-cols-[1fr_auto] sm:items-end dark:border-white/10" noValidate>
          <div><label className="field-label" htmlFor="gal-central-enlace">Dirección de la foto (https://)</label><input id="gal-central-enlace" className="field-input" value={enlace} onChange={(e) => setEnlace(e.target.value)} placeholder="https://…/torito-azul.png" /></div>
          <button className="btn btn-primary !py-2.5" disabled={ocupado === "enlace"}>{ocupado === "enlace" ? "Registrando…" : "Registrar"}</button>
        </form>
      )}
      {fotos && fotos.length === 0 && !error && <p className="rounded-xl2 border-2 border-dashed border-slate-200 py-10 text-center text-[14px] text-slate-500 dark:border-white/10">Este modelo aún no tiene fotos. Sube una o agrégala desde un enlace.</p>}
      {fotos && fotos.length > 0 && (
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Fotos en orden">
          {fotos.map((f, i) => {
            const esPrincipal = activas[0]?.codimo === f.codimo;
            return (
              <li key={f.codimo} className={`overflow-hidden rounded-xl2 border ${esPrincipal ? "border-marino-700 ring-2 ring-marino-700/15 dark:border-white/40" : "border-slate-200 dark:border-white/10"} ${f.estimo ? "" : "opacity-60"}`} data-foto={f.codimo} data-activa={f.estimo ? "si" : "no"}>
                <div className="relative grid aspect-[4/3] place-items-center bg-escenario dark:bg-escenario-oscuro">
                  <Foto src={f.urlimo} alt={`Foto ${i + 1} de ${modelo.nombre}`} />
                  <span className="absolute left-2 top-2 flex gap-1.5">{esPrincipal && <Pill tono="marino">Principal</Pill>}{!f.estimo && <Pill tono="gris">Inactiva</Pill>}</span>
                  <span className="absolute right-2 top-2"><Pill tono={/\/storage\/v1\/object\/public\//.test(f.urlimo) ? "verde" : f.urlimo.startsWith("/images/") ? "gris" : "celeste"}>{/\/storage\/v1\/object\/public\//.test(f.urlimo) ? "Subida" : f.urlimo.startsWith("/images/") ? "De la web" : "Enlace"}</Pill></span>
                  <span className="cifra absolute bottom-2 left-2 rounded-md bg-white/90 px-1.5 py-0.5 text-[11.5px] font-bold text-marino dark:bg-black/50 dark:text-white">Orden {f.ordimo}</span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="truncate text-[11.5px] text-slate-400" title={f.urlimo}>{f.urlimo}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {f.estimo && !esPrincipal && <button className={btnMini} disabled={!!ocupado} onClick={() => principal(f)}>Hacer principal</button>}
                    <button className={btnMini} disabled={!!ocupado} aria-label="Mover antes" onClick={() => mover(i, -1)} hidden={i === 0}>Antes</button>
                    <button className={btnMini} disabled={!!ocupado} aria-label="Mover después" onClick={() => mover(i, 1)} hidden={i === fotos.length - 1}>Después</button>
                    <button className={btnMini} disabled={!!ocupado} onClick={() => { setAReemplazar(f); reemplazo.current?.click(); }}>{ocupado === `reemplazar-${f.codimo}` ? "Subiendo…" : "Reemplazar"}</button>
                    <button className={btnMini} disabled={!!ocupado} onClick={() => alternar(f)}>{f.estimo ? "Desactivar" : "Activar"}</button>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="text-[12.5px] text-slate-400">La primera foto activa es la principal del catálogo; las demás aparecen en la ficha del modelo. Los visitantes solo ven las fotos activas de modelos publicados.</p>
    </div>
  );
}
