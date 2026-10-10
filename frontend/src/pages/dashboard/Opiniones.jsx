import { useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { ETIQUETAS_OPINION, SEDES_ATENCION } from "../../data/mockData";
import { Aviso, Campo, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import { esNombre, limpiarTexto, soloLetras } from "../../lib/validar";

const VACIO = { nombre: "", sede: SEDES_ATENCION[0], modelo: "", etiqueta: ETIQUETAS_OPINION[0], estrellas: 5, texto: "", publicado: true, autoriza: false };

/**
 * Opiniones de clientes que se muestran en el inicio de la web («Historias de éxito comercial»).
 * Solo se publican opiniones reales con autorización del cliente. Las de demostración dicen «Ejemplo».
 */
export default function Opiniones() {
  const { opiniones = [], modelos, agregar, actualizar, eliminar } = useApp();
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [modal, setModal] = useState(null); const [f, setF] = useState(VACIO); const [err, setErr] = useState({});
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || "—";
  const ejemplos = opiniones.filter((o) => o.ejemplo).length;

  function abrir(o) { setErr({}); setF(o ? { ...VACIO, ...o, autoriza: !o.ejemplo } : { ...VACIO, modelo: modelos[0]?.id || "" }); setModal({ o }); }
  function validar() {
    const x = {};
    if (!esNombre(f.nombre)) x.nombre = "Escribe el nombre como se mostrará (por ejemplo: Rosa P.).";
    if (!f.modelo || !modelos.some((m) => m.id === f.modelo)) x.modelo = "Elige el modelo que compró.";
    if (!SEDES_ATENCION.includes(f.sede)) x.sede = "Elige la sede.";
    const t = limpiarTexto(f.texto);
    if (t.length < 20 || (t.match(/\p{L}/gu) || []).length < 10) x.texto = "La opinión debe tener al menos 20 caracteres de texto.";
    else if (t.length > 240) x.texto = "Máximo 240 caracteres.";
    if (!(Number(f.estrellas) >= 1 && Number(f.estrellas) <= 5)) x.estrellas = "Elige de 1 a 5 estrellas.";
    if (!f.autoriza) x.autoriza = "Confirma que el cliente autorizó publicar su opinión.";
    setErr(x); return Object.keys(x).length === 0;
  }
  function guardar(e) {
    e.preventDefault(); if (!validar()) return;
    const { autoriza, ...datos } = f;
    datos.nombre = limpiarTexto(datos.nombre); datos.texto = limpiarTexto(datos.texto); datos.estrellas = Number(datos.estrellas); datos.ejemplo = false;
    if (modal.o) { actualizar("opiniones", modal.o.id, datos, `Opinión editada: ${datos.nombre}`); toast("Opinión actualizada"); }
    else { agregar("opiniones", { ...datos, id: opiniones.reduce((m, o) => Math.max(m, o.id), 0) + 1 }, `Opinión agregada: ${datos.nombre}`); toast(datos.publicado ? "Opinión publicada en el inicio de la web" : "Opinión guardada sin publicar"); }
    setModal(null);
  }
  async function borrar(o) {
    if (!(await confirmar({ titulo: "Eliminar opinión", texto: `¿Eliminar la opinión de ${o.nombre}? Dejará de verse en la web.`, boton: "Eliminar", peligro: true }))) return;
    eliminar("opiniones", o.id, `Opinión eliminada: ${o.nombre}`); toast("Opinión eliminada");
  }
  async function quitarEjemplos() {
    if (!(await confirmar({ titulo: "Quitar opiniones de ejemplo", texto: `Se eliminarán las ${ejemplos} opiniones de ejemplo. La sección del inicio mostrará solo las opiniones reales.`, boton: "Quitar ejemplos", peligro: true }))) return;
    opiniones.filter((o) => o.ejemplo).forEach((o) => eliminar("opiniones", o.id));
    toast("Opiniones de ejemplo eliminadas");
  }
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  return (
    <div>
      <PageHeader titulo="Opiniones de clientes" subtitulo="Lo que publiques aquí aparece en el inicio de la web, en «Historias de éxito comercial».">
        {ejemplos > 0 && puede("editar") && <button className="btn btn-secondary !py-2.5" onClick={quitarEjemplos}>Quitar ejemplos</button>}
        {puede("editar") && <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Agregar opinión</button>}
      </PageHeader>
      {ejemplos > 0 && <div className="mb-5"><Aviso tipo="aviso">Hay {ejemplos} opiniones de ejemplo: en la web se ven con la etiqueta «Ejemplo». Reemplázalas por opiniones reales de tus clientes.</Aviso></div>}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat etiqueta="Publicadas" valor={opiniones.filter((o) => o.publicado).length} tono="verde" />
        <Stat etiqueta="Ocultas" valor={opiniones.filter((o) => !o.publicado).length} />
        <Stat etiqueta="Reales" valor={opiniones.filter((o) => !o.ejemplo).length} tono="marino" />
      </div>
      {opiniones.length === 0 ? <Vacio titulo="Sin opiniones" texto="Agrega la primera opinión de un cliente." /> : (
        <Tabla columnas={["Cliente", "Opinión", "Modelo", "Estrellas", "Estado", "Acciones"]}>
          {opiniones.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{o.nombre}</p><p className="text-[12px] text-slate-400">{o.sede} · {o.etiqueta}</p>{o.ejemplo && <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">Ejemplo</span>}</td>
              <td className="max-w-[360px] px-4 py-3 text-[13px] text-slate-600 dark:text-white/70">“{o.texto}”</td>
              <td className="px-4 py-3">{nombreModelo(o.modelo)}</td>
              <td className="px-4 py-3 text-acento">{"★".repeat(o.estrellas)}<span className="text-slate-300">{"★".repeat(5 - o.estrellas)}</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${o.publicado ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{o.publicado ? "Publicada" : "Oculta"}</span></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                {puede("editar") && <button className={btnMini} onClick={() => { actualizar("opiniones", o.id, { publicado: !o.publicado }); toast(o.publicado ? "Opinión oculta en la web" : "Opinión publicada"); }}>{o.publicado ? "Ocultar" : "Publicar"}</button>}
                {puede("editar") && <button className={btnMini} onClick={() => abrir(o)}>Editar</button>}
                {(puede("eliminar") || (o.ejemplo && puede("editar"))) && <button className={btnMiniPeligro} onClick={() => borrar(o)}>Eliminar</button>}
              </div></td>
            </tr>
          ))}
        </Tabla>
      )}

      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.o ? "Editar opinión" : "Agregar opinión"} ancho="max-w-xl"
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-op" className="btn btn-primary !py-2">Guardar</button></>}>
        <form id="f-op" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre que se mostrará" error={err.nombre} ayuda="Nombre y la inicial del apellido."><input id="op-nombre" className="field-input" maxLength={40} value={f.nombre} onChange={(e) => setF({ ...f, nombre: soloLetras(e.target.value, 40) })} placeholder="Rosa P." /></Campo>
          <Campo etiqueta="Sede"><select className="field-input" value={f.sede} onChange={set("sede")}>{SEDES_ATENCION.map((s) => <option key={s}>{s}</option>)}</select></Campo>
          <Campo etiqueta="Modelo que compró" error={err.modelo}><select id="op-modelo" className="field-input" value={f.modelo} onChange={set("modelo")}><option value="">Elige…</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Etiqueta"><select className="field-input" value={f.etiqueta} onChange={set("etiqueta")}>{ETIQUETAS_OPINION.map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <Campo etiqueta="Estrellas"><select className="field-input" value={f.estrellas} onChange={set("estrellas")}>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{"★".repeat(n)} ({n})</option>)}</select></Campo>
          <label className="flex items-end gap-2 pb-3 text-[14px] font-medium"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={f.publicado} onChange={(e) => setF({ ...f, publicado: e.target.checked })} />Publicar en la web</label>
          <Campo etiqueta={`Opinión del cliente (${f.texto.length}/240)`} error={err.texto} className="sm:col-span-2"><textarea id="op-texto" rows={3} maxLength={240} className="field-input" value={f.texto} onChange={set("texto")} /></Campo>
          <label className="flex items-start gap-2 text-[13.5px] sm:col-span-2"><input id="op-autoriza" type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0e2c52]" checked={f.autoriza} onChange={(e) => setF({ ...f, autoriza: e.target.checked })} />El cliente dio esta opinión y autorizó que se publique en la web.</label>
          {err.autoriza && <p className="-mt-2 text-[12px] font-medium text-acento sm:col-span-2">{err.autoriza}</p>}
        </form>
      </Modal>
    </div>
  );
}
