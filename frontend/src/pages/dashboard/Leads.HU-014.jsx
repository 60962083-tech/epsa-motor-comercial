import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { CANALES, ESTADOS_LEAD, FAMILIAS, FILTROS_CATALOGO, SEDES_ATENCION } from "../../data/mockData";
import { Aviso, btnMini, btnMiniPeligro, Campo, Card, Modal, PageHeader, Stat, Tabla, useConfirm, useToast, Vacio } from "../../components/ui";
import { RankingBarras } from "../../components/charts";
import { esCelular, esNombre, MSJ, soloDigitos, soloLetras } from "../../lib/validar";

const TONO = { Nuevo: "bg-sky-100 text-sky-700", "En seguimiento": "bg-amber-100 text-amber-700", Cotizado: "bg-violet-100 text-violet-700", "Cerrado ganado": "bg-emerald-100 text-emerald-700", Perdido: "bg-slate-200 text-slate-600" };
const VACIO = { contacto: "", telefono: "", canal: "", modelo: "", color: "", sede: "Comas", responsable: "", estado: "Nuevo", nota: "", primerContacto: true, otraOportunidad: false };
const SIN = "Sin asignar";
const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * Leads: registrar manualmente un interesado.
 * Datos obligatorios: nombre, celular, canal y modelo. Si el celular ya existe (aunque sea por otro modelo)
 * se avisa y se elige: abrir el lead existente o registrarlo como otra oportunidad del mismo cliente.
 * Modo ausencia: el lead queda «Sin asignar» y «Sin próximo contacto» hasta repartirlo.
 */
export default function Leads() {
  const { leads, modelos, equipo, seguimientos, config, agregar, actualizar, eliminar, configurar } = useApp();
  const { user, puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm(); const nav = useNavigate();
  const [f, setF] = useState({ q: "", estado: "", canal: "", sede: "", resp: "", modelo: "" });
  const [fm, setFm] = useState({ tipoMotor: "", combustible: "", familia: "" });
  const [modal, setModal] = useState(null); // { lead | null }
  const [form, setForm] = useState(VACIO);
  const [err, setErr] = useState({});
  const [asignando, setAsignando] = useState(null); const [vendAsig, setVendAsig] = useState("");
  const vendedores = equipo.filter((p) => p.rol === "vendedor" && p.activo);
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || "Sin modelo";
  const ausencia = !!config?.modoAusencia;
  const hoy = hoyISO();

  const proximo = (l) => seguimientos.filter((s) => s.leadId === l.id && !s.hecho).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const cerrado = (l) => ["Cerrado ganado", "Perdido"].includes(l.estado);

  const filtrados = useMemo(() => leads.filter((l) => {
    const q = f.q.toLowerCase();
    if (q && !`${l.contacto} ${l.telefono}`.toLowerCase().includes(q)) return false;
    return (!f.estado || l.estado === f.estado) && (!f.canal || l.canal === f.canal) && (!f.sede || l.sede === f.sede) && (!f.resp || l.responsable === f.resp) && (!f.modelo || l.modelo === f.modelo);
  }), [leads, f]);

  const ranking = useMemo(() => {
    const ok = (m) => (!fm.tipoMotor || m.tipoMotor === fm.tipoMotor) && (!fm.combustible || m.combustible === fm.combustible) && (!fm.familia || m.familia === fm.familia);
    const c = {};
    leads.forEach((l) => { const m = modelos.find((x) => x.id === l.modelo); if (m && ok(m)) c[l.modelo] = (c[l.modelo] || 0) + 1; });
    return Object.entries(c).map(([id, v]) => ({ id, v, etiqueta: nombreModelo(id) })).sort((a, b) => b.v - a.v);
  }, [leads, modelos, fm]); // eslint-disable-line

  // Duplicado en vivo: apenas el celular tiene 9 dígitos se busca en los leads existentes
  // (se compara solo el celular: el mismo cliente puede consultar por otro modelo)
  const duplicado = esCelular(form.telefono) ? leads.find((l) => l.telefono === form.telefono && l.id !== modal?.lead?.id) : null;
  const modeloForm = modelos.find((m) => m.id === form.modelo);

  function abrir(l) {
    setErr({});
    setForm(l ? { ...VACIO, ...l, primerContacto: false } : { ...VACIO, responsable: ausencia ? SIN : user.rol === "vendedor" ? user.nombre : vendedores[0]?.nombre || SIN });
    setModal({ lead: l });
  }
  function validar() {
    const x = {};
    if (!esNombre(form.contacto)) x.contacto = MSJ.nombre;
    if (!esCelular(form.telefono)) x.telefono = MSJ.celular;
    else if (duplicado && !form.otraOportunidad) x.telefono = "Este celular ya está registrado. Abre ese lead o márcalo como otra oportunidad.";
    if (!form.canal) x.canal = "Indica por dónde llegó la consulta.";
    if (!form.modelo) x.modelo = "Elige el modelo que consultó.";
    setErr(x); return Object.keys(x).length === 0;
  }
  function guardar(e) {
    e.preventDefault();
    if (!validar()) return;
    const { primerContacto, otraOportunidad, ...datos } = form;
    datos.contacto = datos.contacto.trim();
    if (otraOportunidad && duplicado) datos.nota = [datos.nota, `Otra oportunidad del mismo cliente (lead #${duplicado.id}).`].filter(Boolean).join(" ");
    if (modal.lead) { actualizar("leads", modal.lead.id, datos, `Lead editado: ${datos.contacto}`); toast("Lead actualizado"); }
    else {
      const id = leads.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0) + 1;
      agregar("leads", { id, ...datos, estado: "Nuevo", fecha: hoy }, `Lead registrado: ${datos.contacto}`);
      const agenda = primerContacto && datos.responsable !== SIN;
      if (agenda) agregar("seguimientos", { leadId: id, fecha: hoy, tipo: datos.canal === "WhatsApp" ? "WhatsApp" : "Llamada", responsable: datos.responsable, hecho: false, detalle: `Primer contacto: consulta por el ${nombreModelo(datos.modelo)}` }, `Seguimiento creado para ${datos.contacto}`);
      toast(datos.responsable === SIN ? "Lead registrado como «Sin asignar» y sin próximo contacto" : agenda ? "Lead registrado y primer contacto agendado en Seguimiento" : "Lead registrado");
    }
    setModal(null);
  }

  function abrirAsignar(l) { setVendAsig(vendedores.find((p) => p.sede === l.sede && !p.ausente)?.nombre || vendedores[0]?.nombre || ""); setAsignando(l); }
  function guardarAsignacion(e) {
    e.preventDefault();
    if (!vendAsig) return;
    actualizar("leads", asignando.id, { responsable: vendAsig }, `Lead ${asignando.contacto} asignado a ${vendAsig}`);
    if (!proximo(asignando)) agregar("seguimientos", { leadId: asignando.id, fecha: hoy, tipo: "Llamada", responsable: vendAsig, hecho: false, detalle: "Primer contacto tras la asignación" });
    toast(`Asignado a ${vendAsig}. Primer contacto agendado para hoy.`); setAsignando(null);
  }

  async function cambiarEstado(l, estado) {
    if (["Cerrado ganado", "Perdido"].includes(estado) && !(await confirmar({ titulo: `Marcar como «${estado}»`, texto: `${l.contacto} saldrá de la lista de leads abiertos.`, boton: "Confirmar" }))) return;
    actualizar("leads", l.id, { estado }, `Lead ${l.contacto}: ${estado}`); toast(`Estado: ${estado}`);
  }
  async function borrar(l) {
    const segs = seguimientos.filter((s) => s.leadId === l.id);
    if (!(await confirmar({ titulo: "Eliminar lead", texto: `¿Eliminar a ${l.contacto}?${segs.length ? ` También se eliminarán sus ${segs.length} seguimiento(s).` : ""} Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true }))) return;
    segs.forEach((s) => eliminar("seguimientos", s.id));
    eliminar("leads", l.id, `Lead eliminado: ${l.contacto}`); toast("Lead eliminado");
  }
  async function alternarAusencia() {
    if (!ausencia && !(await confirmar({ titulo: "Activar modo ausencia", texto: "Los leads nuevos (web y manuales) quedarán «Sin asignar» y sin próximo contacto hasta que alguien los reparta.", boton: "Activar" }))) return;
    configurar({ modoAusencia: !ausencia }, `Modo ausencia ${ausencia ? "desactivado" : "activado"} por ${user.nombre}`);
    toast(ausencia ? "Modo ausencia desactivado: vuelve el reparto por turnos" : "Modo ausencia activo");
  }

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const sel = (k, et, ops) => (
    <div><label className="field-label">{et}</label>
      <select className="field-input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })}><option value="">Todos</option>{ops.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.t ?? o}</option>)}</select></div>
  );
  const abiertos = leads.filter((l) => !cerrado(l));

  return (
    <div>
      <PageHeader titulo="Leads" subtitulo="Interesados que llegan por la web, WhatsApp, redes o las sedes. Un celular no se registra dos veces.">
        {puede("leads.ausencia") && (
          <button type="button" onClick={alternarAusencia} aria-pressed={ausencia} className={`btn !py-2.5 border ${ausencia ? "border-amber-400 bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" : "border-slate-300 text-slate-600 dark:border-white/15 dark:text-white/80"}`}>
            <span className={`relative h-5 w-9 rounded-full transition ${ausencia ? "bg-amber-500" : "bg-slate-300 dark:bg-white/20"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${ausencia ? "left-[18px]" : "left-0.5"}`} /></span>
            Modo ausencia
          </button>
        )}
        <button className="btn btn-primary !py-2.5" onClick={() => abrir(null)}>+ Registrar interesado</button>
      </PageHeader>
      {ausencia && <div className="mb-5"><Aviso tipo="aviso">Modo ausencia activo: los leads nuevos quedan «Sin asignar» y «Sin próximo contacto». Repártelos con el botón «Asignar».</Aviso></div>}

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Nuevos hoy" valor={leads.filter((l) => l.fecha === hoy).length} />
        <Stat etiqueta="Sin asignar" valor={abiertos.filter((l) => l.responsable === SIN).length} tono="ambar" />
        <Stat etiqueta="Sin próximo contacto" valor={abiertos.filter((l) => !proximo(l)).length} tono="rojo" />
        <Stat etiqueta="Cotizados" valor={leads.filter((l) => l.estado === "Cotizado").length} tono="verde" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
        <Card>
          <h2 className="font-bold text-marino dark:text-white">Modelos consultados</h2>
          <p className="mb-3 text-[12.5px] text-slate-400">Filtra igual que en el catálogo de la web. Toca una barra para ver sus leads.</p>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {[["tipoMotor", "Motor", FILTROS_CATALOGO.tipoMotor], ["combustible", "Combustible", FILTROS_CATALOGO.combustible], ["familia", "Familia", FAMILIAS]].map(([k, l, o]) => (
              <select key={k} aria-label={l} className="field-input !px-2 !py-2 !text-[12.5px]" value={fm[k]} onChange={(e) => setFm({ ...fm, [k]: e.target.value })}><option value="">{l}</option>{o.map((v) => <option key={v}>{v}</option>)}</select>
            ))}
          </div>
          {ranking.length ? <RankingBarras datos={ranking} elegido={f.modelo} onElegir={(id) => setF({ ...f, modelo: id })} /> : <p className="py-6 text-center text-[13.5px] text-slate-400">Sin consultas con ese filtro.</p>}
        </Card>

        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3"><label className="field-label">Buscar</label><input className="field-input" placeholder="Nombre o celular" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
            {sel("estado", "Estado", ESTADOS_LEAD)}
            {sel("canal", "Canal", CANALES)}
            {sel("sede", "Sede", SEDES_ATENCION)}
            {sel("resp", "Responsable", [SIN, ...vendedores.map((v) => v.nombre)])}
            {sel("modelo", "Modelo", modelos.map((m) => ({ v: m.id, t: m.nombre })))}
            <div className="flex items-end"><button className="pb-3 text-[13px] font-semibold text-acento hover:underline" onClick={() => setF({ q: "", estado: "", canal: "", sede: "", resp: "", modelo: "" })}>Limpiar filtros</button></div>
          </div>
          <p className="mt-3 text-[13px] text-slate-500">{filtrados.length} de {leads.length} leads</p>
        </Card>
      </div>

      <div className="mt-6">
        {filtrados.length === 0 ? <Vacio titulo="No hay leads con esos filtros" texto="Limpia los filtros o registra un interesado nuevo." /> : (
          <Tabla columnas={["Fecha", "Interesado", "Modelo consultado", "Canal", "Responsable", "Próximo contacto", "Estado", "Acciones"]}>
            {filtrados.map((l) => {
              const px = proximo(l);
              return (
                <tr key={l.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{l.fecha}</td>
                  <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{l.contacto}</p><p className="text-[12.5px] text-slate-400">{l.telefono} · {l.sede}</p></td>
                  <td className="px-4 py-3">{nombreModelo(l.modelo)}{l.color && <span className="text-slate-400"> · {l.color}</span>}</td>
                  <td className="px-4 py-3">{l.canal}</td>
                  <td className="px-4 py-3">{l.responsable === SIN || !l.responsable ? <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[12px] font-semibold text-amber-800">Sin asignar</span> : l.responsable}</td>
                  <td className="whitespace-nowrap px-4 py-3">{cerrado(l) ? <span className="text-slate-400">—</span> : px ? <span className={px.fecha < hoy ? "font-semibold text-acento" : ""}>{px.fecha} · {px.tipo}</span> : <span className="rounded-full bg-red-50 px-2.5 py-1 text-[12px] font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">Sin próximo contacto</span>}</td>
                  <td className="px-4 py-3">
                    <select aria-label={`Estado de ${l.contacto}`} value={l.estado} onChange={(e) => cambiarEstado(l, e.target.value)} className={`rounded-full border-0 px-2.5 py-1 text-[12px] font-semibold ${TONO[l.estado]}`}>
                      {ESTADOS_LEAD.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                    {(l.responsable === SIN || !l.responsable) && !cerrado(l) && <button className={btnMini} onClick={() => abrirAsignar(l)}>Asignar</button>}
                    <a className={btnMini} target="_blank" rel="noopener noreferrer" href={`https://wa.me/51${l.telefono}?text=${encodeURIComponent(`Hola ${l.contacto}, te escribimos de EPSA Motor por tu consulta del ${nombreModelo(l.modelo)}.`)}`}>WhatsApp</a>
                    <button className={btnMini} onClick={() => nav("/admin/seguimiento", { state: { leadId: l.id } })}>Seguimiento</button>
                    <button className={btnMini} onClick={() => nav("/admin/ventas", { state: { lead: l } })}>Vender</button>
                    <button className={btnMini} onClick={() => abrir(l)}>Editar</button>
                    {puede("eliminar") && <button className={btnMiniPeligro} onClick={() => borrar(l)}>Eliminar</button>}
                  </div></td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </div>

      <Modal abierto={!!modal} onClose={() => setModal(null)} titulo={modal?.lead ? `Editar lead de ${modal.lead.contacto}` : "Registrar interesado"} ancho="max-w-2xl"
        confirmarGuardar={modal?.lead ? { titulo: "¿Guardar los cambios?", texto: `Se actualizará el lead de ${form.contacto || "este interesado"}.`, boton: "Guardar cambios", validar } : false}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-lead" className="btn btn-primary !py-2" type="submit" disabled={!!duplicado && !form.otraOportunidad}>{modal?.lead ? "Guardar" : "Registrar"}</button></>}>
        <form id="f-lead" onSubmit={guardar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo etiqueta="Nombre del interesado" error={err.contacto}><input id="lead-nombre" className="field-input" value={form.contacto} onChange={(e) => setForm({ ...form, contacto: soloLetras(e.target.value) })} autoComplete="off" /></Campo>
          <Campo etiqueta="Celular" error={err.telefono}><input id="lead-celular" className="field-input" inputMode="numeric" maxLength={9} value={form.telefono} onChange={(e) => setForm({ ...form, telefono: soloDigitos(e.target.value, 9), otraOportunidad: false })} placeholder="9XXXXXXXX" /></Campo>
          {duplicado && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13.5px] text-amber-900 sm:col-span-2 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="font-semibold">Este celular ya está registrado{duplicado.modelo !== form.modelo && form.modelo ? " (por otro modelo)" : ""}</p>
              <p className="mt-1">{duplicado.contacto} · {nombreModelo(duplicado.modelo)} · {duplicado.estado} · {duplicado.responsable || SIN} · desde el {duplicado.fecha}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" data-dup="vincular" className="rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-amber-900 shadow-sm hover:bg-amber-100 dark:bg-white/10 dark:text-amber-100" onClick={() => abrir(duplicado)}>Es el mismo cliente: abrir su lead</button>
                {!modal?.lead && <button type="button" data-dup="otra" aria-pressed={form.otraOportunidad} className={`rounded-lg px-3 py-1.5 text-[13px] font-semibold shadow-sm ${form.otraOportunidad ? "bg-amber-600 text-white" : "bg-white text-amber-900 hover:bg-amber-100 dark:bg-white/10 dark:text-amber-100"}`} onClick={() => setForm({ ...form, otraOportunidad: !form.otraOportunidad })}>{form.otraOportunidad ? "✓ Se registrará como otra oportunidad" : "Registrar como otra oportunidad"}</button>}
              </div>
            </div>
          )}
          <Campo etiqueta="Canal de la consulta" error={err.canal}><select id="lead-canal" className="field-input" value={form.canal} onChange={set("canal")}><option value="">Elige el canal</option>{CANALES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
          <Campo etiqueta="Modelo consultado" error={err.modelo}><select id="lead-modelo" className="field-input" value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value, color: "" })}><option value="">Elige el modelo</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Sede de interés"><select id="lead-sede" className="field-input" value={form.sede} onChange={set("sede")}>{SEDES_ATENCION.map((c) => <option key={c}>{c}</option>)}</select></Campo>
          <Campo etiqueta="Responsable"><select id="lead-responsable" className="field-input" value={form.responsable} onChange={set("responsable")}><option>{SIN}</option>{vendedores.map((v) => <option key={v.id}>{v.nombre}</option>)}</select></Campo>
          {modal?.lead && <Campo etiqueta="Estado"><select className="field-input" value={form.estado} onChange={set("estado")}>{ESTADOS_LEAD.map((c) => <option key={c}>{c}</option>)}</select></Campo>}
          <Campo etiqueta="Color de interés"><select id="lead-color" className="field-input" value={form.color} onChange={set("color")} disabled={!modeloForm}><option value="">{modeloForm ? "Cualquiera" : "Elige primero el modelo"}</option>{(modeloForm?.colores || []).map((c) => <option key={c}>{c}</option>)}</select></Campo>
          <Campo etiqueta="Notas" className="sm:col-span-2"><textarea className="field-input" rows={2} value={form.nota} onChange={set("nota")} placeholder="Qué preguntó, cuándo prefiere que lo llamen…" /></Campo>
          {!modal?.lead && (
            form.responsable === SIN
              ? <p className="text-[13px] text-slate-500 sm:col-span-2">Sin responsable no se agenda contacto: el lead quedará «Sin asignar» y «Sin próximo contacto», no como atendido.</p>
              : <label className="flex items-center gap-2 text-[13.5px] font-medium sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={form.primerContacto} onChange={(e) => setForm({ ...form, primerContacto: e.target.checked })} />Agendar el primer contacto en Seguimiento para hoy</label>
          )}
        </form>
      </Modal>

      <Modal abierto={!!asignando} onClose={() => setAsignando(null)} titulo={`Asignar a ${asignando?.contacto || ""}`} ancho="max-w-md"
        confirmarGuardar={{ titulo: "¿Asignar este lead?", texto: `Quedará a cargo de ${vendAsig || "—"} con el primer contacto para hoy.`, boton: "Asignar" }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setAsignando(null)}>Cancelar</button><button form="f-asig" className="btn btn-primary !py-2">Asignar</button></>}>
        <form id="f-asig" onSubmit={guardarAsignacion} className="grid gap-4" noValidate>
          <p className="text-[13.5px] text-slate-500">{asignando?.telefono} · {nombreModelo(asignando?.modelo)} · {asignando?.sede}</p>
          <Campo etiqueta="Vendedor"><select className="field-input" value={vendAsig} onChange={(e) => setVendAsig(e.target.value)}>{vendedores.map((v) => <option key={v.id} value={v.nombre}>{v.nombre}{v.ausente ? " (ausente)" : ""}</option>)}</select></Campo>
        </form>
      </Modal>
    </div>
  );
}
