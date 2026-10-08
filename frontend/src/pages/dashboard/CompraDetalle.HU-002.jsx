import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, Campo, Card, PageHeader, Tabla, useConfirm, useToast } from "../../components/ui";
import { Progreso } from "../../components/charts";
import HUBadge from "../../components/HUBadge";
import { ESTADO_COMPRA } from "./Compras.HU-034";

const FILA = () => ({ nummotuni: "", chauni: "" });
// Misma normalización que el backend (unidad.validacion.ts): agrupa espacios, quita bordes y pasa a mayúsculas.
const norm = (t) => String(t || "").trim().replace(/\s+/g, " ");
const serie = (t) => norm(t).toUpperCase();
const hoyISO = () => new Date().toISOString().slice(0, 10);

/**
 * HU-002 — Completar identificación de motos compradas (frontend del backend de Michelle).
 * 1) PUT  /api/compras/:id/factura   → metadatos de la factura recibida (emisor, número, fecha, cantidad).
 * 2) POST /api/compras/:id/unidades  → lote de 1 a 100 motos (motor y chasis únicos).
 * 3) GET  /api/compras/:id/unidades  → factura, fichas identificadas y cantidad pendiente.
 * Identificar NO recibe, prepara ni libera motos: las unidades nacen "No disponible".
 */
export default function CompraDetalle() {
  const { id } = useParams();
  const { compras, modelos, unidades: inv, actualizar, agregar } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const gestiona = puede("compras.factura");
  const [compra, setCompra] = useState(null);
  const [det, setDet] = useState({ factura: null, unidades: [], requiere_revision: false });
  const [cargando, setCargando] = useState(true); const [errorCarga, setErrorCarga] = useState("");
  const [fac, setFac] = useState({ emisor: "Crosland Perú S.A.C.", numero: "", fecha_emision: "", cantidad_motos: "" }); const [ferr, setFerr] = useState({});
  const [filas, setFilas] = useState([FILA()]); const [uerr, setUerr] = useState({}); const [conflicto, setConflicto] = useState(null);
  const [lote, setLote] = useState(""); const [enviando, setEnviando] = useState(false);

  async function cargar() {
    setCargando(true); setErrorCarga("");
    try {
      if (MODO_REAL) {
        const c = (await api.obtenerCompra(id)).data;
        setCompra(c);
        if (gestiona) {
          const d = (await api.listarUnidadesCompra(id)).data;
          setDet({ factura: d?.factura || null, unidades: d?.unidades || [], requiere_revision: !!(d?.factura && d.factura.cantidad_motos !== d.cantidad_comprada) });
          setCompra({ ...c, cantidad_pendiente: d?.cantidad_pendiente ?? c.cantidad_pendiente, estcom: d?.estcom || c.estcom });
        }
      } else {
        const c = compras.find((x) => x.codcom === id);
        if (!c) throw Object.assign(new Error("La compra no existe"), { status: 404 });
        setCompra(c);
        setDet({ factura: c.factura || null, unidades: c.unidades || [], requiere_revision: !!c.factura?.requiere_revision });
      }
    } catch (e) { setErrorCarga(mensajeError(e)); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, [id, compras]); // eslint-disable-line

  if (cargando && !compra) return <p className="py-10 text-center text-slate-400">Cargando compra…</p>;
  if (errorCarga) return <div className="space-y-3"><Aviso tipo="error">{errorCarga}</Aviso><Link className="btn btn-secondary" to="/admin/compras">Volver a compras</Link></div>;

  const hechas = compra.cancom - compra.cantidad_pendiente;
  const tieneFactura = compra.estcom !== "Pendiente de factura";
  const completa = compra.estcom === "Identificada";
  const bloqueada = det.requiere_revision;
  const modeloLocal = modelos.find((m) => m.codmod === compra.codmod);

  async function guardarFactura(e) {
    e.preventDefault(); const x = {};
    const cuerpo = { emisor: norm(fac.emisor), numero: norm(fac.numero), fecha_emision: fac.fecha_emision, cantidad_motos: Number(fac.cantidad_motos) };
    if (!cuerpo.emisor) x.emisor = "Copia el emisor tal como aparece en la factura."; else if (cuerpo.emisor.length > 160) x.emisor = "Máximo 160 caracteres.";
    if (!cuerpo.numero) x.numero = "Copia el número de la factura."; else if (cuerpo.numero.length > 80) x.numero = "Máximo 80 caracteres.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha_emision)) x.fecha_emision = "Indica la fecha de emisión."; else if (cuerpo.fecha_emision > hoyISO()) x.fecha_emision = "La fecha de emisión no puede ser futura.";
    if (!Number.isInteger(cuerpo.cantidad_motos) || cuerpo.cantidad_motos < 1) x.cantidad_motos = "Cantidad entera mayor a 0.";
    setFerr(x); if (Object.keys(x).length) return;
    const difiere = cuerpo.cantidad_motos !== compra.cancom;
    const ok = await confirmar(difiere
      ? { titulo: "La cantidad no coincide", texto: `La factura declara ${cuerpo.cantidad_motos} motos y la compra es de ${compra.cancom}. Se registrará el documento, pero la identificación quedará bloqueada hasta que la gerencia revise el dato (regla de HU-002). ¿Registrar igual?`, boton: "Registrar con revisión", peligro: true }
      : { titulo: "Registrar factura", texto: `Factura ${cuerpo.numero} de ${cuerpo.emisor}, emitida el ${cuerpo.fecha_emision}, por ${cuerpo.cantidad_motos} motos. Una vez registrada no se puede sobrescribir.`, boton: "Registrar factura" });
    if (!ok) return;
    try {
      if (MODO_REAL) {
        const r = await api.registrarFactura(id, cuerpo);
        toast(r.data?.requiere_revision ? (r.message || "Factura registrada con discrepancia: requiere revisión.") : "Factura registrada. La compra pasa a «Pendiente de identificación».", r.data?.requiere_revision ? "error" : "ok");
      } else {
        actualizar("compras", compra.id, { estcom: "Pendiente de identificación", factura: { codfac: String(Date.now()).slice(-5), ...cuerpo, archivo_adjuntado: false, requiere_revision: difiere } }, `Factura ${cuerpo.numero} registrada (compra #${id})`);
        toast(difiere ? "Factura registrada con discrepancia: la identificación queda bloqueada." : "Factura registrada. La compra pasa a «Pendiente de identificación».", difiere ? "error" : "ok");
      }
      cargar();
    } catch (er) { toast(mensajeError(er), "error"); }
  }

  const setFila = (i, k, v) => setFilas((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  function cargarLote() {
    const rows = lote.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [a, b] = l.split(/[,;\t]+/); return { nummotuni: (a || "").trim(), chauni: (b || "").trim() }; });
    if (!rows.length) return toast("Pega una línea por moto: MOTOR, CHASIS", "error");
    const max = Math.min(100, compra.cantidad_pendiente);
    setFilas(rows.slice(0, max)); setLote("");
    toast(rows.length > max ? `Se cargaron ${max} filas (faltan ${compra.cantidad_pendiente} por identificar).` : `${rows.length} filas cargadas`);
  }

  async function identificar(e) {
    e.preventDefault(); setConflicto(null); const x = {};
    const rows = filas.map((r) => ({ nummotuni: serie(r.nummotuni), chauni: serie(r.chauni) }));
    if (rows.length > compra.cantidad_pendiente) x.general = `Solo faltan ${compra.cantidad_pendiente} unidades por identificar.`;
    rows.forEach((r, i) => {
      if (!r.nummotuni) x[`m${i}`] = "Ingresa el número de motor."; else if (r.nummotuni.length > 100) x[`m${i}`] = "Máximo 100 caracteres.";
      if (!r.chauni) x[`c${i}`] = "Ingresa el número de chasis."; else if (r.chauni.length > 100) x[`c${i}`] = "Máximo 100 caracteres.";
    });
    rows.forEach((r, i) => {
      if (r.nummotuni && rows.findIndex((o) => o.nummotuni === r.nummotuni) !== i) x[`m${i}`] = "Motor repetido en este lote.";
      if (r.chauni && rows.findIndex((o) => o.chauni === r.chauni) !== i) x[`c${i}`] = "Chasis repetido en este lote.";
    });
    if (!MODO_REAL) rows.forEach((r, i) => {
      const u = inv.find((v) => serie(v.motor) === r.nummotuni); if (u) x[`m${i}`] = `Motor ya registrado en la unidad ${u.id}.`;
      const w = inv.find((v) => serie(v.chasis) === r.chauni); if (w) x[`c${i}`] = `Chasis ya registrado en la unidad ${w.id}.`;
    });
    setUerr(x); if (Object.keys(x).length) return;
    if (!(await confirmar({ titulo: `Identificar ${rows.length} unidad(es)`, texto: `Se vincularán a la compra #${id} (${compra.nommod}, ${compra.colcom}). Revisa motor y chasis: una ficha registrada no se puede editar ni duplicar.`, boton: "Identificar" }))) return;
    setEnviando(true);
    try {
      const cuerpo = rows.map((r) => ({ ...r, codmod: String(compra.codmod), coluni: compra.colcom }));
      if (MODO_REAL) await api.vincularUnidades(id, cuerpo);
      else {
        const base = inv.reduce((m, u) => Math.max(m, Number(String(u.id).replace(/\D/g, "")) || 0), 0);
        cuerpo.forEach((r, i) => agregar("unidades", { id: `MC-${String(base + i + 1).padStart(3, "0")}`, codcom: id, modelo: modeloLocal?.id || "", color: compra.colcom, ubicacion: "", preparacion: "Sin preparar", techo: "Sin techo", disponibilidad: "No disponible", motor: r.nummotuni, chasis: r.chauni, historial: [{ fecha: hoyISO(), detalle: `Identificada en compra #${id} (HU-002) · ${user.nombre}` }] }));
        const nuevas = [...(compra.unidades || []), ...cuerpo.map((r) => ({ ...r, fecreguni: hoyISO() }))];
        const pend = compra.cancom - nuevas.length;
        actualizar("compras", compra.id, { unidades: nuevas, cantidad_pendiente: pend, estcom: pend === 0 ? "Identificada" : "Pendiente de identificación" }, `${cuerpo.length} unidades identificadas (compra #${id})`);
      }
      toast(`${cuerpo.length} unidades identificadas. Quedan «No disponible» hasta su recepción en Inventario.`); setFilas([FILA()]); cargar();
    } catch (er) {
      setConflicto({ texto: er.detalle?.conflicto ? er.message : mensajeError(er), detalle: er.detalle?.conflicto || null });
      toast(mensajeError(er), "error");
    } finally { setEnviando(false); }
  }

  const f = det.factura;
  return (
    <div>
      <HUBadge code="HU-002" titulo="Completar identificación de motos compradas" />
      <PageHeader titulo={`Compra #${compra.codcom} · ${compra.nommod}`} subtitulo={`${compra.colcom} · ${compra.cancom} motos · registrada el ${compra.feccom} a las ${String(compra.horcom).slice(0, 5)}`}>
        <Link to="/admin/compras" className="btn btn-secondary !py-2.5">← Compras</Link>
        {hechas > 0 && <Link to="/admin/inventario" className="btn btn-secondary !py-2.5">Ver en inventario</Link>}
      </PageHeader>

      {/* Línea de tiempo del proceso */}
      <ol className="mb-6 grid gap-3 sm:grid-cols-3">
        {[["Compra registrada", "HU-034", true], ["Factura recibida", "HU-002", tieneFactura], ["Unidades identificadas", "HU-002", completa]].map(([t, hu, ok], i) => (
          <li key={t} className={`flex items-center gap-3 rounded-xl2 border p-4 ${ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#121a2b]"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${ok ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-white/10"}`}>{ok ? "✓" : i + 1}</span>
            <div><p className="font-semibold text-marino dark:text-white">{t}</p><p className="text-[12px] text-slate-400">{hu}</p></div>
          </li>
        ))}
      </ol>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card>
          <span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ESTADO_COMPRA[compra.estcom] || "bg-slate-200"}`}>{compra.estcom}</span>
          <div className="mt-4"><Progreso valor={hechas} max={compra.cancom} /></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-lg bg-marino-50 p-3 dark:bg-white/5"><dt className="text-slate-400">Compradas</dt><dd className="text-xl font-bold text-marino dark:text-white">{compra.cancom}</dd></div>
            <div className="rounded-lg bg-marino-50 p-3 dark:bg-white/5"><dt className="text-slate-400">Por identificar</dt><dd className="text-xl font-bold text-acento">{compra.cantidad_pendiente}</dd></div>
          </dl>
          <p className="mt-3 text-[12.5px] text-slate-500">Identificar no confirma la recepción física, la ubicación ni la disponibilidad para la venta.</p>
        </Card>

        <Card className="xl:col-span-2">
          <h2 className="font-bold text-marino dark:text-white">1 · Factura recibida de Crosland</h2>
          {tieneFactura ? (
            f ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-marino px-5 py-3 text-white">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-white/70">Factura electrónica</span>
                  <span className="font-mono text-[15px] font-bold">{f.numero}</span>
                </div>
                <dl className="grid gap-x-6 gap-y-3 p-5 text-[13.5px] sm:grid-cols-2">
                  <div><dt className="text-slate-400">Emisor</dt><dd className="font-semibold text-marino dark:text-white">{f.emisor}</dd></div>
                  <div><dt className="text-slate-400">Fecha de emisión</dt><dd className="font-semibold text-marino dark:text-white">{f.fecha_emision}</dd></div>
                  <div><dt className="text-slate-400">Motos declaradas</dt><dd className="font-semibold text-marino dark:text-white">{f.cantidad_motos} {f.cantidad_motos === compra.cancom ? <span className="text-emerald-600">· coincide con la compra</span> : <span className="text-acento">· no coincide ({compra.cancom})</span>}</dd></div>
                  <div><dt className="text-slate-400">Archivo PDF</dt><dd className="text-slate-500">{f.archivo_adjuntado ? "Adjuntado" : "Pendiente: el backend aún no define el almacenamiento privado del archivo"}</dd></div>
                </dl>
              </div>
            ) : <p className="mt-2 text-[14px] text-emerald-700">✓ Factura registrada.</p>
          ) : gestiona ? (
            <form onSubmit={guardarFactura} className="mt-3 grid gap-4 sm:grid-cols-2" noValidate>
              <Campo etiqueta="Emisor (tal como figura en la factura)" error={ferr.emisor}><input className="field-input" maxLength={170} value={fac.emisor} onChange={(e) => setFac({ ...fac, emisor: e.target.value })} /></Campo>
              <Campo etiqueta="N° de factura" error={ferr.numero}><input className="field-input" maxLength={90} value={fac.numero} onChange={(e) => setFac({ ...fac, numero: e.target.value })} placeholder="F001-000123" /></Campo>
              <Campo etiqueta="Fecha de emisión" error={ferr.fecha_emision}><input type="date" max={hoyISO()} className="field-input" value={fac.fecha_emision} onChange={(e) => setFac({ ...fac, fecha_emision: e.target.value })} /></Campo>
              <Campo etiqueta="Cantidad de motos en la factura" error={ferr.cantidad_motos} ayuda={`La compra es de ${compra.cancom} motos. No cuentes aceites ni bonificaciones.`}><input className="field-input" inputMode="numeric" value={fac.cantidad_motos} onChange={(e) => setFac({ ...fac, cantidad_motos: e.target.value.replace(/\D/g, "") })} /></Campo>
              <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
                <button className="btn btn-primary !py-2.5">Registrar factura</button>
                <button type="button" disabled title="Pendiente en el backend (HU-002)" className="btn btn-secondary !py-2.5 opacity-50">Adjuntar PDF</button>
                <span className="text-[12px] text-slate-400">El archivo se podrá adjuntar cuando el backend habilite el almacenamiento privado.</span>
              </div>
            </form>
          ) : <p className="mt-2 text-[14px] text-slate-500">Aún sin factura registrada. Solo gerente y administradora la registran.</p>}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="font-bold text-marino dark:text-white">2 · Identificar unidades (motor y chasis)</h2>
        {completa ? <p className="mt-2 text-[14px] text-emerald-700">✓ Todas las unidades de esta compra están identificadas. Continúa con la recepción en Inventario.</p>
          : !tieneFactura ? <p className="mt-2 text-[14px] text-slate-500">Registra primero la factura para identificar unidades.</p>
          : bloqueada ? <div className="mt-3"><Aviso tipo="error">La cantidad de la factura no coincide con la compra. La identificación queda bloqueada hasta que la gerencia revise el dato (HU-002, error PT411).</Aviso></div>
          : !gestiona ? <p className="mt-2 text-[14px] text-slate-500">Solo gerente y administradora identifican unidades.</p> : (
          <form onSubmit={identificar} className="mt-3" noValidate>
            <p className="mb-3 text-[13.5px] text-slate-500">Faltan <b>{compra.cantidad_pendiente}</b> unidades. Modelo (<b>{compra.nommod}</b>) y color (<b>{compra.colcom}</b>) se toman de la compra. Lotes de 1 a 100; las series se guardan en mayúsculas.</p>
            <div className="space-y-2">
              {filas.map((r, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-[2rem_1fr_1fr_auto] sm:items-start">
                  <span className="hidden pt-3 text-center text-[12px] font-semibold text-slate-400 sm:block">{i + 1}</span>
                  <div><input className="field-input uppercase" placeholder="N° de motor" value={r.nummotuni} onChange={(e) => setFila(i, "nummotuni", e.target.value)} aria-label={`Motor ${i + 1}`} />{uerr[`m${i}`] && <p className="mt-1 text-[12px] font-medium text-acento">{uerr[`m${i}`]}</p>}</div>
                  <div><input className="field-input uppercase" placeholder="N° de chasis" value={r.chauni} onChange={(e) => setFila(i, "chauni", e.target.value)} aria-label={`Chasis ${i + 1}`} />{uerr[`c${i}`] && <p className="mt-1 text-[12px] font-medium text-acento">{uerr[`c${i}`]}</p>}</div>
                  <button type="button" className="h-11 rounded-lg border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/10" aria-label="Quitar fila" onClick={() => setFilas((p) => (p.length > 1 ? p.filter((_, j) => j !== i) : p))}>✕</button>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary !py-2" disabled={filas.length >= Math.min(100, compra.cantidad_pendiente)} onClick={() => setFilas([...filas, FILA()])}>+ Agregar fila</button>
            </div>
            <details className="mt-3 text-[13px]"><summary className="cursor-pointer font-semibold text-marino-700 dark:text-white/80">Pegar varias unidades desde Excel</summary>
              <textarea className="field-input mt-2 font-mono" rows={4} placeholder={"MOTOR1, CHASIS1\nMOTOR2, CHASIS2"} value={lote} onChange={(e) => setLote(e.target.value)} />
              <button type="button" className="btn btn-secondary mt-2 !py-2" onClick={cargarLote}>Cargar al formulario</button></details>
            {uerr.general && <div className="mt-3"><Aviso tipo="error">{uerr.general}</Aviso></div>}
            {conflicto && (
              <div className="mt-3"><Aviso tipo="error">
                {conflicto.texto}
                {conflicto.detalle?.unidad && <span className="mt-1 block text-[12.5px]">Ya existe la ficha #{conflicto.detalle.unidad.coduni} (compra #{conflicto.detalle.unidad.codcom}) con {conflicto.detalle.campo === "chauni" ? "chasis" : "motor"} <b>{conflicto.detalle.campo === "chauni" ? conflicto.detalle.unidad.chauni : conflicto.detalle.unidad.nummotuni}</b>. No se modificó.</span>}
              </Aviso></div>
            )}
            <button className="btn btn-primary mt-4" disabled={enviando}>{enviando ? "Identificando…" : `Identificar ${filas.length} unidad(es)`}</button>
          </form>
        )}
        {det.unidades.length > 0 && (
          <div className="mt-6"><h3 className="mb-2 text-[14px] font-semibold text-marino dark:text-white">Unidades ya identificadas ({det.unidades.length})</h3>
            <Tabla columnas={["#", "N° de motor", "N° de chasis", "Color", "Fecha"]}>{det.unidades.map((u, i) => <tr key={u.coduni || u.nummotuni}><td className="px-4 py-2 text-slate-400">{i + 1}</td><td className="px-4 py-2 font-mono">{u.nummotuni}</td><td className="px-4 py-2 font-mono">{u.chauni}</td><td className="px-4 py-2">{u.coluni || compra.colcom}</td><td className="px-4 py-2 text-slate-500">{String(u.fecreguni || "").slice(0, 10)}</td></tr>)}</Tabla></div>
        )}
      </Card>
    </div>
  );
}
