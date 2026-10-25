// HU-003 · Ventanas para recibir, trasladar y confirmar la llegada de una moto
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { CHECKLIST_RECEPCION, TIPOS_UBICACION } from "../../data/mockData";
import { useMovimientos } from "../../servicios/movimientos";
import { nombreTecho } from "../../servicios/preparacion";
import { fechaHora, haceCuanto } from "../../lib/validar";
import { Aviso, Campo, Modal, useToast } from "../ui";
import { ColorPunto, Pill, TONO_DISPONIBILIDAD } from "./Sprint2";

// Fecha para <input type="datetime-local"> en hora local
export const aInputFecha = (d = new Date()) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 16);
};
// Al corregir un campo se borra su error
export const sinError = (setErr, ...k) => setErr((e) => Object.fromEntries(Object.entries(e).filter(([x]) => !k.includes(x) && x !== "general")));
export const nombreModeloDe = (u, modelos = [], publicos = []) => (modelos.find((m) => m.id === u?.modelo) || publicos.find((m) => m.id === u?.modelo))?.nombre || u?.nombreModelo || u?.modelo || "Modelo";

// Resumen de la moto dentro de cada ventana
function FichaCorta({ u }) {
  const { modelos, publicos } = useApp();
  if (!u) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-marino-50 px-4 py-3 dark:bg-white/5">
      <div className="min-w-0">
        <p className="font-bold text-marino dark:text-white">{u.id} <span className="font-semibold text-slate-500 dark:text-white/60">{nombreModeloDe(u, modelos, publicos)}</span></p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-slate-500"><ColorPunto color={u.color} className="h-2.5 w-2.5" />{u.color}<span aria-hidden="true">/</span>motor {u.motor}<span aria-hidden="true">/</span>chasis {u.chasis}</p>
      </div>
      <Pill tono={TONO_DISPONIBILIDAD[u.disponibilidad]}>{u.disponibilidad}</Pill>
    </div>
  );
}

// Selector de destino agrupado por tipo
function SelectDestino({ id, valor, onCambio, opciones }) {
  return (
    <select id={id} className="field-input" value={valor} onChange={(e) => onCambio(e.target.value)}>
      <option value="">Elige…</option>
      {TIPOS_UBICACION.map((t) => {
        const grupo = opciones.filter((o) => o.tipo === t);
        return grupo.length ? <optgroup key={t} label={t === "Sede propia" ? "Sedes" : t === "Almacén externo" ? "Almacenes" : "Proveedores de techo"}>{grupo.map((o) => <option key={o.id} value={o.nombre}>{o.nombre}</option>)}</optgroup> : null;
      })}
    </select>
  );
}

// Recibir una moto que llega de Crosland
export function ModalRecibir({ unidad, onClose, onHecho }) {
  const mv = useMovimientos();
  const toast = useToast();
  const opciones = mv.destinosPara(mv.origenRecepcion);
  const [d, setD] = useState({});
  const [err, setErr] = useState({});
  useEffect(() => {
    if (!unidad) return;
    setErr({});
    setD({ destino: opciones.find((o) => o.tipo === "Sede propia")?.nombre || opciones[0]?.nombre || "", llegada: aInputFecha(), checklist: [...CHECKLIST_RECEPCION], obs: "" });
  }, [unidad?.id]); // eslint-disable-line
  const validar = () => { const x = mv.validarRecepcion(unidad, d); setErr(x); return Object.keys(x).length === 0; };
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const faltantes = CHECKLIST_RECEPCION.filter((c) => !d.checklist.includes(c));
    toast(mv.recibir(unidad, { ...d, faltantes }));
    onHecho?.(); onClose();
  }
  const marcar = (c) => setD((p) => ({ ...p, checklist: p.checklist.includes(c) ? p.checklist.filter((x) => x !== c) : [...p.checklist, c] }));
  return (
    <Modal abierto={!!unidad} onClose={onClose} titulo={`Recibir ${unidad?.id || ""}`} ancho="max-w-xl"
      confirmarGuardar={unidad ? { titulo: "¿Registrar la recepción?", texto: `${unidad.id} quedará en ${d.destino || "—"}, llegada ${fechaHora(d.llegada)}. Queda «No disponible» hasta completar su preparación.`, boton: "Registrar recepción", validar } : false}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-recibir" className="btn btn-primary !py-2">Registrar recepción</button></>}>
      {unidad && (
        <form id="f-recibir" onSubmit={guardar} className="grid gap-4" noValidate>
          <FichaCorta u={unidad} />
          {err.general && <Aviso tipo="error">{err.general}</Aviso>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Llega desde"><p className="field-input !bg-slate-50 text-slate-600 dark:!bg-white/5 dark:text-white/70">{mv.origenRecepcion}</p></Campo>
            <Campo etiqueta="¿Dónde llegó?" error={err.destino}><SelectDestino id="rec-destino" valor={d.destino || ""} onCambio={(v) => { setD({ ...d, destino: v }); sinError(setErr, "destino"); }} opciones={opciones} /></Campo>
            <Campo etiqueta="Fecha y hora de llegada" error={err.llegada}><input id="rec-llegada" type="datetime-local" className="field-input" max={aInputFecha()} value={d.llegada || ""} onChange={(e) => { setD({ ...d, llegada: e.target.value }); sinError(setErr, "llegada"); }} /></Campo>
          </div>
          <fieldset>
            <legend className="field-label">Revisión al llegar</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CHECKLIST_RECEPCION.map((c) => (
                <label key={c} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13.5px] transition ${d.checklist?.includes(c) ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>
                  <input type="checkbox" className="h-4 w-4 accent-emerald-600" checked={!!d.checklist?.includes(c)} onChange={() => marcar(c)} />{c}
                </label>
              ))}
            </div>
            <p className="mt-1.5 text-[12px] text-slate-400">Desmarca lo que no llegó: quedará anotado como faltante.</p>
          </fieldset>
          <Campo etiqueta="Observación (opcional)" error={err.obs}><textarea id="rec-obs" rows={2} maxLength={320} className="field-input" value={d.obs || ""} onChange={(e) => { setD({ ...d, obs: e.target.value }); sinError(setErr, "obs"); }} placeholder="Ej: espejo izquierdo con rayón leve" /></Campo>
        </form>
      )}
    </Modal>
  );
}

// Trasladar una moto entre ubicaciones
export function ModalTraslado({ abierto, unidad: fija, onClose, onHecho }) {
  const { unidades, modelos, publicos, separaciones = [], clientes = [] } = useApp();
  const mv = useMovimientos();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [d, setD] = useState({ unidad: "", destino: "", llego: false, motivo: "" });
  const [err, setErr] = useState({});
  useEffect(() => { if (abierto) { setErr({}); setQ(""); setD({ unidad: fija?.id || "", destino: "", llego: false, motivo: "" }); } }, [abierto, fija?.id]);
  const elegibles = useMemo(() => unidades.filter((u) => u.ubicacion && u.disponibilidad !== "Vendida" && !mv.transitoDe(u.id)), [unidades, mv]);
  const visibles = elegibles.filter((u) => !q || `${u.id} ${u.motor} ${u.chasis} ${nombreModeloDe(u, modelos, publicos)} ${u.ubicacion}`.toLowerCase().includes(q.toLowerCase())).slice(0, 40);
  const u = unidades.find((x) => x.id === d.unidad);
  const opciones = u ? mv.destinosPara(u.ubicacion) : [];
  const sep = u && separaciones.find((s) => s.unidad === u.id && s.estado === "Activa");
  const clienteSep = sep && clientes.find((c) => c.id === sep.cliente);
  const sale = u && d.destino && mv.saleDeLaVenta(u, d.destino);
  const validar = () => { const x = mv.validarTraslado(u, d); setErr(x); return Object.keys(x).length === 0; };
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    toast(mv.trasladar(u, d));
    onHecho?.(d.llego); onClose();
  }
  return (
    <Modal abierto={abierto} onClose={onClose} titulo={fija ? `Trasladar ${fija.id}` : "Registrar traslado"} ancho="max-w-xl"
      confirmarGuardar={{ titulo: "¿Registrar el traslado?", texto: u ? `${u.id}: ${u.ubicacion} → ${d.destino || "—"}. ${d.llego ? "Se registra como ya llegado." : "Quedará en tránsito hasta que confirmes su llegada."}` : "", boton: "Registrar traslado", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-traslado" className="btn btn-primary !py-2">Registrar traslado</button></>}>
      <form id="f-traslado" onSubmit={guardar} className="grid gap-4" noValidate>
        {!fija && (
          <Campo etiqueta="Moto" error={err.unidad}>
            <input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Busca por código, modelo, motor o sede" aria-label="Buscar moto" />
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1" role="radiogroup" aria-label="Motos que se pueden trasladar">
              {visibles.length === 0 && <p className="py-4 text-center text-[13px] text-slate-400">No hay motos con ese criterio.</p>}
              {visibles.map((x) => (
                <label key={x.id} className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 text-[13.5px] transition ${d.unidad === x.id ? "border-marino-700 bg-marino-50 dark:border-white/40 dark:bg-white/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <input type="radio" name="tr-unidad" className="accent-[#0e2c52]" checked={d.unidad === x.id} onChange={() => { setD({ ...d, unidad: x.id, destino: "" }); setErr({}); }} />
                    <span className="min-w-0"><span className="font-semibold text-marino dark:text-white">{x.id}</span> <span className="text-slate-500">{nombreModeloDe(x, modelos, publicos)}</span><span className="flex items-center gap-1.5 text-[12px] text-slate-400"><ColorPunto color={x.color} className="h-2 w-2" />{x.color} en {x.ubicacion}</span></span>
                  </span>
                  <Pill tono={TONO_DISPONIBILIDAD[x.disponibilidad]}>{x.disponibilidad}</Pill>
                </label>
              ))}
            </div>
          </Campo>
        )}
        {fija && <FichaCorta u={u || fija} />}
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
        {u && <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Sale de"><p className="field-input !bg-slate-50 text-slate-600 dark:!bg-white/5 dark:text-white/70">{u.ubicacion}</p></Campo>
            <Campo etiqueta="Destino" error={err.destino}><SelectDestino id="tr-destino" valor={d.destino} onCambio={(v) => { setD({ ...d, destino: v }); sinError(setErr, "destino"); }} opciones={opciones} /></Campo>
          </div>
          {sep && <Aviso tipo="aviso">Está separada para {clienteSep ? [clienteSep.nombres, clienteSep.apellidoPaterno].filter(Boolean).join(" ") || clienteSep.razonSocial : "un cliente"} (vendedor: {sep.vendedor}). Avísale antes de moverla.</Aviso>}
          {sale && <Aviso tipo="aviso">{d.destino} es proveedor de techo: la moto saldrá de la venta mientras esté allí.</Aviso>}
          <fieldset>
            <legend className="field-label">¿Cómo lo registras?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[[false, "Sale ahora", "Queda en tránsito hasta que confirmes su llegada."], [true, "Ya llegó", "Se registra como traslado terminado."]].map(([v, t, s]) => (
                <label key={t} className={`cursor-pointer rounded-xl border-2 p-3 transition ${d.llego === v ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>
                  <span className="flex items-center gap-2"><input type="radio" name="tr-llego" className="accent-[#0e2c52]" checked={d.llego === v} onChange={() => setD({ ...d, llego: v })} /><span className="text-[14px] font-semibold text-marino dark:text-white">{t}</span></span>
                  <span className="mt-1 block pl-6 text-[12.5px] text-slate-500">{s}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Campo etiqueta="Motivo (opcional)" error={err.motivo}><input id="tr-motivo" className="field-input" maxLength={220} value={d.motivo} onChange={(e) => { setD({ ...d, motivo: e.target.value }); sinError(setErr, "motivo"); }} placeholder="Ej: un cliente de Comas quiere verla" /></Campo>
        </>}
      </form>
    </Modal>
  );
}

// Confirmar la llegada de un traslado
export function ModalLlegada({ movimiento: m, onClose, onHecho }) {
  const { unidades } = useApp();
  const mv = useMovimientos();
  const toast = useToast();
  const [d, setD] = useState({});
  const [err, setErr] = useState({});
  const u = m && unidades.find((x) => x.id === m.unidad);
  const desdeProveedor = m && mv.lugar(m.origen)?.tipo === "Proveedor de techo" && u?.estadoTecho === "Pendiente de instalación";
  useEffect(() => { if (m) { setErr({}); setD({ llegada: aInputFecha(), obs: "", techoInstalado: true }); } }, [m?.id]); // eslint-disable-line
  const validar = () => { const x = mv.validarLlegada(m, d); setErr(x); return Object.keys(x).length === 0; };
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const r = mv.confirmarLlegada(m, d);
    toast(r.instalado ? `${r.texto} Techo marcado como instalado.` : r.texto);
    onHecho?.(); onClose();
  }
  return (
    <Modal abierto={!!m} onClose={onClose} titulo={`Confirmar llegada de ${m?.unidad || ""}`} ancho="max-w-lg"
      confirmarGuardar={m ? { titulo: "¿Confirmar la llegada?", texto: `${m.unidad} quedará en ${m.destino}.`, boton: "Confirmar llegada", validar } : false}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-llegada" className="btn btn-primary !py-2">Confirmar llegada</button></>}>
      {m && (
        <form id="f-llegada" onSubmit={guardar} className="grid gap-4" noValidate>
          <FichaCorta u={u} />
          <p className="text-[13.5px] text-slate-600 dark:text-white/70">Salió de <b>{m.origen}</b> hacia <b>{m.destino}</b> el {fechaHora(m.salida)} ({haceCuanto(m.salida)}).{m.motivo ? ` Motivo: ${m.motivo}.` : ""}</p>
          {err.general && <Aviso tipo="error">{err.general}</Aviso>}
          <Campo etiqueta="Fecha y hora de llegada" error={err.llegada}><input id="lle-fecha" type="datetime-local" className="field-input" max={aInputFecha()} min={aInputFecha(m.salida)} value={d.llegada || ""} onChange={(e) => { setD({ ...d, llegada: e.target.value }); sinError(setErr, "llegada"); }} /></Campo>
          {desdeProveedor && (
            <label className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13.5px] text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={!!d.techoInstalado} onChange={(e) => setD({ ...d, techoInstalado: e.target.checked })} />
              El {nombreTecho(u.techo)} llegó instalado por {m.origen}.
            </label>
          )}
          <Campo etiqueta="Observación (opcional)" error={err.obs}><textarea rows={2} maxLength={320} className="field-input" value={d.obs || ""} onChange={(e) => setD({ ...d, obs: e.target.value })} placeholder="Ej: llegó sin observaciones" /></Campo>
        </form>
      )}
    </Modal>
  );
}
