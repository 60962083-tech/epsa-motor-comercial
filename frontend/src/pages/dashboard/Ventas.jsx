import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { CANALES, SEDES_ATENCION, formatoSoles } from "../../data/mockData";
import { Aviso, Campo, Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";

const ETAPA_TONO = { "Solicitud web": "bg-amber-100 text-amber-800", Cotización: "bg-slate-200 text-slate-700", "Pedido registrado": "bg-sky-100 text-sky-700", Entregado: "bg-emerald-100 text-emerald-700" };
const EMPRESA = { razon: "INVERSIONES EPSA MOTOR S.A.C.", ruc: "20555595469" };
const IGV = 0.18;
const dosDec = (n) => (Math.round(n * 100) / 100).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const CON_OPERACION = ["Transferencia", "Depósito", "Yape / Plin", "Tarjeta"];
const DOCS = { DNI: [8, 8], CE: [9, 9], RUC: [11, 11], Pasaporte: [6, 20] };
const MEDIOS = ["Efectivo", "Transferencia", "Yape / Plin", "Depósito", "Tarjeta"];
const ORIGEN = ["Redes sociales", "Referido", "Pasó por la sede", "Publicidad", "Web de EPSA", "Otro"];

function validarDoc(tipo, num) {
  if (!num) return "";
  const [min, max] = DOCS[tipo];
  if (!/^[A-Za-z0-9]+$/.test(num)) return "Solo letras y números.";
  if (tipo !== "Pasaporte" && !/^\d+$/.test(num)) return "Solo números.";
  return num.length < min || num.length > max ? `${tipo}: ${min === max ? min : `${min} a ${max}`} caracteres.` : "";
}

/**
 * Ventas a clientes (complemento del panel). Sigue las tablas del esquema de Supabase:
 * cliente (documento y contacto), separacion (metpagsep = medio de pago, monadesep = adelanto > 0,
 * refsep = N° de operación) y venta (modcomven = forma de compra). Aún no hay endpoints en el backend:
 * en esta etapa se guarda en la web.
 */
export default function Ventas() {
  const { ventas, modelos, equipo, unidades, leads, agregar, actualizar, eliminar } = useApp();
  const { user, puede } = useAuth();
  const { state } = useLocation();
  const toast = useToast(); const confirmar = useConfirm();
  const vendedores = equipo.filter((p) => p.rol === "vendedor" && p.activo);
  const [q, setQ] = useState(""); const [etapa, setEtapa] = useState(""); const [sedeF, setSedeF] = useState("");
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || "—";

  // ----- Nueva venta -----
  const base = () => ({ cliente: state?.lead?.contacto || "", celular: state?.lead?.telefono || "", modelo: state?.lead?.modelo || modelos[0]?.id || "", tipoDoc: "DNI", doc: "", canal: "WhatsApp", origen: "Pasó por la sede", vendedor: user.rol === "vendedor" ? user.nombre : vendedores[0]?.nombre || "", sede: state?.lead?.sede || "Comas", pago: "Financiamiento", accion: "cotizar", medio: "Transferencia", adelanto: "", operacion: "" });
  const unidadPara = (modelo, sede) => unidades.find((u) => u.modelo === modelo && u.disponibilidad === "Disponible" && u.ubicacion === sede) || unidades.find((u) => u.modelo === modelo && u.disponibilidad === "Disponible");
  const [nueva, setNueva] = useState(state?.lead ? { paso: 1, f: base() } : null);
  const [err, setErr] = useState({});
  // ----- Atender solicitud web y comprobante manual -----
  const [atender, setAtender] = useState(null); const [vendAt, setVendAt] = useState("");
  const [comp, setComp] = useState(null); const [cf, setCf] = useState({}); const [cerr, setCerr] = useState({});
  const [verComp, setVerComp] = useState(null);
  // ----- Pedido -----
  const [pedido, setPedido] = useState(null);
  const [pf, setPf] = useState({});
  const [perr, setPerr] = useState({});

  const lista = useMemo(() => ventas.filter((v) => {
    if (q && !`${v.cliente} ${v.celular} ${v.documento}`.toLowerCase().includes(q.toLowerCase())) return false;
    return (!etapa || v.etapa === etapa) && (!sedeF || v.sede === sedeF) && (user.rol !== "vendedor" || v.vendedor === user.nombre || v.vendedor === "Sin asignar");
  }), [ventas, q, etapa, sedeF, user]);

  const setN = (k, v) => setNueva((n) => ({ ...n, f: { ...n.f, [k]: v } }));
  function siguiente() {
    const f = nueva.f; const e = {};
    if (nueva.paso === 1) {
      if (f.cliente.trim().length < 3) e.cliente = "Ingresa el nombre del cliente.";
      if (!/^9\d{8}$/.test(f.celular)) e.celular = "Celular de 9 dígitos que empiece con 9.";
      const d = validarDoc(f.tipoDoc, f.doc); if (d) e.doc = d;
      if (!f.vendedor) e.vendedor = "Elige el vendedor responsable.";
    }
    setErr(e);
    if (Object.keys(e).length) return;
    setNueva({ ...nueva, paso: nueva.paso + 1 });
  }
  async function crear() {
    const f = nueva.f; const m = modelos.find((x) => x.id === f.modelo); const e = {};
    let unidad = null;
    if (f.accion === "separar") {
      unidad = unidadPara(f.modelo, f.sede);
      if (!unidad) e.general = `No hay unidades disponibles del ${m?.nombre} para separar. Registra solo la cotización.`;
      const monto = Number(f.adelanto);
      if (!(monto > 0)) e.adelanto = "Para separar se necesita un adelanto mayor a 0."; else if (monto > m.precioDesde) e.adelanto = `No puede superar ${formatoSoles(m.precioDesde)}.`;
      if (CON_OPERACION.includes(f.medio) && !f.operacion.trim()) e.operacion = "Ingresa el N° de operación.";
    }
    setErr(e); if (Object.keys(e).length) return;
    const ok = await confirmar({
      titulo: f.accion === "separar" ? "¿Separar la unidad?" : f.accion === "pedido" ? "¿Registrar cliente y pasar al pedido?" : "¿Registrar la cotización?",
      texto: `${f.cliente.trim()} · ${m?.nombre} · ${f.pago}${f.accion === "separar" ? ` · adelanto ${formatoSoles(Number(f.adelanto))} por ${f.medio}. Se reservará la unidad ${unidad.id} (${unidad.ubicacion}).` : "."}`,
      boton: "Confirmar",
    });
    if (!ok) return;
    const hoy = new Date().toISOString().slice(0, 10);
    if (unidad) actualizar("unidades", unidad.id, (u) => ({ disponibilidad: "Separada", historial: [...u.historial, { fecha: hoy, detalle: `Separada para ${f.cliente.trim()} (adelanto ${formatoSoles(Number(f.adelanto))})` }] }));
    const datos = { fecha: hoy, cliente: f.cliente.trim(), celular: f.celular, documento: f.doc ? `${f.tipoDoc} ${f.doc}` : "", modelo: f.modelo, pago: f.pago, etapa: unidad ? "Pedido registrado" : "Cotización", vendedor: f.vendedor, sede: f.sede, adelanto: unidad ? Number(f.adelanto) : 0, total: m.precioDesde, unidad: unidad?.id || null, canal: f.canal, origen: f.origen, ...(unidad ? { medioPago: f.medio, operacion: f.operacion.trim() } : {}) };
    const id = ventas.reduce((mx, v) => Math.max(mx, Number(v.id) || 0), 0) + 1;
    agregar("ventas", { id, ...datos }, `Venta registrada: ${f.cliente} · ${m.nombre}`);
    const lead = leads.find((l) => l.telefono === f.celular);
    if (lead) actualizar("leads", lead.id, { estado: "Cotizado" });
    toast(unidad ? `Unidad ${unidad.id} separada para ${f.cliente.trim()}` : "Cliente registrado y cotización creada");
    setNueva(null);
    if (f.accion === "pedido") abrirPedido({ id, ...datos });
  }

  function abrirPedido(v) { setPerr({}); setPf({ conAdelanto: true, separar: false, medio: "Transferencia", adelanto: "", fecha: new Date().toISOString().slice(0, 10), operacion: "", archivo: "", obs: "", tipoDoc: v.documento?.split(" ")[0] || "DNI", doc: v.documento?.split(" ")[1] || "", celular: v.celular }); setPedido(v); }
  function validarPedido() {
    const x = {};
    const monto = Number(pf.adelanto);
    if (pf.conAdelanto || pf.separar) {
      if (!monto || monto <= 0) x.adelanto = "Ingresa el monto del adelanto.";
      else if (monto > pedido.total) x.adelanto = `No puede superar ${formatoSoles(pedido.total)}.`;
      if (!pf.fecha) x.fecha = "Indica la fecha del pago."; else if (pf.fecha > new Date().toISOString().slice(0, 10)) x.fecha = "La fecha del pago no puede ser futura.";
      if (CON_OPERACION.includes(pf.medio) && !pf.operacion.trim()) x.operacion = "Ingresa el N° de operación.";
    }
    if (pf.separar && !pedido.unidad && !unidadPara(pedido.modelo, pedido.sede)) x.separar = "No hay unidades disponibles de este modelo para separar.";
    const d = validarDoc(pf.tipoDoc, pf.doc); if (d || !pf.doc) x.doc = d || "El documento es obligatorio para registrar el pedido.";
    if (!/^9\d{8}$/.test(pf.celular)) x.celular = "Celular de 9 dígitos que empiece con 9.";
    setPerr(x); return Object.keys(x).length === 0;
  }
  function guardarPedido(e) {
    e.preventDefault();
    if (!validarPedido()) return;
    const monto = Number(pf.adelanto); const hoy = new Date().toISOString().slice(0, 10);
    let unidad = pedido.unidad;
    if (pf.separar && !unidad) {
      const u = unidadPara(pedido.modelo, pedido.sede); unidad = u.id;
      actualizar("unidades", u.id, (x) => ({ disponibilidad: "Separada", historial: [...x.historial, { fecha: hoy, detalle: `Separada para ${pedido.cliente} (adelanto ${formatoSoles(monto)})` }] }));
    }
    const conPago = pf.conAdelanto || pf.separar;
    actualizar("ventas", pedido.id, { etapa: "Pedido registrado", unidad, adelanto: conPago ? monto : 0, documento: `${pf.tipoDoc} ${pf.doc}`, celular: pf.celular, medioPago: conPago ? pf.medio : "", operacion: conPago ? pf.operacion.trim() : "", comprobante: pf.archivo, obs: pf.obs }, `Pedido registrado: ${pedido.cliente}`);
    toast(unidad && !pedido.unidad ? `Pedido registrado y unidad ${unidad} separada` : "Pedido registrado"); setPedido(null);
  }
  function archivo(e) {
    const a = e.target.files?.[0]; if (!a) return;
    if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(a.type)) { setPerr({ ...perr, archivo: "Formato no permitido (JPG, PNG, WebP o PDF)." }); e.target.value = ""; return; }
    if (a.size > 10 * 1024 * 1024) { setPerr({ ...perr, archivo: "El archivo supera los 10 MB." }); e.target.value = ""; return; }
    setPerr({ ...perr, archivo: "" }); setPf({ ...pf, archivo: a.name });
  }
  async function entregar(v) {
    const u = v.unidad ? unidades.find((x) => x.id === v.unidad) : unidadPara(v.modelo, v.sede);
    if (!u) return toast(`No hay una unidad disponible del ${nombreModelo(v.modelo)} para entregar. Revisa el inventario.`, "error");
    if (!(await confirmar({ titulo: "Confirmar entrega", texto: `Se entregará la unidad ${u.id} (motor ${u.motor}) a ${v.cliente}. La unidad pasará a «Vendida» y saldrá del stock de la web.`, boton: "Confirmar entrega" }))) return;
    actualizar("unidades", u.id, (x) => ({ disponibilidad: "Vendida", historial: [...x.historial, { fecha: new Date().toISOString().slice(0, 10), detalle: `Entregada a ${v.cliente}` }] }));
    actualizar("ventas", v.id, { etapa: "Entregado", unidad: u.id }, `Entrega confirmada: ${v.cliente}`); toast("Entrega registrada");
  }
  function abrirAtender(v) { setVendAt(v.vendedor !== "Sin asignar" ? v.vendedor : user.rol === "vendedor" ? user.nombre : vendedores[0]?.nombre || ""); setAtender(v); }
  function guardarAtender(e) {
    e.preventDefault();
    if (!vendAt) return toast("Elige quién atiende la solicitud.", "error");
    actualizar("ventas", atender.id, { etapa: "Cotización", vendedor: vendAt }, `Solicitud web atendida: ${atender.cliente} (${vendAt})`);
    const lead = leads.find((l) => l.id === atender.leadId) || leads.find((l) => l.telefono === atender.celular);
    if (lead) actualizar("leads", lead.id, { responsable: vendAt, estado: lead.estado === "Nuevo" ? "En seguimiento" : lead.estado });
    toast(`Solicitud asignada a ${vendAt} y convertida en cotización`); setAtender(null);
  }

  // Comprobante manual (solo gerencia): boleta o factura interna con IGV desglosado
  function abrirComprobante(v) {
    const [td, num] = (v.documento || "").split(" ");
    const u = unidades.find((x) => x.id === v.unidad);
    setCerr({});
    setCf({ tipo: "Boleta de venta", tipoDoc: td === "RUC" ? "RUC" : td || "DNI", doc: num || "", razon: "", direccion: "", fecha: new Date().toISOString().slice(0, 10), total: String(v.total || ""), descripcion: `Motocar ${nombreModelo(v.modelo)}${v.color ? ` color ${v.color}` : ""}${u ? `, motor ${u.motor}, chasis ${u.chasis}` : ""}`, medio: v.medioPago || (v.pago === "Pago al contado" ? "Efectivo" : "Transferencia") });
    setComp(v);
  }
  function validarComprobante() {
    const x = {};
    if (cf.tipo === "Factura") {
      if (!/^(10|20)\d{9}$/.test(cf.doc)) x.doc = "RUC de 11 dígitos que empiece con 10 o 20.";
      if (cf.razon.trim().length < 3) x.razon = "Escribe la razón social.";
      if (cf.direccion.trim().length < 5) x.direccion = "Escribe la dirección fiscal.";
    } else {
      const d = validarDoc(cf.tipoDoc, cf.doc); if (d || !cf.doc) x.doc = d || "El documento del cliente es obligatorio.";
    }
    if (!(Number(cf.total) > 0)) x.total = "Importe mayor a 0.";
    if (!cf.fecha || cf.fecha > new Date().toISOString().slice(0, 10)) x.fecha = "La fecha de emisión no puede ser futura.";
    if (cf.descripcion.trim().length < 5) x.descripcion = "Describe el bien vendido.";
    setCerr(x); return Object.keys(x).length === 0;
  }
  function emitirComprobante(e) {
    e.preventDefault();
    if (!validarComprobante()) return;
    const serie = cf.tipo === "Factura" ? "F001" : "B001";
    const correlativo = ventas.filter((v) => v.comprobante?.serie === serie).reduce((m, v) => Math.max(m, v.comprobante.numero), 0) + 1;
    const total = Number(cf.total); const gravada = total / (1 + IGV);
    const c = { tipo: cf.tipo, serie, numero: correlativo, fecha: cf.fecha, cliente: cf.tipo === "Factura" ? cf.razon.trim() : comp.cliente, tipoDoc: cf.tipo === "Factura" ? "RUC" : cf.tipoDoc, doc: cf.doc, direccion: cf.direccion.trim(), descripcion: cf.descripcion.trim(), medio: cf.medio, total, gravada, igv: total - gravada, emitidoPor: user.nombre, estado: "Emitido" };
    actualizar("ventas", comp.id, { comprobante: c }, `Comprobante ${serie}-${String(correlativo).padStart(8, "0")} emitido para ${comp.cliente}`);
    toast(`${cf.tipo} ${serie}-${String(correlativo).padStart(8, "0")} emitida`); setComp(null); setVerComp({ ...comp, comprobante: c });
  }
  async function anularComprobante(v) {
    if (!(await confirmar({ titulo: "Anular comprobante", texto: `El comprobante ${v.comprobante.serie}-${String(v.comprobante.numero).padStart(8, "0")} quedará anulado y podrás emitir uno nuevo. Esta acción queda registrada.`, boton: "Anular", peligro: true }))) return;
    actualizar("ventas", v.id, { comprobante: null, comprobantesAnulados: [...(v.comprobantesAnulados || []), { ...v.comprobante, estado: "Anulado" }] }, `Comprobante anulado: ${v.cliente}`);
    toast("Comprobante anulado"); setVerComp(null);
  }

  async function borrar(v) {
    if (v.etapa === "Entregado") return toast("Una venta entregada no se elimina: forma parte del historial.", "error");
    if (await confirmar({ titulo: "Eliminar venta", texto: `¿Eliminar la venta de ${v.cliente}?${v.unidad ? ` La unidad ${v.unidad} volverá a estar disponible.` : ""} Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true })) {
      if (v.unidad) actualizar("unidades", v.unidad, { disponibilidad: "Disponible" });
      eliminar("ventas", v.id, `Venta eliminada: ${v.cliente}`); toast("Venta eliminada");
    }
  }

  const f = nueva?.f;
  const pasos = ["Cliente y modelo", "Forma de compra", "¿Qué registrar?"];
  return (
    <div>
      <PageHeader titulo="Ventas a clientes" subtitulo="Solicitudes de la web, cotizaciones, pedidos con adelanto, separación de unidades, entregas y comprobantes.">
        <button className="btn btn-primary !py-2.5" onClick={() => { setErr({}); setNueva({ paso: 1, f: base() }); }}>+ Nueva venta</button>
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Solicitudes web por atender" valor={ventas.filter((v) => v.etapa === "Solicitud web").length} tono="ambar" nota="Llegan desde «Cotizar» en la web" />
        <Stat etiqueta="Cotizaciones" valor={ventas.filter((v) => v.etapa === "Cotización").length} />
        <Stat etiqueta="Pedidos registrados" valor={ventas.filter((v) => v.etapa === "Pedido registrado").length} tono="marino" />
        <Stat etiqueta="Entregadas" valor={ventas.filter((v) => v.etapa === "Entregado").length} tono="verde" />
      </div>
      <Card className="mb-5 grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2"><label className="field-label">Buscar</label><input className="field-input" placeholder="Cliente, celular o documento" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div><label className="field-label">Etapa</label><select className="field-input" value={etapa} onChange={(e) => setEtapa(e.target.value)}><option value="">Todas</option>{Object.keys(ETAPA_TONO).map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="field-label">Sede</label><select className="field-input" value={sedeF} onChange={(e) => setSedeF(e.target.value)}><option value="">Todas</option>{SEDES_ATENCION.map((x) => <option key={x}>{x}</option>)}</select></div>
      </Card>

      {lista.length === 0 ? <Vacio titulo="Sin ventas" texto="Registra una nueva venta para empezar." /> : (
        <Tabla columnas={["Fecha", "Cliente", "Modelo", "Pago", "Total / adelanto", "Vendedor", "Etapa", "Acciones"]}>
          {lista.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{v.fecha}</td>
              <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{v.cliente}</p><p className="text-[12.5px] text-slate-400">{v.celular}{v.documento && ` · ${v.documento}`}</p></td>
              <td className="px-4 py-3">{nombreModelo(v.modelo)}{v.unidad && <span className="block text-[12px] text-slate-400">Unidad {v.unidad}</span>}</td>
              <td className="px-4 py-3">{v.pago}</td>
              <td className="whitespace-nowrap px-4 py-3">{formatoSoles(v.total)}<span className="block text-[12px] text-slate-400">Adelanto {formatoSoles(v.adelanto)}</span></td>
              <td className="px-4 py-3">{v.vendedor === "Sin asignar" ? <span className="font-semibold text-amber-600">Sin asignar</span> : v.vendedor}<span className="block text-[12px] text-slate-400">{v.sede}</span></td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ETAPA_TONO[v.etapa]}`}>{v.etapa}</span></td>
              <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                {v.etapa === "Solicitud web" && <button className={btnMini} onClick={() => abrirAtender(v)}>Atender</button>}
                {v.etapa === "Cotización" && <button className={btnMini} onClick={() => abrirPedido(v)}>Registrar pedido</button>}
                {v.etapa === "Pedido registrado" && <button className={btnMini} onClick={() => entregar(v)}>Marcar entrega</button>}
                {v.comprobante && <button className={btnMini} onClick={() => setVerComp(v)}>{v.comprobante.serie}-{String(v.comprobante.numero).padStart(8, "0")}</button>}
                {!v.comprobante && puede("comprobantes.emitir") && ["Pedido registrado", "Entregado"].includes(v.etapa) && <button className={btnMini} onClick={() => abrirComprobante(v)}>Emitir comprobante</button>}
                <a className={btnMini} target="_blank" rel="noopener noreferrer" href={`https://wa.me/51${v.celular}`}>WhatsApp</a>
                {puede("eliminar") && <button className={btnMiniPeligro} onClick={() => borrar(v)}>Eliminar</button>}
              </div></td>
            </tr>
          ))}
        </Tabla>
      )}

      {/* ---------- Nueva venta ---------- */}
      <Modal abierto={!!nueva} onClose={() => setNueva(null)} titulo="Nueva venta" ancho="max-w-2xl"
        pie={nueva && <>
          {nueva.paso > 1 && <button className="btn btn-secondary !py-2" onClick={() => setNueva({ ...nueva, paso: nueva.paso - 1 })}>Atrás</button>}
          {nueva.paso < 3 ? <button className="btn btn-primary !py-2" onClick={siguiente}>Siguiente</button> : <button className="btn btn-primary !py-2" onClick={crear}>{f.accion === "separar" ? "Registrar cliente y separar" : f.accion === "pedido" ? "Registrar cliente y pedido" : "Registrar cliente y cotizar"}</button>}
        </>}>
        {nueva && <>
          <ol className="mb-5 flex gap-2 text-[12.5px]">{pasos.map((p, i) => <li key={p} className={`flex-1 rounded-lg px-3 py-2 text-center font-semibold ${nueva.paso === i + 1 ? "bg-marino text-white" : nueva.paso > i + 1 ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{i + 1}. {p}</li>)}</ol>
          {nueva.paso === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre del cliente" error={err.cliente}><input className="field-input" value={f.cliente} onChange={(e) => setN("cliente", e.target.value)} /></Campo>
              <Campo etiqueta="Celular" error={err.celular}><input className="field-input" inputMode="numeric" maxLength={9} value={f.celular} onChange={(e) => setN("celular", e.target.value.replace(/\D/g, ""))} /></Campo>
              <Campo etiqueta="Modelo"><select className="field-input" value={f.modelo} onChange={(e) => setN("modelo", e.target.value)}>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></Campo>
              <Campo etiqueta="Documento (opcional)" error={err.doc}>
                <div className="flex gap-2"><select className="field-input !w-28" value={f.tipoDoc} onChange={(e) => setN("tipoDoc", e.target.value)}>{Object.keys(DOCS).map((d) => <option key={d}>{d}</option>)}</select><input className="field-input" value={f.doc} onChange={(e) => setN("doc", e.target.value)} /></div>
              </Campo>
              <Campo etiqueta="Canal de contacto"><select className="field-input" value={f.canal} onChange={(e) => setN("canal", e.target.value)}>{CANALES.map((c) => <option key={c}>{c}</option>)}</select></Campo>
              <Campo etiqueta="¿Cómo llegó a EPSA?"><select className="field-input" value={f.origen} onChange={(e) => setN("origen", e.target.value)}>{ORIGEN.map((c) => <option key={c}>{c}</option>)}</select></Campo>
              <Campo etiqueta="Vendedor responsable" error={err.vendedor}><select className="field-input" value={f.vendedor} onChange={(e) => setN("vendedor", e.target.value)}>{vendedores.map((v) => <option key={v.id}>{v.nombre}</option>)}</select></Campo>
              <Campo etiqueta="Sede de atención"><select className="field-input" value={f.sede} onChange={(e) => setN("sede", e.target.value)}>{SEDES_ATENCION.map((c) => <option key={c}>{c}</option>)}</select></Campo>
            </div>
          )}
          {nueva.paso === 2 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {[["Pago al contado", "Paga el total del vehículo."], ["Financiamiento", "Inicial y cuotas con crédito directo."]].map(([k, d]) => (
                <button key={k} onClick={() => setN("pago", k)} className={`rounded-xl2 border-2 p-5 text-left transition ${f.pago === k ? "border-marino-700 bg-marino-50 dark:bg-white/10" : "border-slate-200 hover:border-marino-700/40 dark:border-white/15"}`}>
                  <p className="font-bold text-marino dark:text-white">{k}</p><p className="mt-1 text-[13px] text-slate-500">{d}</p></button>
              ))}
            </div>
          )}
          {nueva.paso === 3 && (
            <div className="space-y-3">
              {[["cotizar", "Preparar cotización", "Registra al cliente y deja la cotización lista."], ["pedido", "Registrar pedido", "Pasa directo a registrar adelanto y documentos."], ["separar", "Separar una unidad", "Reserva una unidad disponible de este modelo."]].map(([k, t, d]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl2 border-2 p-4 ${f.accion === k ? "border-marino-700 bg-marino-50 dark:bg-white/10" : "border-slate-200 dark:border-white/15"}`}>
                  <input type="radio" name="accion" className="mt-1 accent-[#0e2c52]" checked={f.accion === k} onChange={() => setN("accion", k)} />
                  <span><span className="block font-semibold text-marino dark:text-white">{t}</span><span className="text-[13px] text-slate-500">{d}</span></span>
                </label>
              ))}
              {f.accion === "separar" && (
                <div className="grid gap-4 rounded-xl2 border border-amber-200 bg-amber-50 p-4 sm:grid-cols-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                  <Campo etiqueta="Medio de pago"><select className="field-input" value={f.medio} onChange={(e) => setN("medio", e.target.value)}>{MEDIOS.map((x) => <option key={x}>{x}</option>)}</select></Campo>
                  <Campo etiqueta="Adelanto (S/)" error={err.adelanto}><input className="field-input" inputMode="decimal" value={f.adelanto} onChange={(e) => setN("adelanto", e.target.value.replace(/[^\d.]/g, ""))} /></Campo>
                  <Campo etiqueta="N° de operación" error={err.operacion}><input className="field-input" value={f.operacion} onChange={(e) => setN("operacion", e.target.value)} placeholder={CON_OPERACION.includes(f.medio) ? "Obligatorio" : "Opcional"} /></Campo>
                  <p className="text-[12.5px] text-amber-800 sm:col-span-3 dark:text-amber-200">Separar exige un adelanto (tabla <b>separacion</b>: medio de pago, monto mayor a 0 y referencia).</p>
                </div>
              )}
              {err.general && <Aviso tipo="error">{err.general}</Aviso>}
              <Aviso>Se registra {f.cliente || "el cliente"} para el {nombreModelo(f.modelo)} · {f.pago}.</Aviso>
            </div>
          )}
        </>}
      </Modal>

      {/* ---------- Registrar pedido ---------- */}
      <Modal abierto={!!pedido} onClose={() => setPedido(null)} titulo={`Registrar pedido · cotización #${pedido?.id}`} ancho="max-w-2xl"
        confirmarGuardar={pedido ? { titulo: "¿Registrar el pedido?", texto: `${pedido.cliente} · ${nombreModelo(pedido.modelo)}${pf.conAdelanto || pf.separar ? ` · adelanto ${formatoSoles(Number(pf.adelanto) || 0)} por ${pf.medio}` : " · sin adelanto"}${pf.separar && !pedido.unidad ? " · se separará una unidad disponible" : ""}.`, boton: "Registrar pedido", validar: validarPedido } : false}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setPedido(null)}>Cancelar</button><button form="f-ped" className="btn btn-primary !py-2">Registrar pedido</button></>}>
        {pedido && (
          <form id="f-ped" onSubmit={guardarPedido} className="grid gap-4 sm:grid-cols-2" noValidate>
            <label className="flex items-center gap-2 text-[14px] font-semibold sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={pf.conAdelanto || pf.separar} disabled={pf.separar} onChange={(e) => setPf({ ...pf, conAdelanto: e.target.checked })} />El cliente deja un adelanto</label>
            {!pedido.unidad && <label className="flex items-center gap-2 text-[14px] font-semibold sm:col-span-2"><input type="checkbox" className="h-4 w-4 accent-[#0e2c52]" checked={pf.separar} onChange={(e) => setPf({ ...pf, separar: e.target.checked, conAdelanto: e.target.checked || pf.conAdelanto })} />Separar una unidad disponible para este cliente {perr.separar && <span className="font-medium text-acento">· {perr.separar}</span>}</label>}
            {(pf.conAdelanto || pf.separar) && <>
              <Campo etiqueta="Medio de pago"><select className="field-input" value={pf.medio} onChange={(e) => setPf({ ...pf, medio: e.target.value })}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select></Campo>
              <Campo etiqueta="Adelanto (S/)" error={perr.adelanto} ayuda={`Máximo ${formatoSoles(pedido.total)}`}><input className="field-input" inputMode="decimal" value={pf.adelanto} onChange={(e) => setPf({ ...pf, adelanto: e.target.value.replace(/[^\d.]/g, "") })} /></Campo>
              <Campo etiqueta="Fecha del pago" error={perr.fecha}><input type="date" className="field-input" value={pf.fecha} onChange={(e) => setPf({ ...pf, fecha: e.target.value })} /></Campo>
              <Campo etiqueta="N° de operación" error={perr.operacion}><input className="field-input" value={pf.operacion} onChange={(e) => setPf({ ...pf, operacion: e.target.value })} /></Campo>
              <Campo etiqueta="Comprobante" error={perr.archivo} ayuda={pf.archivo || "JPG, PNG, WebP o PDF · máx. 10 MB"} className="sm:col-span-2"><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={archivo} className="field-input" /></Campo>
            </>}
            <Campo etiqueta="Documento" error={perr.doc}><div className="flex gap-2"><select className="field-input !w-28" value={pf.tipoDoc} onChange={(e) => setPf({ ...pf, tipoDoc: e.target.value })}>{Object.keys(DOCS).map((d) => <option key={d}>{d}</option>)}</select><input className="field-input" value={pf.doc} onChange={(e) => setPf({ ...pf, doc: e.target.value })} /></div></Campo>
            <Campo etiqueta="Celular" error={perr.celular}><input className="field-input" inputMode="numeric" maxLength={9} value={pf.celular} onChange={(e) => setPf({ ...pf, celular: e.target.value.replace(/\D/g, "") })} /></Campo>
            <Campo etiqueta="Observaciones" className="sm:col-span-2"><textarea rows={2} className="field-input" value={pf.obs} onChange={(e) => setPf({ ...pf, obs: e.target.value })} /></Campo>
          </form>
        )}
      </Modal>
      {/* ---------- Atender solicitud web ---------- */}
      <Modal abierto={!!atender} onClose={() => setAtender(null)} titulo={`Atender solicitud de ${atender?.cliente || ""}`} ancho="max-w-md"
        confirmarGuardar={{ titulo: "¿Atender esta solicitud?", texto: `Pasará a «Cotización» a cargo de ${vendAt || "—"}.`, boton: "Atender" }}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setAtender(null)}>Cancelar</button><button form="f-at" className="btn btn-primary !py-2">Atender</button></>}>
        {atender && (
          <form id="f-at" onSubmit={guardarAtender} className="grid gap-4" noValidate>
            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-marino-50 p-4 text-[13.5px] dark:bg-white/5">
              <div><dt className="text-slate-500">Modelo</dt><dd className="font-semibold">{nombreModelo(atender.modelo)}{atender.color && ` · ${atender.color}`}</dd></div>
              <div><dt className="text-slate-500">Forma de compra</dt><dd className="font-semibold">{atender.pago}</dd></div>
              <div><dt className="text-slate-500">Celular</dt><dd className="font-semibold">{atender.celular}</dd></div>
              <div><dt className="text-slate-500">Sede</dt><dd className="font-semibold">{atender.sede}</dd></div>
              {atender.techo && <div className="col-span-2"><dt className="text-slate-500">Techo de interés</dt><dd className="font-semibold">{atender.techo}</dd></div>}
            </dl>
            <Campo etiqueta="Vendedor que atiende"><select className="field-input" value={vendAt} onChange={(e) => setVendAt(e.target.value)}>{vendedores.map((p) => <option key={p.id}>{p.nombre}</option>)}</select></Campo>
          </form>
        )}
      </Modal>

      {/* ---------- Emitir comprobante manual (gerencia) ---------- */}
      <Modal abierto={!!comp} onClose={() => setComp(null)} titulo={`Emitir comprobante · ${comp?.cliente || ""}`} ancho="max-w-2xl"
        confirmarGuardar={comp ? { titulo: `¿Emitir ${cf.tipo === "Factura" ? "la factura" : "la boleta"}?`, texto: `${cf.tipo === "Factura" ? "F001" : "B001"} · ${cf.tipo === "Factura" ? cf.razon || "—" : comp.cliente} · total S/ ${dosDec(Number(cf.total) || 0)}. El número se asigna en orden y no se reutiliza.`, boton: "Emitir", validar: validarComprobante } : false}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setComp(null)}>Cancelar</button><button form="f-comp" className="btn btn-primary !py-2">Emitir comprobante</button></>}>
        {comp && (
          <form id="f-comp" onSubmit={emitirComprobante} className="grid gap-4 sm:grid-cols-2" noValidate>
            <div className="flex gap-2 sm:col-span-2">
              {["Boleta de venta", "Factura"].map((t) => (
                <button type="button" key={t} onClick={() => setCf({ ...cf, tipo: t, tipoDoc: t === "Factura" ? "RUC" : "DNI", doc: t === "Factura" ? "" : cf.doc })} className={`flex-1 rounded-lg border-2 px-4 py-3 text-left text-[14px] font-semibold ${cf.tipo === t ? "border-marino-700 bg-marino-50 text-marino dark:bg-white/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/15"}`}>{t}<span className="block text-[12px] font-normal text-slate-500">Serie {t === "Factura" ? "F001 · cliente con RUC" : "B001 · cliente con DNI o CE"}</span></button>
              ))}
            </div>
            {cf.tipo === "Factura" ? <>
              <Campo etiqueta="RUC" error={cerr.doc}><input className="field-input" inputMode="numeric" maxLength={11} value={cf.doc} onChange={(e) => setCf({ ...cf, doc: e.target.value.replace(/\D/g, "") })} /></Campo>
              <Campo etiqueta="Razón social" error={cerr.razon}><input className="field-input" value={cf.razon} onChange={(e) => setCf({ ...cf, razon: e.target.value })} /></Campo>
              <Campo etiqueta="Dirección fiscal" error={cerr.direccion} className="sm:col-span-2"><input className="field-input" value={cf.direccion} onChange={(e) => setCf({ ...cf, direccion: e.target.value })} /></Campo>
            </> : (
              <Campo etiqueta={`Documento de ${comp.cliente}`} error={cerr.doc} className="sm:col-span-2"><div className="flex gap-2"><select className="field-input !w-28" value={cf.tipoDoc} onChange={(e) => setCf({ ...cf, tipoDoc: e.target.value })}>{["DNI", "CE", "Pasaporte"].map((d) => <option key={d}>{d}</option>)}</select><input className="field-input" value={cf.doc} onChange={(e) => setCf({ ...cf, doc: e.target.value })} /></div></Campo>
            )}
            <Campo etiqueta="Fecha de emisión" error={cerr.fecha}><input type="date" max={new Date().toISOString().slice(0, 10)} className="field-input" value={cf.fecha} onChange={(e) => setCf({ ...cf, fecha: e.target.value })} /></Campo>
            <Campo etiqueta="Medio de pago"><select className="field-input" value={cf.medio} onChange={(e) => setCf({ ...cf, medio: e.target.value })}>{MEDIOS.map((m) => <option key={m}>{m}</option>)}</select></Campo>
            <Campo etiqueta="Descripción" error={cerr.descripcion} className="sm:col-span-2"><input className="field-input" value={cf.descripcion} onChange={(e) => setCf({ ...cf, descripcion: e.target.value })} /></Campo>
            <Campo etiqueta="Importe total (S/, IGV incluido)" error={cerr.total}><input className="field-input tabular-nums" inputMode="decimal" value={cf.total} onChange={(e) => setCf({ ...cf, total: e.target.value.replace(/[^\d.]/g, "") })} /></Campo>
            <dl className="grid grid-cols-3 gap-2 self-end rounded-lg bg-marino-50 p-3 text-[12.5px] tabular-nums dark:bg-white/5">
              <div><dt className="text-slate-500">Op. gravada</dt><dd className="font-semibold">S/ {dosDec((Number(cf.total) || 0) / (1 + IGV))}</dd></div>
              <div><dt className="text-slate-500">IGV 18%</dt><dd className="font-semibold">S/ {dosDec((Number(cf.total) || 0) - (Number(cf.total) || 0) / (1 + IGV))}</dd></div>
              <div><dt className="text-slate-500">Total</dt><dd className="font-semibold">S/ {dosDec(Number(cf.total) || 0)}</dd></div>
            </dl>
            <div className="sm:col-span-2"><Aviso>Comprobante manual interno de EPSA Motor. El comprobante electrónico ante SUNAT se emite en el sistema de facturación de la empresa.</Aviso></div>
          </form>
        )}
      </Modal>

      {/* ---------- Ver comprobante ---------- */}
      <Modal abierto={!!verComp} onClose={() => setVerComp(null)} titulo="Comprobante" ancho="max-w-lg"
        pie={<>{verComp && puede("comprobantes.emitir") && <button className="btn !py-2 border border-acento/40 text-acento hover:bg-acento/10" onClick={() => anularComprobante(verComp)}>Anular</button>}<button className="btn btn-secondary !py-2" onClick={() => setVerComp(null)}>Cerrar</button></>}>
        {verComp?.comprobante && (() => { const c = verComp.comprobante; return (
          <div className="overflow-hidden rounded-xl border border-slate-200 text-[13.5px] dark:border-white/10">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5 dark:border-white/10">
              <div><p className="font-bold text-marino dark:text-white">{EMPRESA.razon}</p><p className="text-slate-500">RUC {EMPRESA.ruc}</p></div>
              <div className="rounded-lg border-2 border-marino px-3 py-2 text-center dark:border-white/40"><p className="text-[11px] font-bold uppercase text-marino dark:text-white">{c.tipo}</p><p className="font-mono font-bold tabular-nums">{c.serie}-{String(c.numero).padStart(8, "0")}</p></div>
            </div>
            <dl className="grid grid-cols-2 gap-3 p-5">
              <div><dt className="text-slate-500">Cliente</dt><dd className="font-semibold">{c.cliente}</dd></div>
              <div><dt className="text-slate-500">{c.tipoDoc}</dt><dd className="font-semibold tabular-nums">{c.doc}</dd></div>
              {c.direccion && <div className="col-span-2"><dt className="text-slate-500">Dirección fiscal</dt><dd>{c.direccion}</dd></div>}
              <div><dt className="text-slate-500">Fecha de emisión</dt><dd className="font-semibold">{c.fecha}</dd></div>
              <div><dt className="text-slate-500">Medio de pago</dt><dd className="font-semibold">{c.medio}</dd></div>
              <div className="col-span-2"><dt className="text-slate-500">Descripción</dt><dd>{c.descripcion}</dd></div>
            </dl>
            <dl className="space-y-1 border-t border-slate-200 bg-slate-50 p-5 tabular-nums dark:border-white/10 dark:bg-white/5">
              <div className="flex justify-between"><dt>Op. gravada</dt><dd>S/ {dosDec(c.gravada)}</dd></div>
              <div className="flex justify-between"><dt>IGV 18%</dt><dd>S/ {dosDec(c.igv)}</dd></div>
              <div className="flex justify-between text-[15px] font-bold text-marino dark:text-white"><dt>Total</dt><dd>S/ {dosDec(c.total)}</dd></div>
            </dl>
            <p className="px-5 py-3 text-[12px] text-slate-500">Emitido por {c.emitidoPor}. Comprobante manual interno; no reemplaza al comprobante electrónico SUNAT.</p>
          </div>
        ); })()}
      </Modal>
    </div>
  );
}
