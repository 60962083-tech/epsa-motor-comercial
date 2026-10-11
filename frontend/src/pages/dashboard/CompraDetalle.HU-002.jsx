// HU-002 · Factura e identificación de unidades
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, Campo, Card, PageHeader, Tabla, useConfirm, useToast } from "../../components/ui";
import { Progreso } from "../../components/charts";
import { ESTADO_COMPRA } from "./Compras.HU-034";
import { adjuntoRecordado, buscarPdfFactura, recordarAdjunto, subirPdfFactura, urlPdfFactura, validarPdf, validarPdfContenido } from "../../lib/archivos";
import { soloDigitos } from "../../lib/validar";
import { claveModelo } from "../../lib/modelos";

const FILA = () => ({ nummotuni: "", chauni: "" });
const norm = (t) => String(t || "").trim().replace(/\s+/g, " ");
const serie = (t) => norm(t).toUpperCase();
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const fechaMinimaFactura = (feccom) => { const d = new Date(`${String(feccom || hoyISO()).slice(0, 10)}T12:00:00`); d.setFullYear(d.getFullYear() - 1); return d.toLocaleDateString("en-CA"); };

export default function CompraDetalle() {
  const { id } = useParams();
  const { compras, modelos, publicos, unidades: inv, actualizar, agregar } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const gestiona = puede("compras.factura");
  const [compra, setCompra] = useState(null);
  const [det, setDet] = useState({ factura: null, unidades: [], requiere_revision: false });
  const [cargando, setCargando] = useState(true); const [errorCarga, setErrorCarga] = useState("");
  const [fac, setFac] = useState({ emisor: "Crosland Perú S.A.C.", numero: "", fecha_emision: "", cantidad_motos: "" }); const [ferr, setFerr] = useState({});
  const guardandoFactura = useRef(false); const [enviandoFactura, setEnviandoFactura] = useState(false);
  const [filas, setFilas] = useState([FILA()]); const [uerr, setUerr] = useState({}); const [conflicto, setConflicto] = useState(null);
  const [lote, setLote] = useState(""); const [enviando, setEnviando] = useState(false);
  const [pdf, setPdf] = useState(null); const [pdfErr, setPdfErr] = useState(""); const [subiendo, setSubiendo] = useState(false);
  const inputPdf = useRef(null); const inputPdf2 = useRef(null);
  const [adjReal, setAdjReal] = useState(null);

  // Cargar la compra
  async function cargar() {
    setCargando(true); setErrorCarga("");
    try {
      if (MODO_REAL) {
        const c = (await api.obtenerCompra(id)).data;
        setCompra(c);
        if (gestiona) {
          try {
            const d = (await api.listarUnidadesCompra(id)).data;
            setDet({ factura: d?.factura || null, unidades: d?.unidades || [], requiere_revision: !!(d?.factura && d.factura.cantidad_motos !== d.cantidad_comprada) });
            setCompra({ ...c, cantidad_pendiente: d?.cantidad_pendiente ?? c.cantidad_pendiente, estcom: d?.estcom || c.estcom });
          } catch (e) { toast(`La compra cargó, pero no su detalle de factura y unidades: ${mensajeError(e)}`, "error"); }
          setAdjReal(await buscarPdfFactura(c.codcom));
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
  const modeloLocal = modelos.find((m) => claveModelo(m.nombre) === claveModelo(compra.nommod))
    || (MODO_REAL ? publicos.find((m) => m.codmodApi === String(compra.codmod)) : modelos.find((m) => m.codmod === compra.codmod)) || null;
  const faltanEnInventario = MODO_REAL ? det.unidades.filter((u) => !inv.some((v) => serie(v.motor) === serie(u.nummotuni))) : [];
  function pasarAlInventario(lista) {
    const base = inv.reduce((m, u) => Math.max(m, Number(String(u.id).replace(/\D/g, "")) || 0), 0);
    lista.forEach((r, i) => agregar("unidades", { id: `MC-${String(base + i + 1).padStart(3, "0")}`, coduni: r.coduni, codcom: String(compra.codcom), modelo: modeloLocal?.id || "", nombreModelo: compra.nommod, color: r.coluni || compra.colcom, ubicacion: "", preparacion: "Sin preparar", techo: "Sin techo", disponibilidad: "No disponible", motor: r.nummotuni, chasis: r.chauni, observaciones: [], historial: [{ fecha: hoyISO(), detalle: `Identificada en compra #${compra.codcom} · ${user.nombre}` }] }));
  }

  const adjunto = MODO_REAL ? adjReal : (det.factura?.adjunto || adjuntoRecordado(compra.codcom));

  // PDF de la factura
  async function elegirPdf(e) {
    const a = e.target.files?.[0]; e.target.value = "";
    if (!a) return null;
    const m = validarPdf(a) || await validarPdfContenido(a); setPdfErr(m);
    setPdf(m ? null : a);
    return m ? null : a;
  }
  async function subirPdf(archivo) {
    const adj = await subirPdfFactura(compra.codcom, archivo);
    if (MODO_REAL) { setAdjReal(adj); return adj; }
    recordarAdjunto(compra.codcom, adj);
    const actual = compras.find((x) => x.codcom === compra.codcom);
    actualizar("compras", compra.id, { factura: { ...actual?.factura, archivo_adjuntado: true, adjunto: adj } }, `PDF de factura adjuntado (compra #${compra.codcom})`);
    return adj;
  }
  async function adjuntarDespues(e) {
    const a = await elegirPdf(e); if (!a) return;
    setSubiendo(true);
    try { await subirPdf(a); setPdf(null); toast("PDF de la factura adjuntado"); cargar(); }
    catch (er) { setPdfErr(mensajeError(er)); toast(mensajeError(er), "error"); }
    finally { setSubiendo(false); }
  }
  async function abrirPdf(descargar) {
    const ventana = descargar ? null : window.open("", "_blank");
    try {
      const nombre = `factura-compra-${compra.codcom}.pdf`;
      let url = await urlPdfFactura(adjunto);
      if (descargar && /^https?:/i.test(url)) url += `${url.includes("?") ? "&" : "?"}download=${encodeURIComponent(nombre)}`;
      if (descargar) { const a = document.createElement("a"); a.href = url; a.download = nombre; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove(); }
      else if (ventana) ventana.location.href = url; else window.open(url, "_blank");
    } catch (er) { ventana?.close(); toast(mensajeError(er), "error"); }
  }

  // Registrar la factura (PUT /api/compras/:id/factura)
  async function guardarFactura(e) {
    e.preventDefault(); const x = {};
    const cuerpo = { emisor: norm(fac.emisor), numero: norm(fac.numero), fecha_emision: fac.fecha_emision, cantidad_motos: Number(fac.cantidad_motos) };
    if (!cuerpo.emisor) x.emisor = "Copia el emisor tal como aparece en la factura."; else if (cuerpo.emisor.length > 160) x.emisor = "Máximo 160 caracteres.";
    if (!cuerpo.numero) x.numero = "Copia el número de la factura tal como figura en el documento."; else if (cuerpo.numero.length > 80) x.numero = "Máximo 80 caracteres.";
    else if (cuerpo.numero.length < 4 || !/\d/.test(cuerpo.numero) || !/^[\p{L}\d][\p{L}\d ./-]*$/u.test(cuerpo.numero)) x.numero = "Revisa el número: debe tener serie y correlativo, por ejemplo F001-000123.";
    else if (!MODO_REAL && compras.some((c) => c.codcom !== compra.codcom && c.factura && norm(c.factura.numero).toLowerCase() === cuerpo.numero.toLowerCase() && norm(c.factura.emisor).toLowerCase() === cuerpo.emisor.toLowerCase())) x.numero = "Esta factura ya está registrada en otra compra.";
    const minimo = fechaMinimaFactura(compra.feccom);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cuerpo.fecha_emision)) x.fecha_emision = "Indica la fecha de emisión."; else if (cuerpo.fecha_emision > hoyISO()) x.fecha_emision = "La fecha de emisión no puede ser futura.";
    else if (cuerpo.fecha_emision < minimo) x.fecha_emision = `La fecha es muy anterior a la compra: debe ser desde el ${minimo}.`;
    if (!Number.isInteger(cuerpo.cantidad_motos) || cuerpo.cantidad_motos < 1) x.cantidad_motos = "Cantidad entera mayor a 0.";
    setFerr(x); if (Object.keys(x).length) return;
    const difiere = cuerpo.cantidad_motos !== compra.cancom;
    const ok = await confirmar(difiere
      ? { titulo: "La cantidad no coincide", texto: `La factura declara ${cuerpo.cantidad_motos} motos y la compra es de ${compra.cancom}. Se registrará el documento, pero la identificación quedará bloqueada hasta que la gerencia revise el dato . ¿Registrar igual?`, boton: "Registrar con revisión", peligro: true }
      : { titulo: "Registrar factura", texto: `Factura ${cuerpo.numero} de ${cuerpo.emisor}, emitida el ${cuerpo.fecha_emision}, por ${cuerpo.cantidad_motos} motos. Una vez registrada no se puede sobrescribir.`, boton: "Registrar factura" });
    if (!ok || guardandoFactura.current) return;
    guardandoFactura.current = true; setEnviandoFactura(true);
    try {
      let adj = null;
      if (MODO_REAL) {
        const r = await api.registrarFactura(id, cuerpo);
        if (pdf) adj = await subirPdf(pdf).catch((er) => { toast(`Factura registrada, pero el PDF no se subió: ${mensajeError(er)}`, "error"); return null; });
        toast(r.data?.requiere_revision ? (r.message || "Factura registrada con discrepancia: requiere revisión.") : "Factura registrada. La compra pasa a «Pendiente de identificación».", r.data?.requiere_revision ? "error" : "ok");
      } else {
        if (pdf) { adj = await subirPdfFactura(compra.codcom, pdf); recordarAdjunto(compra.codcom, adj); }
        actualizar("compras", compra.id, { estcom: "Pendiente de identificación", factura: { codfac: String(Date.now()).slice(-5), ...cuerpo, archivo_adjuntado: !!adj, adjunto: adj, requiere_revision: difiere } }, `Factura ${cuerpo.numero} registrada (compra #${id})${adj ? " con PDF" : ""}`);
        toast(difiere ? "Factura registrada con discrepancia: la identificación queda bloqueada." : "Factura registrada. La compra pasa a «Pendiente de identificación».", difiere ? "error" : "ok");
      }
      setPdf(null); cargar();
    } catch (er) { toast(mensajeError(er), "error"); }
    finally { guardandoFactura.current = false; setEnviandoFactura(false); }
  }

  const setFila = (i, k, v) => setFilas((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  // Identificar motor y chasis (POST /api/compras/:id/unidades)
  function cargarLote() {
    const todas = lote.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => { const [a, b] = l.split(/[,;\t]+/); return { nummotuni: (a || "").trim(), chauni: (b || "").trim() }; });
    const rows = todas.filter((r) => /\d/.test(`${r.nummotuni}${r.chauni}`));
    if (!rows.length) return toast("Pega una línea por moto: MOTOR, CHASIS", "error");
    const max = Math.min(100, compra.cantidad_pendiente);
    setFilas(rows.slice(0, max)); setLote("");
    const omitidas = todas.length - rows.length;
    toast(`${rows.length > max ? `Se cargaron ${max} filas (faltan ${compra.cantidad_pendiente} por identificar).` : `${rows.length} filas cargadas`}${omitidas ? ` Se omitió ${omitidas} línea(s) sin números (encabezado).` : ""}`);
  }

  async function identificar(e) {
    e.preventDefault(); setConflicto(null); const x = {};
    const rows = filas.map((r) => ({ nummotuni: serie(r.nummotuni), chauni: serie(r.chauni) }));
    if (rows.length > compra.cantidad_pendiente) x.general = `Solo faltan ${compra.cantidad_pendiente} unidades por identificar.`;
    const formato = (v) => v.length >= 5 && /\d/.test(v) && /^[A-Z0-9][A-Z0-9 ./-]*$/.test(v);
    rows.forEach((r, i) => {
      if (!r.nummotuni) x[`m${i}`] = "Ingresa el número de motor."; else if (r.nummotuni.length > 100) x[`m${i}`] = "Máximo 100 caracteres.";
      else if (!formato(r.nummotuni)) x[`m${i}`] = "Revisa el número de motor: letras y números, mínimo 5 y con al menos un número.";
      if (!r.chauni) x[`c${i}`] = "Ingresa el número de chasis."; else if (r.chauni.length > 100) x[`c${i}`] = "Máximo 100 caracteres.";
      else if (!formato(r.chauni)) x[`c${i}`] = "Revisa el número de chasis: letras y números, mínimo 5 y con al menos un número.";
      if (r.nummotuni && r.nummotuni === r.chauni) x[`c${i}`] = "El chasis no puede ser igual al motor.";
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
      if (MODO_REAL) {
        const r = await api.vincularUnidades(id, cuerpo);
        const nuevas = (r.data?.unidades || []).filter((u) => cuerpo.some((c) => c.nummotuni === serie(u.nummotuni)));
        pasarAlInventario(nuevas.length ? nuevas : cuerpo.map((c) => ({ ...c, coduni: "" })));
      } else {
        const base = inv.reduce((m, u) => Math.max(m, Number(String(u.id).replace(/\D/g, "")) || 0), 0);
        cuerpo.forEach((r, i) => agregar("unidades", { id: `MC-${String(base + i + 1).padStart(3, "0")}`, codcom: id, modelo: modeloLocal?.id || "", nombreModelo: compra.nommod, color: compra.colcom, ubicacion: "", preparacion: "Sin preparar", techo: "Sin techo", disponibilidad: "No disponible", motor: r.nummotuni, chasis: r.chauni, historial: [{ fecha: hoyISO(), detalle: `Identificada en compra #${id} · ${user.nombre}` }] }));
        const nuevas = [...(compra.unidades || []), ...cuerpo.map((r) => ({ ...r, fecreguni: hoyISO() }))];
        const pend = compra.cancom - nuevas.length;
        actualizar("compras", compra.id, { unidades: nuevas, cantidad_pendiente: pend, estcom: pend === 0 ? "Identificada" : "Pendiente de identificación" }, `${cuerpo.length} unidades identificadas (compra #${id})`);
      }
      toast(`${cuerpo.length} unidad(es) identificada(s). Siguiente paso: recíbelas y libéralas en Inventario para que la web muestre stock.`); setFilas([FILA()]); cargar();
    } catch (er) {
      setConflicto({ texto: er.detalle?.conflicto ? er.message : mensajeError(er), detalle: er.detalle?.conflicto || null });
      toast(mensajeError(er), "error");
    } finally { setEnviando(false); }
  }

  const f = det.factura;
  return (
    <div>
      <PageHeader titulo={`Compra #${compra.codcom} · ${compra.nommod}`} subtitulo={`${compra.colcom} · ${compra.cancom} motos · registrada el ${compra.feccom} a las ${String(compra.horcom).slice(0, 5)}`}>
        <Link to="/admin/compras" className="btn btn-secondary !py-2.5">← Compras</Link>
        {hechas > 0 && <Link to="/admin/inventario" className="btn btn-secondary !py-2.5">Ver en inventario</Link>}
      </PageHeader>

      <ol className="mb-6 grid gap-3 sm:grid-cols-3">
        {[["Compra registrada", `${compra.feccom}`, true], ["Factura recibida", tieneFactura ? (adjunto ? "Con PDF adjunto" : "Falta adjuntar el PDF") : "Pendiente", tieneFactura], ["Unidades identificadas", `${hechas} de ${compra.cancom}`, completa]].map(([t, hu, ok], i) => (
          <li key={t} className={`flex items-center gap-3 rounded-xl2 border p-4 ${ok ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#121a2b]"}`}>
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[14px] font-bold ${ok ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500 dark:bg-white/10"}`}>{ok ? "✓" : i + 1}</span>
            <div><p className="font-semibold text-marino dark:text-white">{t}</p><p className="text-[12px] text-slate-400">{hu}</p></div>
          </li>
        ))}
      </ol>

      {/* Avance y factura */}
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
                  <div><dt className="text-slate-400">Archivo PDF</dt><dd data-pdf={adjunto ? "si" : "no"}>
                    {adjunto ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-300"><IconoPdf />{adjunto.nombre}</span>
                        <button type="button" className="btn btn-secondary !px-3 !py-1.5 !text-[12.5px]" onClick={() => abrirPdf(false)}>Ver</button>
                        <button type="button" className="btn btn-secondary !px-3 !py-1.5 !text-[12.5px]" onClick={() => abrirPdf(true)}>Descargar</button>
                      </div>
                    ) : gestiona ? (
                      <>
                        <input ref={inputPdf2} type="file" accept="application/pdf,.pdf" className="hidden" onChange={adjuntarDespues} />
                        <button type="button" id="btn-adjuntar-despues" disabled={subiendo} className="btn btn-acento !px-3 !py-1.5 !text-[12.5px]" onClick={() => inputPdf2.current?.click()}>{subiendo ? "Subiendo…" : "Adjuntar PDF"}</button>
                        {pdfErr && <p className="mt-1 text-[12px] font-medium text-acento">{pdfErr}</p>}
                      </>
                    ) : <span className="text-slate-500">Sin PDF adjunto</span>}
                  </dd></div>
                </dl>
              </div>
            ) : <p className="mt-2 text-[14px] text-emerald-700">✓ Factura registrada.</p>
          ) : gestiona ? (
            <form onSubmit={guardarFactura} className="mt-3 grid gap-4 sm:grid-cols-2" noValidate>
              <Campo etiqueta="Emisor (tal como figura en la factura)" error={ferr.emisor}><input className="field-input" maxLength={170} value={fac.emisor} onChange={(e) => setFac({ ...fac, emisor: e.target.value })} /></Campo>
              <Campo etiqueta="N° de factura" error={ferr.numero}><input id="fac-numero" className="field-input" maxLength={90} value={fac.numero} onChange={(e) => setFac({ ...fac, numero: e.target.value })} placeholder="F001-000123" /></Campo>
              <Campo etiqueta="Fecha de emisión" error={ferr.fecha_emision}><input type="date" min={fechaMinimaFactura(compra.feccom)} max={hoyISO()} className="field-input" value={fac.fecha_emision} onChange={(e) => setFac({ ...fac, fecha_emision: e.target.value })} /></Campo>
              <Campo etiqueta="Cantidad de motos en la factura" error={ferr.cantidad_motos} ayuda={`La compra es de ${compra.cancom} motos. No cuentes aceites ni bonificaciones.`}><input id="fac-cantidad" className="field-input" inputMode="numeric" maxLength={4} value={fac.cantidad_motos} onChange={(e) => setFac({ ...fac, cantidad_motos: soloDigitos(e.target.value, 4).replace(/^0+/, "") })} /></Campo>
              <div className="sm:col-span-2">
                <span className="field-label">PDF de la factura</span>
                <input ref={inputPdf} id="fac-pdf" type="file" accept="application/pdf,.pdf" className="hidden" onChange={elegirPdf} />
                {pdf ? (
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13.5px] dark:border-emerald-500/30 dark:bg-emerald-500/10">
                    <IconoPdf /><span className="min-w-0 flex-1 truncate font-semibold text-emerald-800 dark:text-emerald-200" data-pdf-elegido>{pdf.name}</span>
                    <span className="text-[12px] text-slate-500">{(pdf.size / 1024).toFixed(0)} KB</span>
                    <button type="button" className="text-[13px] font-semibold text-acento hover:underline" onClick={() => setPdf(null)}>Quitar</button>
                  </div>
                ) : (
                  <button type="button" id="btn-adjuntar-pdf" onClick={() => inputPdf.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-4 text-[14px] font-semibold text-marino-700 transition hover:border-marino-700 hover:bg-marino-50 dark:border-white/20 dark:text-white/80 dark:hover:bg-white/5">
                    <IconoPdf /> Adjuntar PDF <span className="font-normal text-slate-400">(solo PDF, máx. 10 MB)</span>
                  </button>
                )}
                {pdfErr && <p className="mt-1 text-[12px] font-medium text-acento">{pdfErr}</p>}
              </div>
              <div className="sm:col-span-2"><button className="btn btn-primary !py-2.5" disabled={enviandoFactura}>{enviandoFactura ? "Registrando…" : `Registrar factura${pdf ? " con PDF" : ""}`}</button></div>
            </form>
          ) : <p className="mt-2 text-[14px] text-slate-500">Aún sin factura registrada. Solo gerente y administradora la registran.</p>}
        </Card>
      </div>

      {/* Identificación de unidades */}
      <Card className="mt-6">
        <h2 className="font-bold text-marino dark:text-white">2 · Identificar unidades (motor y chasis)</h2>
        {completa ? <p className="mt-2 text-[14px] text-emerald-700">✓ Todas las unidades de esta compra están identificadas. Continúa en Inventario: recíbelas y libéralas para que la web muestre stock.</p>
          : !tieneFactura ? <p className="mt-2 text-[14px] text-slate-500">Registra primero la factura para identificar unidades.</p>
          : bloqueada ? <div className="mt-3"><Aviso tipo="error">La cantidad de la factura no coincide con la compra. La identificación queda bloqueada hasta que la gerencia revise el dato.</Aviso></div>
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
        {faltanEnInventario.length > 0 && gestiona && (
          <div className="mt-4"><Aviso tipo="aviso">{faltanEnInventario.length} unidad(es) de esta compra aún no están en el inventario del panel. <button type="button" className="font-semibold underline" onClick={() => { pasarAlInventario(faltanEnInventario); toast("Unidades agregadas al inventario"); }}>Agregarlas al inventario</button></Aviso></div>
        )}
        {det.unidades.length > 0 && (
          <div className="mt-6"><h3 className="mb-2 text-[14px] font-semibold text-marino dark:text-white">Unidades ya identificadas ({det.unidades.length})</h3>
            <Tabla columnas={["#", "N° de motor", "N° de chasis", "Color", "Fecha"]}>{det.unidades.map((u, i) => <tr key={u.coduni || u.nummotuni}><td className="px-4 py-2 text-slate-400">{i + 1}</td><td className="px-4 py-2 font-mono">{u.nummotuni}</td><td className="px-4 py-2 font-mono">{u.chauni}</td><td className="px-4 py-2">{u.coluni || compra.colcom}</td><td className="px-4 py-2 text-slate-500">{String(u.fecreguni || "").slice(0, 10)}</td></tr>)}</Tabla></div>
        )}
      </Card>
    </div>
  );
}

function IconoPdf() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 14h6M9 17h4" /></svg>;
}
