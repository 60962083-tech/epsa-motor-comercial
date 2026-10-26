// Seguimiento de interesados con la base central (docs/supabase-sprint2-conexiones.sql)
// El vendedor ve los interesados que tiene asignados (HU-015) y registra cada contacto: qué pasó, el nuevo
// estado (contactado, en seguimiento, venta concretada o cerrado) y el próximo contacto. El gerente y la
// administradora ven a todo el equipo. Cada registro queda en seguimientolead y cambia lead.estlea.
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useApp } from "../../store/appStore.jsx";
import { seguimientoListarApi, seguimientoRegistrarApi } from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { haceCuanto, limpiarTexto } from "../../lib/validar";
import { useConsultaCentral } from "../../servicios/central";
import { Aviso, Campo, Card, Modal, PageHeader, Stat, Vacio, btnMini, useToast } from "../ui";
import { Pestanas, Pill } from "./Sprint2";
import { AvisoConexion, BarraActualizacion, capital, fechaCompleta, sinApi } from "./Central";
import SeccionPendiente from "./SeccionPendiente";

// ---------------------------------------------------------------------------------------------
// Estados y tipos de contacto (los mismos que acepta la base)
// ---------------------------------------------------------------------------------------------
export const ETIQUETA_ESTADO = { Nuevo: "Nuevo", Contactado: "Contactado", "En seguimiento": "En seguimiento", Convertido: "Venta concretada", Cerrado: "Cerrado sin venta" };
export const TONO_ESTADO = { Nuevo: "celeste", Contactado: "marino", "En seguimiento": "ambar", Convertido: "verde", Cerrado: "gris" };
export const ABIERTO = (l) => ["Nuevo", "Contactado", "En seguimiento"].includes(l.estlea);
const TIPOS = ["Llamada", "WhatsApp", "Visita", "Prueba de manejo", "Correo", "Nota"];
const PAGOS = ["Contado", "Financiamiento", "Crédito directo"];
const diaLocal = (iso) => (iso ? new Date(iso).toLocaleDateString("en-CA") : "");
const hoyLocal = () => new Date().toLocaleDateString("en-CA");
const masUnAnio = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toLocaleDateString("en-CA"); };
const celular9 = (t) => String(t || "").replace(/\D/g, "").slice(-9);

// Situación de un interesado abierto según su próximo contacto
export function situacion(l, hoy = hoyLocal()) {
  if (!ABIERTO(l)) return "cerrado";
  const dia = diaLocal(l.proximo);
  if (!dia) return "sinFecha";
  if (dia < hoy) return "vencido";
  return dia === hoy ? "hoy" : "proximo";
}

// Lista de interesados y su historial (vendedor: los suyos; gerencia: todos)
export function useSeguimiento() {
  return useConsultaCentral(() => seguimientoListarApi().then((r) => (Array.isArray(r) ? r : [])), [], { clave: "seguimiento" });
}

// ---------------------------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------------------------
export default function SeguimientoCentral() {
  const { puede } = useAuth();
  const gestiona = puede("leads.asignar");
  const { state, pathname } = useLocation();
  const nav = useNavigate();
  const consulta = useSeguimiento();
  const [vista, setVista] = useState("pendientes");
  const [resp, setResp] = useState("");
  const [texto, setTexto] = useState("");
  const [registrar, setRegistrar] = useState(null); // { lead, venta }
  const [historial, setHistorial] = useState(null);
  const todos = useMemo(() => consulta.data || [], [consulta.data]);
  const hoy = hoyLocal();

  // Llegó desde Leads con un interesado elegido: se abre su registro
  useEffect(() => {
    if (!state?.codlea || !consulta.data) return;
    const l = consulta.data.find((x) => x.codlea === String(state.codlea));
    if (l) setRegistrar({ lead: l, venta: false });
    nav(pathname, { replace: true, state: null });
  }, [state?.codlea, consulta.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const responsables = useMemo(() => {
    const m = new Map();
    for (const l of todos) if (l.responsable) m.set(l.responsable.codusu, l.responsable.nombre);
    return [...m].map(([codusu, nombre]) => ({ codusu, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [todos]);
  const base = useMemo(() => todos.filter((l) => {
    if (resp === "__sin" ? l.responsable : resp && l.responsable?.codusu !== resp) return false;
    const q = limpiarTexto(texto).toLowerCase();
    return !q || `${l.nomlea} ${l.tellea} ${l.nommod || ""}`.toLowerCase().includes(q);
  }), [todos, resp, texto]);
  const cuenta = (s) => base.filter((l) => (s === "pendientes" ? ABIERTO(l) : situacion(l, hoy) === s)).length;
  const lista = useMemo(() => base
    .filter((l) => (vista === "pendientes" ? ABIERTO(l) : situacion(l, hoy) === vista))
    .sort((a, b) => (vista === "cerrado" ? 0 : (a.proximo || "9999").localeCompare(b.proximo || "9999"))), [base, vista, hoy]);

  if (sinApi(consulta) || consulta.error?.detalle?.faltaSql) return <SeccionPendiente titulo="Seguimiento" />;

  return (
    <div data-seguimiento-central>
      <PageHeader titulo="Seguimiento" subtitulo={gestiona ? "Interesados de todo el equipo y su próximo contacto. Lo que registra cada vendedor se ve aquí al instante." : "Tus interesados asignados. Registra cada contacto y deja programado el siguiente."} />
      <AvisoConexion consulta={consulta} que="los interesados" />

      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Para hoy" valor={consulta.data ? cuenta("hoy") : "—"} />
        <Stat etiqueta="Vencidos" valor={consulta.data ? cuenta("vencido") : "—"} tono={cuenta("vencido") ? "rojo" : "marino"} nota="Su fecha ya pasó" />
        <Stat etiqueta="Sin próximo contacto" valor={consulta.data ? cuenta("sinFecha") : "—"} tono={cuenta("sinFecha") ? "ambar" : "marino"} nota="Abiertos sin fecha" />
        <Stat etiqueta="Ventas concretadas" valor={consulta.data ? base.filter((l) => l.estlea === "Convertido").length : "—"} tono="verde" />
      </div>

      {/* Filtros */}
      <Card className="mb-5 space-y-3">
        <Pestanas valor={vista} onCambio={setVista} etiqueta="Interesados" opciones={[
          { id: "pendientes", label: "Abiertos", n: cuenta("pendientes") },
          { id: "hoy", label: "Hoy", n: cuenta("hoy") },
          { id: "vencido", label: "Vencidos", n: cuenta("vencido"), alerta: true },
          { id: "sinFecha", label: "Sin fecha", n: cuenta("sinFecha"), alerta: true },
          { id: "cerrado", label: "Cerrados", n: cuenta("cerrado") },
        ]} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><label className="field-label" htmlFor="seg-buscar">Buscar</label><input id="seg-buscar" className="field-input" value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} placeholder="Nombre, celular o modelo" /></div>
          {gestiona && <div><label className="field-label" htmlFor="seg-resp">Responsable</label>
            <select id="seg-resp" className="field-input" value={resp} onChange={(e) => setResp(e.target.value)}>
              <option value="">Todos</option><option value="__sin">Sin responsable</option>
              {responsables.map((r) => <option key={r.codusu} value={r.codusu}>{r.nombre}</option>)}
            </select></div>}
          <div className="flex items-end gap-3"><BarraActualizacion consulta={consulta} /></div>
        </div>
      </Card>

      {consulta.data && lista.length === 0 ? (
        <Vacio titulo={todos.length ? "No hay interesados en esta vista" : gestiona ? "Todavía no hay interesados" : "No tienes interesados asignados"} texto={todos.length ? "Prueba con otra pestaña o limpia la búsqueda." : gestiona ? "Llegan desde la web o se registran en Leads; ahí se asignan a un vendedor." : "Cuando la gerencia te asigne interesados en Leads, aparecerán aquí."} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((l) => <TarjetaInteresado key={l.codlea} l={l} hoy={hoy} gestiona={gestiona} onRegistrar={(venta) => setRegistrar({ lead: l, venta })} onHistorial={() => setHistorial(l)} />)}
        </div>
      )}
      <p className="mt-3 text-[12.5px] text-slate-400">Los interesados se asignan o transfieren en Leads.</p>

      <ModalContacto lead={registrar?.lead} venta={registrar?.venta} onClose={() => setRegistrar(null)} onHecho={() => consulta.refrescar(true)} />
      <ModalHistorial lead={historial} onClose={() => setHistorial(null)} />
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Tarjeta de un interesado
// ---------------------------------------------------------------------------------------------
function TarjetaInteresado({ l, hoy, gestiona, onRegistrar, onHistorial }) {
  const s = situacion(l, hoy);
  const ultimo = l.historial?.[0];
  const cel = celular9(l.tellea);
  return (
    <Card className={s === "vencido" ? "!border-acento/40" : s === "hoy" ? "!border-marino-700/30" : ""}>
      <div data-seguimiento={l.codlea}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-bold text-marino dark:text-white">{l.nomlea}</p>
            <p className="text-[12.5px] text-slate-400">{l.tellea || "Sin celular"}{l.nommod && ` · ${l.nommod}`}{l.collea && ` · ${capital(l.collea)}`}</p>
          </div>
          <Pill tono={TONO_ESTADO[l.estlea] || "gris"}>{ETIQUETA_ESTADO[l.estlea] || l.estlea}</Pill>
        </div>
        <p className={`mt-3 text-[13.5px] font-semibold ${s === "vencido" ? "text-acento" : s === "sinFecha" ? "text-amber-700 dark:text-amber-300" : "text-marino dark:text-white"}`}>
          {s === "cerrado" ? `Cerrado ${ultimo ? haceCuanto(ultimo.fecha) : ""}` : s === "sinFecha" ? "Sin próximo contacto" : `${s === "vencido" ? "Vencido: " : s === "hoy" ? "Hoy: " : "Próximo: "}${fechaCompleta(l.proximo)}`}
        </p>
        {ultimo ? <p className="mt-1 line-clamp-3 text-[13px] text-slate-600 dark:text-slate-300"><span className="font-medium">{ultimo.tipo}</span>, {haceCuanto(ultimo.fecha)}{ultimo.usuario ? ` por ${ultimo.usuario}` : ""}: {ultimo.detalle || "sin detalle"}</p>
          : <p className="mt-1 text-[13px] text-slate-500">Aún sin contactos registrados. {l.canlea === "Web" ? "Llegó desde la web." : `Llegó por ${l.canlea}.`}</p>}
        {l.obslea && !ultimo && <p className="mt-1 line-clamp-2 text-[12.5px] text-slate-400">{l.obslea}</p>}
        {gestiona && <p className="mt-1 text-[12.5px] text-slate-400">{l.responsable ? `A cargo de ${l.responsable.nombre}` : "Sin responsable: asígnalo en Leads"}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={btnMini} onClick={() => onRegistrar(false)} data-registrar-contacto>Registrar contacto</button>
          {ABIERTO(l) && <button className={btnMini} onClick={() => onRegistrar(true)} data-venta-concretada>Venta concretada</button>}
          {l.historial?.length > 0 && <button className={btnMini} onClick={onHistorial}>Historial ({l.historial.length})</button>}
          {cel.length === 9 && <a className={btnMini} target="_blank" rel="noopener noreferrer" href={`https://wa.me/51${cel}?text=${encodeURIComponent(`Hola ${l.nomlea.split(" ")[0]}, te saluda EPSA Motor.`)}`}>WhatsApp</a>}
          {cel.length === 9 && <a className={btnMini} href={`tel:+51${cel}`}>Llamar</a>}
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------------------------
// Registrar un contacto (o la venta concretada)
// ---------------------------------------------------------------------------------------------
export function ModalContacto({ lead, venta = false, onClose, onHecho }) {
  const toast = useToast();
  const nav = useNavigate();
  const { publicos = [] } = useApp();
  // Precio del modelo en la base: la venta ya lo trae puesto (se puede cambiar si se acordó otro)
  const precio = publicos.find((m) => String(m.codmodApi) === String(lead?.codmod))?.precioDesde;
  const [f, setF] = useState({});
  const [err, setErr] = useState({});
  const [enviando, setEnviando] = useState(false);
  useEffect(() => {
    if (!lead) return;
    setF({ tipo: venta ? "Venta" : "Llamada", detalle: "", estado: venta ? "Convertido" : "", fecha: "", hora: "10:00", pago: PAGOS[0], monto: precio ? String(precio) : "" });
    setErr({}); setEnviando(false);
  }, [lead?.codlea, venta]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lead) return null;
  const hoy = hoyLocal();
  const cierra = ["Convertido", "Cerrado"].includes(f.estado || lead.estlea);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v, ...(k === "estado" && ["Convertido", "Cerrado"].includes(v) ? { fecha: "" } : {}) })); setErr((x) => ({ ...x, [k]: undefined, general: undefined })); };

  function validar() {
    const x = {};
    const det = limpiarTexto(f.detalle);
    if (!venta && (det.length < 5 || (det.match(/[\p{L}\d]/gu) || []).length < 5)) x.detalle = "Cuenta brevemente qué pasó (mínimo 5 letras o números).";
    if (det.length > 800) x.detalle = "Máximo 800 caracteres.";
    if (venta && f.monto && !(Number(f.monto) > 0 && Number(f.monto) < 1000000)) x.monto = "Escribe un monto válido o déjalo vacío.";
    if (f.fecha && f.fecha < hoy) x.fecha = "La fecha no puede ser anterior a hoy.";
    else if (f.fecha && f.fecha > masUnAnio()) x.fecha = "Elige una fecha dentro del próximo año.";
    else if (f.fecha && f.fecha === hoy && f.hora && new Date(`${f.fecha}T${f.hora}:00`) < new Date()) x.fecha = "Esa hora ya pasó: elige una más tarde.";
    setErr(x); return Object.keys(x).length === 0;
  }

  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    const det = limpiarTexto(f.detalle);
    const detalle = venta ? ["Venta concretada", f.pago, f.monto ? `S/ ${Number(f.monto).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : "", det].filter(Boolean).join(" · ") : det;
    setEnviando(true);
    try {
      await seguimientoRegistrarApi({ codlea: lead.codlea, tipo: f.tipo, detalle, estado: f.estado || null, proximo: f.fecha && !cierra ? new Date(`${f.fecha}T${f.hora || "10:00"}:00`).toISOString() : null });
      toast(venta ? `Venta concretada con ${lead.nomlea}` : f.fecha && !cierra ? `Contacto guardado. Próximo: ${f.fecha}` : "Contacto guardado");
      onHecho?.(); onClose();
    } catch (er) {
      setErr({ general: mensajeError(er) }); setEnviando(false);
    }
  }

  return (
    <Modal abierto onClose={onClose} titulo={venta ? `Venta concretada · ${lead.nomlea}` : `Registrar contacto · ${lead.nomlea}`} ancho="max-w-lg"
      confirmarGuardar={venta ? { titulo: "¿Registrar la venta?", texto: `${lead.nomlea} quedará como «Venta concretada»${lead.nommod ? ` por el ${lead.nommod}` : ""}.`, boton: "Registrar venta", validar } : false}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-contacto" className="btn btn-primary !py-2" disabled={enviando}>{enviando ? "Guardando…" : venta ? "Registrar venta" : "Guardar"}</button></>}>
      <form id="f-contacto" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate data-modal-contacto>
        <p className="text-[13px] text-slate-500 sm:col-span-2">{lead.tellea}{lead.nommod ? ` · ${lead.nommod}` : ""} · Estado actual: <b>{ETIQUETA_ESTADO[lead.estlea] || lead.estlea}</b></p>
        {venta ? <>
          <Campo etiqueta="Forma de pago"><select id="ct-pago" className="field-input" value={f.pago} onChange={(e) => set("pago", e.target.value)}>{PAGOS.map((p) => <option key={p}>{p}</option>)}</select></Campo>
          <Campo etiqueta="Monto de la venta (S/)" error={err.monto} ayuda={precio ? "Precio del modelo en la web; cámbialo si acordaron otro." : "Escribe el monto acordado."}><input id="ct-monto" className="field-input" inputMode="decimal" value={f.monto} onChange={(e) => set("monto", e.target.value.replace(/[^\d.]/g, "").slice(0, 10))} placeholder="Ej: 17899" /></Campo>
          <Campo etiqueta="Detalle (opcional)" className="sm:col-span-2" error={err.detalle}><textarea id="ct-detalle" rows={3} maxLength={820} className="field-input" value={f.detalle} onChange={(e) => set("detalle", e.target.value)} placeholder="Ej: recoge la moto el sábado en la sede Comas" /></Campo>
        </> : <>
          <Campo etiqueta="Tipo de contacto"><select id="ct-tipo" className="field-input" value={f.tipo} onChange={(e) => set("tipo", e.target.value)}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo etiqueta="Estado del interesado"><select id="ct-estado" className="field-input" value={f.estado} onChange={(e) => set("estado", e.target.value)}>
            <option value="">{lead.estlea === "Nuevo" ? "Contactado (primer contacto)" : "Sin cambios"}</option>
            {["Contactado", "En seguimiento", "Cerrado"].filter((x) => x !== lead.estlea).map((x) => <option key={x} value={x}>{ETIQUETA_ESTADO[x]}</option>)}
          </select></Campo>
          <Campo etiqueta="¿Qué pasó en el contacto?" className="sm:col-span-2" error={err.detalle}><textarea id="ct-detalle" rows={3} maxLength={820} className="field-input" value={f.detalle} onChange={(e) => set("detalle", e.target.value)} placeholder="Ej: le envié la cotización, decide el fin de semana" /></Campo>
          <Campo etiqueta="Próximo contacto" error={err.fecha} ayuda={cierra ? "No hace falta si queda cerrado" : "Déjalo vacío si no hace falta"}><input id="ct-fecha" type="date" min={hoy} max={masUnAnio()} className="field-input" value={f.fecha} disabled={cierra} onChange={(e) => set("fecha", e.target.value)} /></Campo>
          <Campo etiqueta="Hora"><input id="ct-hora" type="time" className="field-input" value={f.hora} disabled={cierra || !f.fecha} onChange={(e) => set("hora", e.target.value)} /></Campo>
        </>}
        {err.general && <div className="sm:col-span-2"><Aviso tipo="error">{err.general}</Aviso></div>}
        {venta && <p className="text-[12.5px] text-slate-400 sm:col-span-2">La venta queda en el historial del interesado y en Ventas a clientes. <button type="button" className="font-semibold underline" onClick={() => { onClose(); nav("/admin/ventas"); }}>Ver ventas</button></p>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Historial de contactos de un interesado
// ---------------------------------------------------------------------------------------------
function ModalHistorial({ lead, onClose }) {
  if (!lead) return null;
  return (
    <Modal abierto onClose={onClose} titulo={`Historial · ${lead.nomlea}`} ancho="max-w-lg" sinAvisoCambios confirmarGuardar={false}
      pie={<button className="btn btn-secondary !py-2" onClick={onClose}>Cerrar</button>}>
      <ol className="space-y-3" data-historial>
        {lead.historial.map((h) => (
          <li key={h.codsle} className="rounded-xl border border-slate-100 px-4 py-3 dark:border-white/10">
            <p className="text-[12.5px] text-slate-400">{fechaCompleta(h.fecha)}{h.usuario ? ` · ${h.usuario}` : ""}</p>
            <p className="mt-0.5 text-[14px]"><b className="text-marino dark:text-white">{h.tipo}</b>{h.detalle ? `: ${h.detalle}` : ""}</p>
            {h.proximo && <p className="mt-0.5 text-[12.5px] text-slate-500">Próximo contacto: {fechaCompleta(h.proximo)}</p>}
          </li>
        ))}
      </ol>
      {lead.obslea && <p className="mt-4 text-[12.5px] text-slate-500">Al registrarse: {lead.obslea}</p>}
    </Modal>
  );
}
