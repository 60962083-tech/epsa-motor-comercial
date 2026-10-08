import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { Campo, Card, Modal, PageHeader, Stat, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";

const TIPOS = ["Llamada", "WhatsApp", "Visita", "Prueba de manejo", "Correo"];
const hoyISO = () => new Date().toISOString().slice(0, 10);
const masDias = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/**
 * Seguimiento comercial de cada lead (tabla seguimientolead: tipsle, dessle, fecprosle).
 * Se alimenta solo: cada cotización de la web y cada lead manual crean su primer contacto.
 * Al cumplir una tarea se registra el resultado y, si hace falta, se agenda la siguiente.
 */
export default function Seguimiento() {
  const { seguimientos, leads, equipo, modelos, agregar, actualizar, eliminar } = useApp();
  const { puede, user } = useAuth();
  const { state } = useLocation();
  const nav = useNavigate();
  const toast = useToast(); const confirmar = useConfirm();
  const [vista, setVista] = useState("pendientes");
  const [resp, setResp] = useState(user.rol === "vendedor" ? user.nombre : "");
  const [leadId, setLeadId] = useState(state?.leadId ? String(state.leadId) : "");
  const [modal, setModal] = useState(false);
  const [f, setF] = useState({});
  const [err, setErr] = useState("");
  const [cierre, setCierre] = useState(null); // seguimiento que se está cerrando
  const [c, setC] = useState({ resultado: "", proxima: "", tipo: "Llamada", estadoLead: "" });
  const hoy = hoyISO();
  const lead = (id) => leads.find((l) => l.id === id);
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || "";
  const vendedores = equipo.filter((p) => p.rol !== "gerente" && p.activo);

  const lista = useMemo(() => seguimientos.filter((s) => {
    if (leadId && s.leadId !== Number(leadId)) return false;
    if (resp && s.responsable !== resp) return false;
    if (vista === "hoy") return !s.hecho && s.fecha === hoy;
    if (vista === "pendientes") return !s.hecho;
    if (vista === "vencidos") return !s.hecho && s.fecha < hoy;
    return s.hecho;
  }).sort((a, b) => (vista === "hechos" ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha))), [seguimientos, vista, resp, leadId, hoy]);

  const mios = seguimientos.filter((s) => !resp || s.responsable === resp);
  const conteo = (fn) => mios.filter(fn).length;

  const abrir = () => { setErr(""); setF({ leadId: leadId || leads[0]?.id, tipo: "Llamada", fecha: hoy, detalle: "", responsable: user.rol === "vendedor" ? user.nombre : vendedores[0]?.nombre }); setModal(true); };
  function validar() {
    if (!f.leadId) { setErr("Elige el lead."); return false; }
    if (f.detalle.trim().length < 3) { setErr("Describe qué hay que hacer."); return false; }
    if (f.fecha < hoy) { setErr("La fecha no puede ser anterior a hoy."); return false; }
    setErr(""); return true;
  }
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    agregar("seguimientos", { ...f, detalle: f.detalle.trim(), leadId: Number(f.leadId), hecho: false }, `Seguimiento creado para ${lead(Number(f.leadId))?.contacto}`);
    const l = lead(Number(f.leadId)); if (l?.estado === "Nuevo") actualizar("leads", l.id, { estado: "En seguimiento" });
    toast("Seguimiento programado"); setModal(false);
  }

  function abrirCierre(s) { setC({ resultado: "", proxima: masDias(2), tipo: s.tipo, estadoLead: "" }); setCierre(s); }
  function cerrarTarea(e) {
    e.preventDefault();
    if (c.proxima && c.proxima < hoy) return toast("La próxima fecha no puede ser anterior a hoy.", "error");
    const l = lead(cierre.leadId);
    actualizar("seguimientos", cierre.id, { hecho: true, resultado: c.resultado.trim(), cerrado: hoy }, `Seguimiento cumplido: ${l?.contacto}`);
    if (c.proxima) agregar("seguimientos", { leadId: cierre.leadId, fecha: c.proxima, tipo: c.tipo, responsable: cierre.responsable, hecho: false, detalle: c.resultado.trim() ? `Continuar: ${c.resultado.trim()}` : "Nuevo contacto" });
    if (l) actualizar("leads", l.id, { estado: c.estadoLead || (l.estado === "Nuevo" ? "En seguimiento" : l.estado) });
    toast(c.proxima ? `Cumplido. Próximo contacto el ${c.proxima}` : "Marcado como cumplido");
    setCierre(null);
  }
  async function reabrir(s) {
    if (!(await confirmar({ titulo: "Reabrir seguimiento", texto: "La tarea volverá a la lista de pendientes.", boton: "Reabrir" }))) return;
    actualizar("seguimientos", s.id, { hecho: false }, `Seguimiento reabierto: ${lead(s.leadId)?.contacto}`); toast("Reabierto");
  }

  return (
    <div>
      <PageHeader titulo="Seguimiento" subtitulo="Llamadas, mensajes y visitas con cada interesado. Las cotizaciones de la web crean aquí su primer contacto.">
        <button className="btn btn-primary !py-2.5" onClick={abrir}>+ Programar seguimiento</button>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Para hoy" valor={conteo((s) => !s.hecho && s.fecha === hoy)} tono="marino" />
        <Stat etiqueta="Vencidos" valor={conteo((s) => !s.hecho && s.fecha < hoy)} tono="rojo" />
        <Stat etiqueta="Próximos 7 días" valor={conteo((s) => !s.hecho && s.fecha > hoy && s.fecha <= masDias(7))} tono="ambar" />
        <Stat etiqueta="Cumplidos" valor={conteo((s) => s.hecho)} tono="verde" />
      </div>

      <Card className="mb-5 flex flex-wrap items-end gap-3">
        <div className="no-scrollbar flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-0.5 text-[13px] dark:bg-white/10">
          {[["hoy", `Hoy (${conteo((s) => !s.hecho && s.fecha === hoy)})`], ["pendientes", `Pendientes (${conteo((s) => !s.hecho)})`], ["vencidos", `Vencidos (${conteo((s) => !s.hecho && s.fecha < hoy)})`], ["hechos", `Cumplidos (${conteo((s) => s.hecho)})`]].map(([k, l]) => (
            <button key={k} onClick={() => setVista(k)} className={`shrink-0 rounded-md px-3 py-1.5 font-semibold ${vista === k ? "bg-white text-marino shadow dark:bg-marino-700 dark:text-white" : "text-slate-500"}`}>{l}</button>
          ))}
        </div>
        <div><label className="field-label">Responsable</label><select className="field-input" value={resp} onChange={(e) => setResp(e.target.value)}><option value="">Todos</option>{vendedores.map((v) => <option key={v.id}>{v.nombre}</option>)}</select></div>
        <div><label className="field-label">Lead</label><select className="field-input" value={leadId} onChange={(e) => setLeadId(e.target.value)}><option value="">Todos</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.contacto}</option>)}</select></div>
      </Card>

      {lista.length === 0 ? <Vacio titulo="Nada por aquí" texto={vista === "hechos" ? "Aún no hay seguimientos cumplidos." : "No hay seguimientos con este filtro."} /> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {lista.map((s) => {
            const l = lead(s.leadId); const vencido = !s.hecho && s.fecha < hoy; const esHoy = !s.hecho && s.fecha === hoy;
            return (
              <Card key={s.id} className={vencido ? "!border-acento/40" : esHoy ? "!border-marino-700/30" : ""}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-marino dark:text-white">{l?.contacto || "Lead eliminado"}</p>
                    <p className="text-[12.5px] text-slate-400">{l?.telefono}{l?.modelo && ` · ${nombreModelo(l.modelo)}`}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${s.hecho ? "bg-emerald-100 text-emerald-700" : vencido ? "bg-red-100 text-red-700" : esHoy ? "bg-marino text-white" : "bg-sky-100 text-sky-700"}`}>{s.hecho ? "Cumplido" : vencido ? "Vencido" : esHoy ? "Hoy" : s.tipo}</span>
                </div>
                <p className="mt-3 text-[14px]">{s.detalle}</p>
                {s.resultado && <p className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-200">Resultado: {s.resultado}</p>}
                <p className="mt-1 text-[12.5px] text-slate-400">{s.tipo} · {s.fecha} · {s.responsable}{l?.canal && ` · vino por ${l.canal}`}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.hecho ? <button className={btnMini} onClick={() => reabrir(s)}>Reabrir</button> : <button className={btnMini} onClick={() => abrirCierre(s)}>Marcar cumplido</button>}
                  {l && <a className={btnMini} target="_blank" rel="noopener noreferrer" href={`https://wa.me/51${l.telefono}?text=${encodeURIComponent(`Hola ${l.contacto}, te saluda ${s.responsable} de EPSA Motor.`)}`}>WhatsApp</a>}
                  {l && <a className={btnMini} href={`tel:+51${l.telefono}`}>Llamar</a>}
                  {l && <button className={btnMini} onClick={() => nav("/admin/ventas", { state: { lead: l } })}>Vender</button>}
                  {puede("eliminar") && <button className={btnMiniPeligro} onClick={async () => { if (await confirmar({ titulo: "Eliminar seguimiento", texto: `¿Eliminar esta tarea de ${l?.contacto || "este lead"}? No se puede deshacer.`, boton: "Eliminar", peligro: true })) { eliminar("seguimientos", s.id, "Seguimiento eliminado"); toast("Seguimiento eliminado"); } }}>Eliminar</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal abierto={modal} onClose={() => setModal(false)} titulo="Programar seguimiento" confirmarGuardar={{ titulo: "¿Programar este seguimiento?", texto: `${f.tipo || ""} con ${lead(Number(f.leadId))?.contacto || "el lead"} el ${f.fecha || ""}, a cargo de ${f.responsable || ""}.`, boton: "Programar", validar }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(false)}>Cancelar</button><button form="f-seg" className="btn btn-primary !py-2">Guardar</button></>}>
        <form id="f-seg" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Lead" className="sm:col-span-2"><select className="field-input" value={f.leadId} onChange={(e) => setF({ ...f, leadId: e.target.value })}>{leads.map((l) => <option key={l.id} value={l.id}>{l.contacto} · {l.telefono}</option>)}</select></Campo>
          <Campo etiqueta="Tipo"><select className="field-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo etiqueta="Fecha"><input type="date" className="field-input" min={hoy} value={f.fecha} onChange={(e) => setF({ ...f, fecha: e.target.value })} /></Campo>
          <Campo etiqueta="Responsable" className="sm:col-span-2"><select className="field-input" value={f.responsable} onChange={(e) => setF({ ...f, responsable: e.target.value })}>{vendedores.map((v) => <option key={v.id}>{v.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Qué hay que hacer" className="sm:col-span-2" error={err}><textarea rows={3} className="field-input" value={f.detalle || ""} onChange={(e) => setF({ ...f, detalle: e.target.value })} placeholder="Ej: confirmar documentos para el crédito" /></Campo>
        </form>
      </Modal>

      <Modal abierto={!!cierre} onClose={() => setCierre(null)} titulo={`Cerrar tarea · ${lead(cierre?.leadId)?.contacto || ""}`} ancho="max-w-md"
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setCierre(null)}>Cancelar</button><button form="f-cierre" className="btn btn-primary !py-2">Guardar resultado</button></>}>
        <form id="f-cierre" onSubmit={cerrarTarea} className="grid gap-4" noValidate>
          <p className="text-[13.5px] text-slate-500">{cierre?.detalle}</p>
          <Campo etiqueta="¿Qué pasó? (resultado)"><textarea rows={3} className="field-input" value={c.resultado} onChange={(e) => setC({ ...c, resultado: e.target.value })} placeholder="Ej: le envié la cotización, decide el fin de semana" /></Campo>
          <Campo etiqueta="Estado del lead"><select className="field-input" value={c.estadoLead} onChange={(e) => setC({ ...c, estadoLead: e.target.value })}><option value="">Sin cambios</option>{["En seguimiento", "Cotizado", "Cerrado ganado", "Perdido"].map((x) => <option key={x}>{x}</option>)}</select></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Próximo contacto" ayuda="Déjalo vacío si no hace falta"><input type="date" min={hoy} className="field-input" value={c.proxima} onChange={(e) => setC({ ...c, proxima: e.target.value })} /></Campo>
            <Campo etiqueta="Tipo"><select className="field-input" value={c.tipo} onChange={(e) => setC({ ...c, tipo: e.target.value })}>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          </div>
        </form>
      </Modal>
    </div>
  );
}
