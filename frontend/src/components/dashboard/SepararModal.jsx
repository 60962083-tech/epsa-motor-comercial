// HU-005 · Asistente para separar una moto con adelanto confirmado
import { useEffect, useMemo, useState } from "react";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { ADELANTO_MINIMO, COLORES, DIAS_SEPARACION, MEDIOS_CON_OPERACION, MEDIOS_PAGO, formatoSoles } from "../../data/mockData";
import { useSeparaciones, limpiarOperacion, venceDe } from "../../servicios/separaciones";
import { useMovimientos } from "../../servicios/movimientos";
import { DOCUMENTOS, fechaLarga, hoyLocal, soloDigitos, soloLetrasNombre, soloMonto, sumarDias } from "../../lib/validar";
import { pesoLegible } from "../../lib/archivos";
import { nombreCliente } from "../../lib/sprint2";
import ModeloImg from "../ModeloImg";
import { Aviso, Campo, Modal, useToast } from "../ui";
import { ColorPunto } from "./Sprint2";
import { nombreModeloDe } from "./MovimientoModales";

const PASOS = ["Moto", "Cliente", "Adelanto", "Confirmar"];
const CLIENTE_VACIO = { tipoDoc: "DNI", doc: "", nombres: "", apellidoPaterno: "", apellidoMaterno: "", razonSocial: "", celular: "", correo: "" };

// Vista previa del voucher elegido
function VistaVoucher({ archivo, onQuitar }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!archivo || !archivo.type.startsWith("image/")) { setUrl(""); return undefined; }
    const u = URL.createObjectURL(archivo); setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-2.5 dark:border-white/10">
      {url ? <img src={url} alt="Voucher elegido" className="h-14 w-14 rounded-lg object-cover" /> : <span className="grid h-14 w-14 place-items-center rounded-lg bg-red-50 text-[12px] font-bold text-acento dark:bg-red-500/10">PDF</span>}
      <div className="min-w-0 flex-1"><p className="truncate text-[13.5px] font-semibold text-marino dark:text-white">{archivo.name}</p><p className="text-[12px] text-slate-500">{pesoLegible(archivo.size)}</p></div>
      <button type="button" className="text-[13px] font-semibold text-acento hover:underline" onClick={onQuitar}>Quitar</button>
    </div>
  );
}

export default function SepararModal({ abierto, unidad: inicial, onClose, onHecho }) {
  const { unidades, modelos, publicos, ubicaciones, equipo = [] } = useApp();
  const { user } = useAuth();
  const sep = useSeparaciones();
  const { transitoDe } = useMovimientos();
  const toast = useToast();
  const vendedores = equipo.filter((p) => p.rol === "vendedor" && p.activo);
  const [paso, setPaso] = useState(1);
  const [filtro, setFiltro] = useState({ modelo: "", color: "", sede: "" });
  const [unidadId, setUnidadId] = useState("");
  const [c, setC] = useState(CLIENTE_VACIO);
  const [a, setA] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [err, setErr] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    setPaso(inicial ? 2 : 1); setUnidadId(inicial?.id || ""); setFiltro({ modelo: "", color: "", sede: "" });
    setC(CLIENTE_VACIO); setConfirmado(false); setErr({}); setGuardando(false);
    setA({ monto: "", medio: "Transferencia", operacion: "", fechaPago: hoyLocal(), archivo: null, vendedor: user.rol === "vendedor" ? user.nombre : vendedores[0]?.nombre || user.nombre, obs: "" });
  }, [abierto, inicial?.id]); // eslint-disable-line

  const libres = useMemo(() => unidades.filter((u) => u.disponibilidad === "Disponible" && !sep.activaDe(u.id)), [unidades, sep]);
  const visibles = libres.filter((u) => (!filtro.modelo || u.modelo === filtro.modelo) && (!filtro.color || u.color === filtro.color) && (!filtro.sede || u.ubicacion === filtro.sede));
  const u = unidades.find((x) => x.id === unidadId);
  const modeloDe = (x) => modelos.find((m) => m.id === x?.modelo) || publicos.find((m) => m.id === x?.modelo);
  const precio = sep.precioDe(u);
  const existente = c.doc.length === DOCUMENTOS[c.tipoDoc] ? sep.buscarCliente(c.tipoDoc, c.doc) : null;
  const vence = a.fechaPago ? venceDe(a.fechaPago) : "";
  const conOperacion = MEDIOS_CON_OPERACION.includes(a.medio);
  const limpiarError = (...k) => setErr((e) => (k.some((x) => e[x]) ? Object.fromEntries(Object.entries(e).filter(([x]) => !k.includes(x))) : e));
  const setCli = (k, v) => { setC((p) => ({ ...p, [k]: v })); limpiarError(k, "general"); };
  const setAd = (k, v) => { setA((p) => ({ ...p, [k]: v })); limpiarError(k, k === "medio" ? "operacion" : "", k === "medio" ? "archivo" : "", "general"); };

  // Al encontrar al cliente, traer su celular y correo
  useEffect(() => { if (existente) setC((p) => ({ ...p, celular: p.celular || existente.celular || "", correo: p.correo || existente.correo || "" })); }, [existente?.id]); // eslint-disable-line

  function validarPaso(n = paso) {
    let x = {};
    if (n === 1) { const e = sep.validarMoto(u); if (e) x.unidad = e; }
    if (n === 2) x = sep.validarCliente(c);
    if (n === 3) x = sep.validarAdelanto(a, u);
    if (n === 4 && !confirmado) x.confirmado = "Confirma que verificaste el adelanto.";
    setErr(x);
    return Object.keys(x).length === 0;
  }
  const siguiente = () => { if (validarPaso()) { setErr({}); setPaso(paso + 1); } };
  async function separar() {
    for (const n of [1, 2, 3, 4]) if (!validarPaso(n)) { setPaso(n); return; }
    setGuardando(true);
    try {
      const nueva = await sep.crear({ unidad: u, cliente: c, adelanto: a });
      toast(`${nueva.numero}: ${u.id} separada hasta el ${nueva.vence}.`);
      onHecho?.(nueva); onClose();
    } catch (e) { setErr({ general: e.message || "No se pudo guardar la separación." }); }
    finally { setGuardando(false); }
  }
  function elegirArchivo(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) setAd("archivo", f);
  }

  const sedes = ubicaciones.filter((x) => x.activo && x.tipo !== "Proveedor de techo");
  const cliNombre = existente ? nombreCliente(existente) : c.tipoDoc === "RUC" ? c.razonSocial : [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(" ");

  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Separar moto" ancho="max-w-3xl" confirmarGuardar={false}
      pie={<>
        {paso > 1 && <button className="btn btn-secondary !py-2" onClick={() => { setErr({}); setPaso(paso - 1); }}>Atrás</button>}
        {paso < 4 ? <button id="sep-siguiente" className="btn btn-primary !py-2" onClick={siguiente}>Siguiente</button>
          : <button id="sep-confirmar" className="btn btn-acento !py-2" disabled={guardando} onClick={separar}>{guardando ? "Guardando…" : "Separar moto"}</button>}
      </>}>
      {/* Pasos */}
      <ol className="mb-5 grid grid-cols-4 gap-2 text-[12.5px]" aria-label="Pasos para separar">
        {PASOS.map((p, i) => (
          <li key={p} aria-current={paso === i + 1 ? "step" : undefined} className={`rounded-lg px-2 py-2 text-center font-semibold ${paso === i + 1 ? "bg-marino text-white" : paso > i + 1 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-white/10"}`}>{i + 1}. {p}</li>
        ))}
      </ol>
      {err.general && <div className="mb-4"><Aviso tipo="error">{err.general}</Aviso></div>}

      {/* 1. Moto */}
      {paso === 1 && (
        <div className="space-y-4" data-paso="moto">
          <div className="grid gap-3 sm:grid-cols-3">
            <select aria-label="Modelo" className="field-input" value={filtro.modelo} onChange={(e) => setFiltro({ ...filtro, modelo: e.target.value })}><option value="">Todos los modelos</option>{[...new Set(libres.map((x) => x.modelo))].map((id) => <option key={id} value={id}>{nombreModeloDe({ modelo: id }, modelos, publicos)}</option>)}</select>
            <select aria-label="Color" className="field-input" value={filtro.color} onChange={(e) => setFiltro({ ...filtro, color: e.target.value })}><option value="">Todos los colores</option>{COLORES.map((x) => <option key={x}>{x}</option>)}</select>
            <select aria-label="Sede" className="field-input" value={filtro.sede} onChange={(e) => setFiltro({ ...filtro, sede: e.target.value })}><option value="">Todas las sedes</option>{sedes.map((x) => <option key={x.id}>{x.nombre}</option>)}</select>
          </div>
          {err.unidad && <p className="text-[12.5px] font-medium text-acento">{err.unidad}</p>}
          {visibles.length === 0 ? <p className="rounded-xl border-2 border-dashed border-slate-200 py-8 text-center text-[13.5px] text-slate-500 dark:border-white/10">No hay motos disponibles con esos filtros.</p> : (
            <div className="grid max-h-[46vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Motos disponibles">
              {visibles.map((x) => {
                const m = modeloDe(x); const t = transitoDe(x.id);
                return (
                  <label key={x.id} onClick={() => limpiarError("unidad")} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-2.5 transition ${unidadId === x.id ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`} data-elegir={x.id}>
                    <input type="radio" name="sep-unidad" className="sr-only" checked={unidadId === x.id} onChange={() => setUnidadId(x.id)} />
                    <span className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg bg-escenario dark:bg-escenario-oscuro">{m && <ModeloImg modelo={m} color={x.color} className="h-full w-full object-contain p-1" />}</span>
                    <span className="min-w-0">
                      <span className="block font-bold text-marino dark:text-white">{x.id} <span className="font-semibold text-slate-500 dark:text-white/60">{m?.nombre || x.nombreModelo}</span></span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-slate-500"><ColorPunto color={x.color} className="h-2.5 w-2.5" />{x.color}, {t ? `en camino a ${t.destino}` : `en ${x.ubicacion}`}</span>
                      <span className="block text-[12px] text-slate-400">{x.techo && x.techo !== "Sin techo" ? x.techo : "Sin techo"}{m?.precioDesde ? `, desde ${formatoSoles(m.precioDesde)}` : ""}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 2. Cliente */}
      {paso === 2 && (
        <div className="grid gap-4 sm:grid-cols-2" data-paso="cliente">
          <Campo etiqueta="Documento" error={err.doc} className="sm:col-span-2">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex rounded-[10px] bg-slate-100 p-1 dark:bg-white/5" role="radiogroup" aria-label="Tipo de documento">
                {Object.keys(DOCUMENTOS).map((t) => <button key={t} type="button" role="radio" aria-checked={c.tipoDoc === t} onClick={() => setC({ ...CLIENTE_VACIO, tipoDoc: t, celular: c.celular })} className={`rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold ${c.tipoDoc === t ? "bg-white text-marino shadow-sm dark:bg-white/15 dark:text-white" : "text-slate-500"}`}>{t}</button>)}
              </div>
              <input id="sep-doc" className="field-input !w-auto min-w-[12rem] flex-1" inputMode="numeric" maxLength={DOCUMENTOS[c.tipoDoc]} placeholder={`${DOCUMENTOS[c.tipoDoc]} dígitos`} value={c.doc} onChange={(e) => setCli("doc", soloDigitos(e.target.value, DOCUMENTOS[c.tipoDoc]))} />
            </div>
          </Campo>
          {existente ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 sm:col-span-2 dark:border-emerald-500/30 dark:bg-emerald-500/10" data-cliente-existente>
              <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-300">Cliente ya registrado</p>
              <p className="text-[15px] font-bold text-marino dark:text-white">{nombreCliente(existente)}</p>
              <p className="text-[12.5px] text-slate-500">{existente.tipoDoc} {existente.doc}, registrado el {existente.registrado}</p>
            </div>
          ) : c.tipoDoc === "RUC" ? (
            <Campo etiqueta="Razón social" error={err.razonSocial} className="sm:col-span-2"><input id="sep-razon" className="field-input" maxLength={100} value={c.razonSocial} onChange={(e) => setCli("razonSocial", e.target.value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9&.,' -]/g, "").replace(/\s{2,}/g, " ").replace(/^\s+/, ""))} placeholder="Ej.: Mototaxis del Norte S.A.C." /></Campo>
          ) : <>
            <Campo etiqueta="Nombres" error={err.nombres} className="sm:col-span-2"><input id="sep-nombres" className="field-input" maxLength={60} value={c.nombres} onChange={(e) => setCli("nombres", soloLetrasNombre(e.target.value, 60))} /></Campo>
            <Campo etiqueta="Apellido paterno" error={err.apellidoPaterno}><input id="sep-paterno" className="field-input" maxLength={60} value={c.apellidoPaterno} onChange={(e) => setCli("apellidoPaterno", soloLetrasNombre(e.target.value, 60))} /></Campo>
            <Campo etiqueta="Apellido materno (opcional)" error={err.apellidoMaterno}><input id="sep-materno" className="field-input" maxLength={60} value={c.apellidoMaterno} onChange={(e) => setCli("apellidoMaterno", soloLetrasNombre(e.target.value, 60))} /></Campo>
          </>}
          <Campo etiqueta="Celular" error={err.celular}><input id="sep-celular" className="field-input" type="tel" inputMode="numeric" maxLength={9} placeholder="9XXXXXXXX" value={c.celular} onChange={(e) => setCli("celular", soloDigitos(e.target.value, 9))} /></Campo>
          <Campo etiqueta="Correo (opcional)" error={err.correo}><input id="sep-correo" type="email" className="field-input" maxLength={254} value={c.correo} onChange={(e) => setCli("correo", e.target.value.trim())} /></Campo>
        </div>
      )}

      {/* 3. Adelanto */}
      {paso === 3 && u && (
        <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]" data-paso="adelanto">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Monto del adelanto (S/)" error={err.monto} ayuda={`Mínimo ${formatoSoles(ADELANTO_MINIMO)}`}><input id="sep-monto" className="field-input cifra" inputMode="decimal" value={a.monto} onChange={(e) => setAd("monto", soloMonto(e.target.value))} /></Campo>
            <Campo etiqueta="Fecha del pago" error={err.fechaPago}><input id="sep-fecha" type="date" className="field-input" min={sumarDias(-3)} max={hoyLocal()} value={a.fechaPago} onChange={(e) => setAd("fechaPago", e.target.value)} /></Campo>
            <Campo etiqueta="Medio de pago" error={err.medio} className="sm:col-span-2">
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Medio de pago">
                {MEDIOS_PAGO.map((m) => <button key={m} type="button" role="radio" aria-checked={a.medio === m} onClick={() => setAd("medio", m)} className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${a.medio === m ? "border-marino-700 bg-marino-700 text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-white/70"}`}>{m}</button>)}
              </div>
            </Campo>
            {conOperacion && <Campo etiqueta="N° de operación" error={err.operacion} className="sm:col-span-2"><input id="sep-operacion" className="field-input font-mono" maxLength={20} value={a.operacion} onChange={(e) => setAd("operacion", limpiarOperacion(e.target.value))} placeholder="Tal como figura en el voucher" /></Campo>}
            <Campo etiqueta={conOperacion ? "Voucher del pago" : "Foto del recibo (opcional)"} error={err.archivo} className="sm:col-span-2" ayuda={!a.archivo ? "Foto (JPG, PNG o WEBP) o PDF, máximo 5 MB." : ""}>
              {a.archivo ? <VistaVoucher archivo={a.archivo} onQuitar={() => setAd("archivo", null)} /> : (
                <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-center transition hover:border-marino-700 hover:bg-marino-50/50 dark:border-white/15 dark:hover:bg-white/5">
                  <span className="text-[14px] font-semibold text-marino dark:text-white">Elegir archivo</span>
                  <span className="text-[12px] text-slate-500">Captura de Yape o Plin, voucher del banco o recibo de caja</span>
                  <input id="sep-voucher" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={elegirArchivo} />
                </label>
              )}
            </Campo>
            {user.rol !== "vendedor" && <Campo etiqueta="Vendedor responsable" error={err.vendedor}><select className="field-input" value={a.vendedor} onChange={(e) => setAd("vendedor", e.target.value)}>{[...new Set([...vendedores.map((p) => p.nombre), user.nombre])].map((n) => <option key={n}>{n}</option>)}</select></Campo>}
            <Campo etiqueta="Observación (opcional)" error={err.obs} className={user.rol !== "vendedor" ? "" : "sm:col-span-2"}><input className="field-input" maxLength={320} value={a.obs} onChange={(e) => setAd("obs", e.target.value)} placeholder="Ej: viene el sábado con su DNI" /></Campo>
          </div>
          <aside className="h-fit space-y-3 rounded-xl2 bg-marino-50 p-4 dark:bg-white/5">
            <p className="text-[13px] font-semibold text-slate-500">Resumen</p>
            <p className="font-bold text-marino dark:text-white">{u.id} {modeloDe(u)?.nombre}</p>
            <dl className="space-y-1.5 text-[13.5px]">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Precio desde</dt><dd className="cifra font-semibold">{precio ? formatoSoles(precio) : "A consultar"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Adelanto</dt><dd className="cifra font-semibold">{Number(a.monto) > 0 ? formatoSoles(Number(a.monto)) : "—"}</dd></div>
              {precio > 0 && Number(a.monto) > 0 && <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5 dark:border-white/10"><dt className="text-slate-500">Saldo referencial</dt><dd className="cifra font-semibold">{formatoSoles(Math.max(precio - Number(a.monto), 0))}</dd></div>}
            </dl>
            {vence && <p className="rounded-lg bg-white px-3 py-2 text-[13px] text-slate-600 dark:bg-white/5 dark:text-white/70">La separación vence el <b className="text-marino dark:text-white">{fechaLarga(vence)}</b>, {DIAS_SEPARACION} días después del pago.</p>}
          </aside>
        </div>
      )}

      {/* 4. Confirmar */}
      {paso === 4 && u && (
        <div className="space-y-4" data-paso="confirmar">
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Moto", `${u.id} ${modeloDe(u)?.nombre || ""}`, `${u.color} en ${u.ubicacion}`], ["Cliente", cliNombre, `${c.tipoDoc} ${c.doc}, cel. ${c.celular}`], ["Adelanto", formatoSoles(Number(a.monto)), `${a.medio}${a.operacion ? `, op. ${a.operacion}` : ""}`]].map(([t, v, n]) => (
              <div key={t} className="rounded-xl2 border border-slate-200 p-4 dark:border-white/10"><p className="text-[12.5px] text-slate-500">{t}</p><p className="mt-0.5 font-bold text-marino dark:text-white">{v}</p><p className="text-[12.5px] text-slate-500">{n}</p></div>
            ))}
          </div>
          <Aviso>La moto quedará <b>Separada</b> y saldrá de Disponibilidad. La separación vence el {fechaLarga(vence)}; antes de esa fecha registra la venta o cancélala.</Aviso>
          <label className={`flex items-start gap-3 rounded-xl border-2 p-4 text-[14px] ${confirmado ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10" : "border-slate-200 dark:border-white/10"}`}>
            <input id="sep-confirmo" type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={confirmado} onChange={(e) => { setConfirmado(e.target.checked); limpiarError("confirmado"); }} />
            <span><b className="text-marino dark:text-white">Verifiqué el adelanto.</b> <span className="text-slate-600 dark:text-white/70">{conOperacion ? `El pago de ${formatoSoles(Number(a.monto))} con N° de operación ${a.operacion} ya figura en la cuenta de la empresa.` : `Recibí ${formatoSoles(Number(a.monto))} en efectivo y entregué el recibo.`}</span></span>
          </label>
          {err.confirmado && <p className="-mt-2 text-[12.5px] font-medium text-acento">{err.confirmado}</p>}
        </div>
      )}
    </Modal>
  );
}
