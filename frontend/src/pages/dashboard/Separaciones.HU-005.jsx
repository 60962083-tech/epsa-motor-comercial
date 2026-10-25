// HU-005 · Separar una moto con adelanto confirmado
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Link } from "../../components/dashboard/LinkPanel";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { DIAS_SEPARACION, MAX_EXTENSIONES, MOTIVOS_CANCELACION, formatoSoles } from "../../data/mockData";
import { estadoVisible, numeroSeparacion, textoPlazo, useSeparaciones } from "../../servicios/separaciones";
import { fechaHora, fechaLarga, formatoTelefono, hoyLocal, limpiarTexto } from "../../lib/validar";
import { pesoLegible } from "../../lib/archivos";
import { nombreCliente } from "../../lib/sprint2";
import useArchivoLocal from "../../hooks/useArchivoLocal";
import ModeloImg from "../../components/ModeloImg";
import { Aviso, Campo, Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, useToast } from "../../components/ui";
import { ColorPunto, EstadoConexion, Pill, TONO_SEPARACION, fechaCorta } from "../../components/dashboard/Sprint2";
import { nombreModeloDe } from "../../components/dashboard/MovimientoModales";
import SepararModal from "../../components/dashboard/SepararModal";

const FILTRO_ESTADOS = ["Activa", "Por vencer", "Vencida por liberar", "Convertida en venta", "Cancelada", "Vencida"];
// Primero lo que pide acción
const PRIORIDAD = { "Vencida por liberar": 0, "Por vencer": 1, Activa: 2, "Convertida en venta": 3, Cancelada: 4, Vencida: 5 };
const corto = (n) => String(n || "").split(" ").slice(0, 2).join(" ");

// Voucher guardado (foto, PDF o ejemplo)
function Voucher({ voucher }) {
  const url = useArchivoLocal(voucher?.archivo);
  if (!voucher) return <p className="text-[13px] text-slate-500">Sin voucher (pago en efectivo).</p>;
  const imagen = voucher.tipo?.startsWith("image/");
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10" data-voucher>
      {imagen && url ? <a href={url} target="_blank" rel="noopener noreferrer" className="block bg-slate-50 dark:bg-white/5"><img src={url} alt="Voucher del adelanto" className="h-32 w-full object-contain" /></a>
        : <span className={`grid h-16 place-items-center text-[12px] font-bold ${imagen ? "bg-sky-50 text-sky-700 dark:bg-sky-500/10" : "bg-red-50 text-acento dark:bg-red-500/10"}`}>{imagen ? "FOTO" : "PDF"}</span>}
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-marino dark:text-white" title={voucher.nombre}>{voucher.nombre}</p>
          <p className="text-[12px] text-slate-500">{voucher.ejemplo ? "Archivo de ejemplo" : voucher.tamano ? pesoLegible(voucher.tamano) : ""}</p>
        </div>
        {url && <a className={btnMini} href={url} target="_blank" rel="noopener noreferrer">Abrir</a>}
      </div>
    </div>
  );
}

export default function Separaciones() {
  const { unidades, modelos, publicos, ubicaciones, equipo = [] } = useApp();
  const { user, puede } = useAuth();
  const sep = useSeparaciones();
  const toast = useToast();
  const nav = useNavigate();
  const { state } = useLocation();
  const [f, setF] = useState({ q: "", estado: "", sede: "", vendedor: "" });
  const [nueva, setNueva] = useState(state?.separar ? { unidad: unidades.find((u) => u.id === state.separar) || null } : null);
  const [detalle, setDetalle] = useState(null);
  const [cancelar, setCancelar] = useState(null); const [cf, setCf] = useState({ motivo: "", detalle: "" }); const [cerr, setCerr] = useState({});
  const [extender, setExtender] = useState(null); const [motivoExt, setMotivoExt] = useState(""); const [eerr, setEerr] = useState("");
  const gestiona = puede("separaciones.gestionar");
  const registra = puede("separaciones.registrar");
  const hoy = hoyLocal();
  const unidad = (id) => unidades.find((u) => u.id === id);
  const modeloDe = (u) => modelos.find((m) => m.id === u?.modelo) || publicos.find((m) => m.id === u?.modelo);
  useEffect(() => { if (state?.separar) window.history.replaceState({}, ""); }, []); // eslint-disable-line

  const lista = useMemo(() => sep.lista.filter((s) => {
    const q = f.q.trim().toLowerCase();
    const u = unidad(s.unidad);
    if (q && !`${s.numero} ${nombreCliente(s.clienteDatos)} ${s.clienteDatos?.doc || ""} ${s.unidad} ${s.operacion} ${nombreModeloDe(u, modelos, publicos)}`.toLowerCase().includes(q)) return false;
    return (!f.estado || s.estadoVisible === f.estado) && (!f.sede || s.sede === f.sede) && (!f.vendedor || s.vendedor === f.vendedor);
  }).sort((a, b) => PRIORIDAD[a.estadoVisible] - PRIORIDAD[b.estadoVisible] || (a.estado === "Activa" ? a.vence.localeCompare(b.vence) : b.fecha.localeCompare(a.fecha))), [sep.lista, f, unidades]); // eslint-disable-line

  const activas = sep.lista.filter((s) => s.estado === "Activa");
  const porVencer = activas.filter((s) => s.estadoVisible === "Por vencer");
  const vencidas = activas.filter((s) => s.estadoVisible === "Vencida por liberar");
  const vendedoresLista = [...new Set([...equipo.filter((p) => p.rol === "vendedor").map((p) => p.nombre), ...sep.lista.map((s) => s.vendedor)])];
  const actual = detalle && sep.lista.find((s) => s.id === detalle);

  function abrirCancelar(s) { setCf({ motivo: "", detalle: "" }); setCerr({}); setCancelar(s); }
  function guardarCancelar(e) {
    e.preventDefault();
    const x = sep.validarCancelacion(cf.motivo, cf.detalle);
    setCerr(x); if (Object.keys(x).length) return;
    toast(sep.cancelar(cancelar, cf.motivo, cf.detalle)); setCancelar(null); setDetalle(null);
  }
  function abrirExtender(s) { setMotivoExt(""); setEerr(""); setExtender(s); }
  function guardarExtender(e) {
    e.preventDefault();
    const x = sep.validarExtension(extender, motivoExt);
    setEerr(x); if (x) return;
    toast(sep.extender(extender, motivoExt)); setExtender(null);
  }
  function liberar(s) { toast(sep.liberarVencida(s)); setDetalle(null); }
  const puedeVender = (s) => s.estado === "Activa" && (user.rol !== "vendedor" || s.vendedor === user.nombre);

  return (
    <div>
      <PageHeader titulo="Separaciones" subtitulo={`Motos reservadas para un cliente con un adelanto confirmado. Cada separación vence a los ${DIAS_SEPARACION} días del pago si no se concreta la venta.`}>
        <EstadoConexion hu="HU-005" />
        {registra && <button id="btn-separar" className="btn btn-acento !py-2.5 shadow-lg shadow-acento/20" onClick={() => setNueva({ unidad: null })}>Separar moto</button>}
      </PageHeader>

      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Activas" valor={activas.length} nota="Motos reservadas ahora" />
        <Stat etiqueta="Vencen en 2 días" valor={porVencer.length} tono={porVencer.length ? "ambar" : "marino"} nota="Llama al cliente" />
        <Stat etiqueta="Vencidas por liberar" valor={vencidas.length} tono={vencidas.length ? "rojo" : "marino"} nota="Libéralas o extiende el plazo" />
        <Stat etiqueta="Adelantos recibidos" valor={formatoSoles(activas.reduce((t, s) => t + s.monto, 0))} tono="verde" nota="De separaciones activas" />
      </div>
      {vencidas.length > 0 && gestiona && <div className="mb-4"><Aviso tipo="error">{vencidas.length === 1 ? "Una separación venció" : `${vencidas.length} separaciones vencieron`} sin concretar la venta. Libera la moto para que vuelva a Disponibilidad o extiende el plazo si el cliente lo pidió.</Aviso></div>}

      <Card className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="sm:col-span-2"><label className="field-label">Buscar</label><input className="field-input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Cliente, documento, moto o N° de operación" /></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}><option value="">Todos</option>{FILTRO_ESTADOS.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><label className="field-label">Sede</label><select className="field-input" value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}><option value="">Todas</option>{ubicaciones.filter((x) => x.tipo === "Sede propia").map((x) => <option key={x.id}>{x.nombre}</option>)}</select></div>
        <div><label className="field-label">Vendedor</label><select className="field-input" value={f.vendedor} onChange={(e) => setF({ ...f, vendedor: e.target.value })}><option value="">Todos</option>{vendedoresLista.map((x) => <option key={x}>{x}</option>)}</select></div>
      </Card>

      {lista.length === 0 ? <Vacio titulo={sep.lista.length ? "Sin separaciones con esos filtros" : "Aún no hay separaciones"} texto={sep.lista.length ? "Limpia los filtros para ver todas." : "Cuando un cliente deje un adelanto, sepárale la moto desde aquí o desde Disponibilidad."}>{registra && !sep.lista.length && <button className="btn btn-primary" onClick={() => setNueva({ unidad: null })}>Separar moto</button>}</Vacio> : (
        <Tabla columnas={["N°", "Cliente", "Moto", "Adelanto", "Plazo", "Estado", "Vendedor", "Acciones"]}>
          {lista.map((s) => {
            const u = unidad(s.unidad);
            return (
              <tr key={s.id} className="align-top" data-separacion={s.numero}>
                <td className="whitespace-nowrap px-4 py-3 font-semibold text-marino dark:text-white">{s.numero}<span className="block text-[12px] font-normal text-slate-400">{fechaCorta(s.fecha)}</span></td>
                <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{nombreCliente(s.clienteDatos)}</p><p className="text-[12px] text-slate-400">{s.clienteDatos?.tipoDoc} {s.clienteDatos?.doc}</p></td>
                <td className="px-4 py-3"><Link className="font-semibold text-marino-700 hover:underline dark:text-white" to={`/admin/inventario/${s.unidad}`}>{s.unidad}</Link> <span className="text-slate-500">{nombreModeloDe(u, modelos, publicos)}</span><span className="mt-0.5 flex items-start gap-1.5 text-[12px] text-slate-400"><ColorPunto color={u?.color} className="mt-[3px] h-2.5 w-2.5" /><span>{u?.color} en {s.sede}</span></span></td>
                <td className="whitespace-nowrap px-4 py-3"><span className="cifra font-semibold">{formatoSoles(s.monto)}</span><span className="block text-[12px] text-slate-400">{s.medio}{s.operacion ? ` ${s.operacion}` : ""}</span></td>
                <td className="whitespace-nowrap px-4 py-3">{s.estado === "Activa" ? <><span className={s.dias < 0 ? "font-semibold text-acento" : s.dias <= 2 ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>{textoPlazo(s, hoy)}</span><span className="block text-[12px] text-slate-400">hasta el {fechaCorta(s.vence)}{s.extensiones ? `, extendida ${s.extensiones}x` : ""}</span></> : <span className="text-slate-400">—</span>}</td>
                <td className="px-4 py-3"><Pill tono={TONO_SEPARACION[s.estadoVisible]}>{s.estadoVisible}</Pill></td>
                <td className="px-4 py-3 text-slate-500">{corto(s.vendedor)}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5 whitespace-nowrap">
                  <button className={btnMini} onClick={() => setDetalle(s.id)}>Ver</button>
                  {s.estadoVisible === "Vencida por liberar" && gestiona && <button className={btnMini} onClick={() => liberar(s)}>Liberar moto</button>}
                  {puedeVender(s) && s.estadoVisible !== "Vencida por liberar" && <button className={btnMini} onClick={() => nav("/admin/ventas", { state: { desdeSeparacion: s.id } })}>Registrar venta</button>}
                </div></td>
              </tr>
            );
          })}
        </Tabla>
      )}

      {/* Detalle */}
      <Modal abierto={!!actual} onClose={() => setDetalle(null)} titulo={actual ? `Separación ${actual.numero}` : ""} ancho="max-w-3xl" sinAvisoCambios
        pie={actual && <>
          {actual.estado === "Activa" && gestiona && <button className="btn !py-2 border border-acento/40 text-acento hover:bg-acento/10" onClick={() => abrirCancelar(actual)}>Cancelar separación</button>}
          {actual.estado === "Activa" && gestiona && (actual.extensiones || 0) < MAX_EXTENSIONES && <button className="btn btn-secondary !py-2" onClick={() => abrirExtender(actual)}>Extender plazo</button>}
          {actual.estadoVisible === "Vencida por liberar" && gestiona && <button className="btn btn-primary !py-2" onClick={() => liberar(actual)}>Liberar moto</button>}
          {puedeVender(actual) && actual.estadoVisible !== "Vencida por liberar" && <button className="btn btn-primary !py-2" onClick={() => nav("/admin/ventas", { state: { desdeSeparacion: actual.id } })}>Registrar venta</button>}
          {actual.ventaId && <button className="btn btn-secondary !py-2" onClick={() => nav("/admin/ventas")}>Ver venta</button>}
        </>}>
        {actual && (() => {
          const u = unidad(actual.unidad); const m = modeloDe(u); const c = actual.clienteDatos;
          const total = Math.max(1, (new Date(`${actual.vence}T12:00:00`) - new Date(actual.fecha)) / 86400000);
          const pasados = Math.min(total, Math.max(0, (Date.now() - new Date(actual.fecha)) / 86400000));
          return (
            <div className="space-y-5" data-detalle-separacion>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pill tono={TONO_SEPARACION[actual.estadoVisible]} className="!text-[13px]">{actual.estadoVisible}</Pill>
                <p className="text-[13px] text-slate-500">Registrada el {fechaHora(actual.fecha)} por {actual.registradaPor || actual.vendedor}</p>
              </div>
              {actual.estado === "Activa" && (
                <div>
                  <div className="flex justify-between text-[12.5px] text-slate-500"><span>Pago {fechaCorta(actual.fechaPago)}</span><span className={actual.dias < 0 ? "font-semibold text-acento" : actual.dias <= 2 ? "font-semibold text-amber-700" : ""}>{textoPlazo(actual, hoy)} ({fechaLarga(actual.vence)})</span></div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10"><div className={`h-full rounded-full ${actual.dias < 0 ? "bg-acento" : actual.dias <= 2 ? "bg-amber-500" : "bg-marino-700 dark:bg-white/70"}`} style={{ width: `${Math.round((pasados / total) * 100)}%` }} /></div>
                </div>
              )}
              <div className="grid gap-4 md:grid-cols-3">
                <section className="rounded-xl2 border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-[12.5px] font-semibold text-slate-500">Moto</p>
                  <div className="mt-2 grid h-24 place-items-center overflow-hidden rounded-lg bg-escenario dark:bg-escenario-oscuro">{m && <ModeloImg modelo={m} color={u?.color} className="h-full w-full object-contain p-2" />}</div>
                  <p className="mt-2 font-bold text-marino dark:text-white">{actual.unidad} {m?.nombre}</p>
                  <p className="flex items-center gap-1.5 text-[12.5px] text-slate-500"><ColorPunto color={u?.color} className="h-2.5 w-2.5" />{u?.color} en {actual.sede}</p>
                  <Link className="mt-2 inline-block text-[13px] font-semibold text-marino-700 hover:underline dark:text-white" to={`/admin/inventario/${actual.unidad}`}>Ver ficha de la moto</Link>
                </section>
                <section className="rounded-xl2 border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-[12.5px] font-semibold text-slate-500">Cliente</p>
                  <p className="mt-2 font-bold text-marino dark:text-white">{nombreCliente(c)}</p>
                  <p className="text-[13px] text-slate-500">{c?.tipoDoc} {c?.doc}</p>
                  {c?.celular && <p className="mt-2 text-[13px]"><a className="font-semibold text-marino-700 hover:underline dark:text-white" href={`tel:+51${c.celular}`}>{formatoTelefono(c.celular)}</a> <a className="ml-2 font-semibold text-emerald-700 hover:underline" target="_blank" rel="noopener noreferrer" href={`https://wa.me/51${c.celular}?text=${encodeURIComponent(`Hola ${c.nombres || ""}, te escribimos de EPSA Motor por la separación de tu Torito.`)}`}>WhatsApp</a></p>}
                  {c?.correo && <p className="text-[13px] text-slate-500">{c.correo}</p>}
                  <p className="mt-2 text-[12.5px] text-slate-400">Vendedor: {actual.vendedor}</p>
                </section>
                <section className="rounded-xl2 border border-slate-200 p-4 dark:border-white/10">
                  <p className="text-[12.5px] font-semibold text-slate-500">Adelanto</p>
                  <p className="cifra mt-2 font-display text-[2rem] font-bold leading-none text-marino dark:text-white">{formatoSoles(actual.monto)}</p>
                  <p className="mt-1 text-[13px] text-slate-500">{actual.medio}{actual.operacion ? `, operación ${actual.operacion}` : ""}</p>
                  <p className="text-[13px] text-slate-500">Pagado el {fechaCorta(actual.fechaPago)}</p>
                  <div className="mt-3"><Voucher voucher={actual.voucher} /></div>
                </section>
              </div>
              {actual.obs && <p className="rounded-lg bg-slate-50 px-4 py-3 text-[13.5px] text-slate-600 dark:bg-white/5 dark:text-white/70">{actual.obs}</p>}
              <section>
                <p className="mb-2 text-[13px] font-semibold text-slate-500">Historial</p>
                <ol className="space-y-2 border-l-2 border-slate-200 pl-4 text-[13.5px] dark:border-white/15">
                  <li><span className="text-slate-400">{fechaHora(actual.fecha)}</span> Separada por {actual.registradaPor || actual.vendedor} con {formatoSoles(actual.monto)} de adelanto.</li>
                  {(actual.prorrogas || []).map((p, i) => <li key={i}><span className="text-slate-400">{fechaHora(p.fecha)}</span> {p.usuario} extendió el plazo del {fechaCorta(p.antes)} al {fechaCorta(p.vence)}: {p.motivo}</li>)}
                  {actual.conversion && <li><span className="text-slate-400">{fechaHora(actual.conversion.fecha)}</span> Convertida en venta por {actual.conversion.usuario}.</li>}
                  {actual.cancelacion && <li><span className="text-slate-400">{fechaHora(actual.cancelacion.fecha)}</span> Cancelada por {actual.cancelacion.usuario}: {actual.cancelacion.motivo}{actual.cancelacion.detalle ? `. ${actual.cancelacion.detalle}` : ""}</li>}
                  {actual.liberacion && <li><span className="text-slate-400">{fechaHora(actual.liberacion.fecha)}</span> Venció y {actual.liberacion.usuario} liberó la moto.</li>}
                </ol>
              </section>
            </div>
          );
        })()}
      </Modal>

      {/* Cancelar */}
      <Modal abierto={!!cancelar} onClose={() => setCancelar(null)} titulo={cancelar ? `Cancelar ${numeroSeparacion(cancelar)}` : ""} ancho="max-w-md" confirmarGuardar={false}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setCancelar(null)}>Volver</button><button form="f-cancelar-sep" className="btn !py-2 bg-acento text-white hover:bg-acento-600">Cancelar separación</button></>}>
        {cancelar && (
          <form id="f-cancelar-sep" onSubmit={guardarCancelar} className="grid gap-4" noValidate>
            <p className="text-[14px] text-slate-600 dark:text-white/70">{cancelar.unidad} volverá a estar disponible para la venta.</p>
            <Campo etiqueta="Motivo" error={cerr.motivo}><select id="can-sep-motivo" className="field-input" value={cf.motivo} onChange={(e) => { setCf({ ...cf, motivo: e.target.value }); setCerr({}); }}><option value="">Elige…</option>{MOTIVOS_CANCELACION.map((x) => <option key={x}>{x}</option>)}</select></Campo>
            <Campo etiqueta={cf.motivo === "Otro motivo" ? "Detalle" : "Detalle (opcional)"} error={cerr.detalle}><textarea rows={2} maxLength={260} className="field-input" value={cf.detalle} onChange={(e) => { setCf({ ...cf, detalle: e.target.value }); if (cerr.detalle) setCerr({}); }} /></Campo>
            <Aviso tipo="aviso">Coordina la devolución del adelanto de {formatoSoles(cancelar.monto)} según la política de la empresa.</Aviso>
          </form>
        )}
      </Modal>

      {/* Extender */}
      <Modal abierto={!!extender} onClose={() => setExtender(null)} titulo={extender ? `Extender ${numeroSeparacion(extender)}` : ""} ancho="max-w-md" confirmarGuardar={false}
        pie={<><button className="btn btn-secondary !py-2" onClick={() => setExtender(null)}>Volver</button><button form="f-extender" className="btn btn-primary !py-2">Extender plazo</button></>}>
        {extender && (
          <form id="f-extender" onSubmit={guardarExtender} className="grid gap-4" noValidate>
            <p className="text-[14px] text-slate-600 dark:text-white/70">El plazo pasa del <b>{fechaLarga(extender.vence)}</b> al <b>{fechaLarga(sep.nuevoVence(extender))}</b>. Quedan {MAX_EXTENSIONES - (extender.extensiones || 0) - 1} extensiones después de esta.</p>
            <Campo etiqueta="Motivo" error={eerr}><input id="ext-motivo" className="field-input" maxLength={220} value={motivoExt} onChange={(e) => { setMotivoExt(e.target.value); setEerr(""); }} placeholder="Ej: espera la aprobación del crédito" /></Campo>
            {estadoVisible(extender, hoy) === "Vencida por liberar" && <p className="text-[12.5px] text-slate-500">Ya venció: el nuevo plazo se cuenta desde hoy.</p>}
            {limpiarTexto(motivoExt).length > 200 && <p className="text-[12px] text-acento">Máximo 200 caracteres.</p>}
          </form>
        )}
      </Modal>

      <SepararModal abierto={!!nueva} unidad={nueva?.unidad || null} onClose={() => setNueva(null)} onHecho={(s) => setDetalle(s.id)} />
    </div>
  );
}
