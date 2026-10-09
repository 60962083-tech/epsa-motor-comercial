import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, Campo, Card, PageHeader, useConfirm, useToast } from "../../components/ui";
import ModeloImg from "../../components/ModeloImg";
import HUBadge from "../../components/HUBadge";
import { ESTADO_COMPRA } from "./Compras.HU-034";

const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
const limpiarColor = (t) => t.trim().replace(/\s+/g, " ");
const COLORES = ["Rojo", "Blanco", "Azul"];

/**
 * Registrar compra pendiente de factura — HU-034 (frontend del POST /api/compras de Michelle).
 * Se envían solo modelo, color y cantidad. Autor, fecha, hora y estado los asigna el backend.
 * Cada intención de compra lleva un UUID (Idempotency-Key) que se reutiliza si hay que reintentar.
 */
export default function RegistrarCompra() {
  const { compras: locales, modelos, agregar } = useApp();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm(); const navigate = useNavigate();
  const [pendientes, setPendientes] = useState(MODO_REAL ? [] : locales.filter((c) => c.estcom !== "Identificada"));
  const [f, setF] = useState({ codmod: modelos[0]?.codmod || "", colcom: "", cancom: 1 });
  const [err, setErr] = useState({});
  const [reviso, setReviso] = useState(false);
  const [enviando, setEnviando] = useState(false); const [reintento, setReintento] = useState(false);
  const clave = useRef(uuid());

  useEffect(() => {
    if (!MODO_REAL) return;
    api.listarCompras(100, 0).then((r) => setPendientes(r.data || [])).catch((e) => toast(mensajeError(e), "error"));
  }, []); // eslint-disable-line

  const modelo = modelos.find((m) => m.codmod === f.codmod);
  const color = limpiarColor(f.colcom);
  const similares = useMemo(() => pendientes.filter((c) => c.codmod === String(f.codmod) && c.colcom.toLowerCase() === color.toLowerCase()), [pendientes, f.codmod, color]);

  if (!puede("compras.registrar")) {
    return <div className="space-y-3"><Aviso tipo="aviso">Solo gerencia y administración registran compras a proveedor. Tu rol puede consultarlas.</Aviso><Link className="btn btn-secondary" to="/admin/compras">Ver compras</Link></div>;
  }

  function validar() {
    const x = {};
    if (!f.codmod) x.codmod = "Elige el modelo comprado.";
    if (!color) x.colcom = "El color es obligatorio."; else if (color.length > 50) x.colcom = "Máximo 50 caracteres.";
    const n = Number(f.cancom);
    if (!Number.isInteger(n) || n < 1 || n > 2147483647) x.cancom = "La cantidad debe ser un número entero mayor a 0.";
    if (!reviso) x.reviso = "Confirma que revisaste las compras pendientes.";
    setErr(x); return Object.keys(x).length === 0;
  }

  // Mismo comportamiento que el backend en modo demostración (idempotencia por clave)
  function registrarLocal(cuerpo) {
    const previa = locales.find((c) => c.idem === clave.current);
    if (previa) {
      if (previa.codmod === cuerpo.codmod && previa.colcom === cuerpo.colcom && previa.cancom === cuerpo.cancom) return { status: 200, data: previa };
      throw Object.assign(new Error("La clave de idempotencia ya se usó con otros datos."), { status: 409 });
    }
    const ahora = new Date();
    const codcom = String(locales.reduce((a, c) => Math.max(a, Number(c.codcom)), 0) + 1);
    agregar("compras", { id: Date.now(), codcom, codmod: cuerpo.codmod, nommod: modelo.nombre, colcom: cuerpo.colcom, cancom: cuerpo.cancom, cantidad_pendiente: cuerpo.cancom, estcom: "Pendiente de factura", feccom: ahora.toISOString().slice(0, 10), horcom: ahora.toTimeString().slice(0, 5), codusu: user.nombre, idem: clave.current, factura: null, unidades: [] }, `Compra registrada: ${modelo.nombre} ${cuerpo.colcom} x${cuerpo.cancom}`);
    return { status: 201, data: { codcom } };
  }

  async function enviar(e) {
    e.preventDefault();
    if (!validar()) return;
    const cuerpo = { codmod: String(f.codmod), colcom: color, cancom: Number(f.cancom) };
    if (!(await confirmar({ titulo: "¿Registrar esta compra?", texto: `${modelo?.nombre} · color ${color} · ${cuerpo.cancom} moto(s). Quedará «Pendiente de factura» con tu usuario, fecha y hora automáticos.`, boton: "Registrar compra" }))) return;
    setEnviando(true);
    try {
      const r = MODO_REAL ? await api.crearCompra(cuerpo, clave.current) : registrarLocal(cuerpo);
      toast(r.status === 200 ? "Esa compra ya estaba registrada (mismo reintento): se muestra la misma." : "Compra registrada. Siguiente paso: registrar la factura (HU-002).");
      navigate(`/admin/compras/${r.data?.codcom}`);
    } catch (er) {
      if (er.status === 0 || er.status >= 500) { setReintento(true); toast("No hubo respuesta clara del servidor. Presiona «Reintentar»: se usa la misma clave y no se duplica.", "error"); }
      else { setErr({ general: mensajeError(er) }); toast(mensajeError(er), "error"); }
    } finally { setEnviando(false); }
  }

  return (
    <div>
      <HUBadge code="HU-034" titulo="Registrar compra pendiente de factura" />
      <PageHeader titulo="Registrar compra pendiente de factura" subtitulo="Después de cotizar y pagar a Crosland, registra qué modelo, color y cuántas motos se compraron. La factura y las series se completan después (HU-002).">
        <Link to="/admin/compras" className="btn btn-secondary !py-2.5">← Compras</Link>
      </PageHeader>

      <form onSubmit={enviar} noValidate className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="min-w-0">
          <h2 className="text-lg font-bold text-marino dark:text-white">Datos de la compra</h2>
          <div className="mt-5 grid gap-5">
            <Campo etiqueta="Modelo comprado" error={err.codmod}>
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-28 shrink-0 place-items-center overflow-hidden rounded-xl bg-escenario dark:bg-escenario-oscuro">{modelo && <ModeloImg modelo={modelo} className="h-full w-full object-contain p-1" />}</div>
                <select id="compra-modelo" className="field-input" value={f.codmod} onChange={(e) => setF({ ...f, codmod: e.target.value })}>{modelos.map((m) => <option key={m.codmod} value={m.codmod}>{m.nombre}</option>)}</select>
              </div>
            </Campo>
            <Campo etiqueta="Color" error={err.colcom} ayuda="Escribe el color tal como figura en la cotización de Crosland.">
              <div className="flex flex-wrap gap-2">
                {(modelo?.colores?.length ? modelo.colores : COLORES).map((c) => (
                  <button type="button" key={c} onClick={() => setF({ ...f, colcom: c })} className={`rounded-full border px-3.5 py-1.5 text-[13.5px] font-medium ${color.toLowerCase() === c.toLowerCase() ? "border-marino-700 bg-marino-700 text-white" : "border-slate-300 hover:bg-slate-50 dark:border-white/15 dark:hover:bg-white/5"}`}>{c}</button>
                ))}
                <input id="compra-color" className="field-input !w-44" value={f.colcom} maxLength={60} onChange={(e) => setF({ ...f, colcom: e.target.value })} placeholder="Otro color" />
              </div>
            </Campo>
            <Campo etiqueta="Cantidad de motos" error={err.cancom}>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Restar una" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-300 text-xl dark:border-white/15" onClick={() => setF({ ...f, cancom: Math.max(1, Number(f.cancom) - 1) })}>−</button>
                <input id="compra-cantidad" className="field-input !w-24 text-center text-lg font-bold tabular-nums" inputMode="numeric" value={f.cancom} onChange={(e) => setF({ ...f, cancom: e.target.value.replace(/\D/g, "") })} />
                <button type="button" aria-label="Sumar una" className="grid h-11 w-11 place-items-center rounded-lg border border-slate-300 text-xl dark:border-white/15" onClick={() => setF({ ...f, cancom: Number(f.cancom || 0) + 1 })}>+</button>
              </div>
            </Campo>
            {similares.length > 0 && <Aviso tipo="aviso">Ya hay {similares.length} compra(s) pendiente(s) de {modelo?.nombre} en {color} (#{similares.map((c) => c.codcom).join(", #")}). Confirma con la gerencia que no sea la misma antes de registrar otra.</Aviso>}
            {err.general && <Aviso tipo="error">{err.general}</Aviso>}
            {reintento && <Aviso>Sin respuesta clara del servidor. Se reutilizará la misma clave: si la compra sí se creó, no se duplicará.</Aviso>}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-bold text-marino dark:text-white">Antes de registrar</h2>
            <p className="mt-1 text-[13px] text-slate-500">Revisa que esta compra no esté ya en la lista. Dos registros distintos nunca se fusionan.</p>
            {pendientes.length === 0 ? <p className="mt-3 text-[13.5px] text-slate-400">No hay compras pendientes.</p> : (
              <ul className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 text-[13.5px] dark:divide-white/10 dark:border-white/10">
                {pendientes.map((c) => (
                  <li key={c.codcom} className={`flex items-center justify-between gap-3 px-3 py-2 ${similares.includes(c) ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}>
                    <span>#{c.codcom} · {c.nommod} · {c.colcom} · {c.cancom}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${ESTADO_COMPRA[c.estcom] || "bg-slate-200"}`}>{c.estcom}</span>
                  </li>
                ))}
              </ul>
            )}
            <label className="mt-4 flex items-start gap-2 text-[14px] font-medium"><input id="compra-reviso" type="checkbox" className="mt-1 h-4 w-4 accent-[#0e2c52]" checked={reviso} onChange={(e) => setReviso(e.target.checked)} />Revisé las compras pendientes y esta compra no está registrada.</label>
            {err.reviso && <p className="mt-1 text-[12px] font-medium text-acento">{err.reviso}</p>}
          </Card>
          <Card>
            <h2 className="font-bold text-marino dark:text-white">Resumen</h2>
            <dl className="mt-3 space-y-2 text-[14px]">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Modelo</dt><dd className="text-right font-semibold">{modelo?.nombre || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Color</dt><dd className="font-semibold">{color || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Cantidad</dt><dd className="font-semibold tabular-nums">{f.cancom || "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Estado inicial</dt><dd><span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${ESTADO_COMPRA["Pendiente de factura"]}`}>Pendiente de factura</span></dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Registra</dt><dd className="font-semibold">{user.nombre} (automático)</dd></div>
            </dl>
            <p className="mt-3 break-all text-[11.5px] text-slate-400">Clave de reintento: {clave.current}</p>
            <button className="btn btn-primary mt-5 w-full" disabled={enviando}>{enviando ? "Registrando…" : reintento ? "Reintentar registro" : "Registrar compra"}</button>
          </Card>
        </div>
      </form>
    </div>
  );
}
