// HU-003 · Ventanas para registrar movimientos en la base central (la preparación está en PreparacionUnidad.jsx)
// Cada registro envía la ubicación que la persona vio; si otra sesión la cambió antes,
// el servidor avisa el conflicto y no se sobrescribe nada.
import { useCallback, useEffect, useMemo, useState } from "react";
import { mensajeError } from "../../lib/errores";
import { confirmarRecepcionApi, iniciarMovimientoApi, movimientosUnidadApi, sinRespuesta, ubicacionInicialApi, useIntento } from "../../servicios/central";
import { GRUPOS_LUGAR_API, ubicacionDe } from "../../servicios/inventarioCentral";
import { Aviso, Campo, Modal, useToast } from "../ui";
import { motivosTrasladoApi } from "../../lib/api";
import { MAX_DETALLE_MOTIVO, MOTIVOS_TRASLADO, observacionConMotivo } from "../../lib/motivos";
import { ColorUnidad, capital, nombreUnidad } from "./Central";

const limpio = (t) => String(t || "").trim().replace(/\s+/g, " ");
const largo = (t) => [...limpio(t)].length;
const NO_CONFIRMADO = "No se pudo confirmar si se guardó: la conexión falló. Vuelve a intentarlo; esta misma operación no se registrará dos veces.";
const SIN_RESPUESTA_MOV = "No se pudo confirmar si se guardó porque falló la conexión. Revisa la ubicación actualizada antes de volver a intentarlo.";
export const MAX_OBS_MOV = 500;
// El mensaje del servidor puede venir sin punto final
// Motivos de traslado guardados en la base (si aún no están, la lista del panel)
function useMotivosTraslado(abierto) {
  const [motivos, setMotivos] = useState(MOTIVOS_TRASLADO);
  useEffect(() => {
    if (!abierto) return;
    motivosTrasladoApi().then((r) => { if (Array.isArray(r) && r.length) setMotivos(r); }).catch(() => {});
  }, [abierto]);
  return motivos;
}
const conPunto = (t) => (/[.!?…]$/.test(String(t).trim()) ? String(t).trim() : `${String(t).trim()}.`);

// Resumen de la moto en la cabecera de cada ventana
function CabeceraUnidad({ unidad, ubicacion }) {
  if (!unidad) return null;
  const x = ubicacion === undefined ? ubicacionDe(unidad) : null;
  const donde = ubicacion === undefined ? x.texto : ubicacion?.nomubi ? `En ${ubicacion.nomubi}` : "Sin ubicación confirmada";
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13.5px] dark:bg-white/5" data-cabecera-unidad={unidad.coduni}>
      <p className="font-semibold text-marino dark:text-white">{unidad.nommod ? `${unidad.nommod} · ${unidad.nummotuni ? `motor ${unidad.nummotuni}` : `N° ${unidad.coduni}`}` : `Unidad N° ${unidad.coduni}`}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-slate-500">{unidad.coluni && <ColorUnidad color={unidad.coluni} />}{unidad.chauni && <span>Chasis {unidad.chauni}</span>}<span>{donde}</span></p>
    </div>
  );
}

// Selector de ubicaciones activas agrupadas por tipo
function OpcionesUbicacion({ ubicaciones, excluir }) {
  return GRUPOS_LUGAR_API.map((g) => {
    const ls = ubicaciones.filter((l) => l.tipubi === g.tipo && l.estubi && String(l.codubi) !== String(excluir || ""));
    return ls.length ? <optgroup key={g.tipo} label={g.titulo}>{ls.map((l) => <option key={l.codubi} value={l.codubi}>{l.nomubi}</option>)}</optgroup> : null;
  });
}

// Lo que el servidor informa en un conflicto de ubicación inicial
function textoConflicto(actual) {
  if (!actual) return "";
  const mov = actual.movimiento_activo;
  if (mov) return `Ahora tiene un traslado en tránsito de ${mov.origen?.nomubi || "su ubicación"} a ${mov.destino?.nomubi}.`;
  return actual.ubicacion ? `Ahora figura en ${actual.ubicacion.nomubi}.` : "Ahora figura sin ubicación registrada.";
}

// ---------------------------------------------------------------------------------------------
// Registrar la salida de una moto (HU-003)
// Sale desde su ubicación confirmada y queda en tránsito. Si ya llegó, se confirma la llegada en el mismo paso.
// ---------------------------------------------------------------------------------------------
const MODOS = [
  { id: "transito", titulo: "Sale ahora", texto: "Queda en tránsito. Su ubicación cambia recién cuando confirmes la llegada." },
  { id: "llego", titulo: "Ya llegó al destino", texto: "Se registran la salida y la llegada: la moto pasa a figurar en el destino." },
];

export function ModalTrasladoCentral({ abierto, unidad: fija, unidades = [], ubicaciones = [], onClose, onHecho, onConflicto }) {
  const toast = useToast();
  const [coduni, setCoduni] = useState("");
  // Dónde está confirmada al abrir la ventana: ese es el origen que se envía
  const [actual, setActual] = useState({ cargando: false, datos: null, error: "" });
  const [destino, setDestino] = useState(""); const [modo, setModo] = useState("transito");
  const [motivo, setMotivo] = useState(""); const [detalle, setDetalle] = useState("");
  const motivos = useMotivosTraslado(abierto);
  const [err, setErr] = useState({}); const [enviando, setEnviando] = useState(false); const [conflicto, setConflicto] = useState("");
  const elegibles = useMemo(() => unidades.filter((u) => u.ubicacion && !u.movimiento_activo), [unidades]);
  const unidad = fija || elegibles.find((u) => String(u.coduni) === String(coduni)) || null;

  const consultar = useCallback(async (id) => {
    if (!id) { setActual({ cargando: false, datos: null, error: "" }); return; }
    setActual({ cargando: true, datos: null, error: "" });
    try { setActual({ cargando: false, datos: await movimientosUnidadApi(id), error: "" }); }
    catch (e) { setActual({ cargando: false, datos: null, error: e.detalle?.sinRuta ? "Los traslados todavía no están disponibles. Inténtalo más adelante." : mensajeError(e) }); }
  }, []);
  useEffect(() => {
    if (!abierto) return;
    setCoduni(fija?.coduni || ""); setDestino(""); setModo("transito"); setMotivo(""); setDetalle(""); setErr({}); setConflicto("");
    consultar(fija?.coduni);
  }, [abierto, fija?.coduni]); // eslint-disable-line react-hooks/exhaustive-deps

  const origen = actual.datos?.ubicacionConfirmada || null;
  const activo = actual.datos?.movimientoActivo || null;
  const d = ubicaciones.find((l) => String(l.codubi) === String(destino));

  function validar() {
    const x = {};
    if (!unidad) x.unidad = "Elige la moto que se traslada.";
    else if (actual.cargando) x.unidad = "Espera un momento: se está comprobando dónde está la moto.";
    else if (actual.error) x.unidad = actual.error;
    else if (activo) x.unidad = `Ya tiene un traslado en tránsito a ${activo.destino?.nomubi}. Confirma su llegada primero.`;
    else if (!origen) x.unidad = "Esta moto todavía no tiene una ubicación confirmada. Primero se registra dónde está.";
    if (!destino) x.destino = "Elige el destino.";
    else if (!d || !d.estubi) x.destino = "Ese destino no existe o está inactivo.";
    else if (origen && String(origen.codubi) === String(destino)) x.destino = "El destino debe ser distinto de donde está la moto.";
    if (!MODOS.some((m) => m.id === modo)) x.modo = "Indica si sale ahora o si ya llegó.";
    // Motivo obligatorio (la base también lo exige); «Otro» pide escribir el detalle
    const m = motivos.find((x) => x.nombre === motivo);
    if (!motivo) x.motivo = "Elige el motivo del traslado.";
    else if (!m) x.motivo = "Ese motivo ya no está disponible. Elige otro.";
    if (m?.detalleObligatorio && largo(detalle) < 5) x.detalle = "Cuenta el motivo en el detalle (mínimo 5 caracteres).";
    if (largo(detalle) > MAX_DETALLE_MOTIVO) x.detalle = `El detalle admite hasta ${MAX_DETALLE_MOTIVO} caracteres.`;
    setErr(x);
    return Object.keys(x).length === 0;
  }

  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    setEnviando(true); setConflicto("");
    try {
      const r = await iniciarMovimientoApi(unidad.coduni, { codubiori: origen.codubi, codubides: destino, obsmub: observacionConMotivo(motivo, limpio(detalle)) });
      if (modo === "llego" && r.data?.codmub) {
        try {
          await confirmarRecepcionApi(unidad.coduni, r.data.codmub);
          toast(`Llegada registrada: la moto figura en ${d.nomubi}`);
        } catch (e2) {
          toast(`La salida quedó registrada, pero la llegada no: ${conPunto(mensajeError(e2))} Confírmala desde la ficha.`, "error");
        }
      } else toast(`Salida registrada: la moto va en tránsito a ${d.nomubi}`);
      onHecho?.(r.data);
      onClose();
    } catch (er) {
      if (er.status === 409) { setConflicto(conPunto(mensajeError(er))); consultar(unidad.coduni); onConflicto?.(); }
      else if (sinRespuesta(er)) { setErr({ general: SIN_RESPUESTA_MOV }); consultar(unidad.coduni); onConflicto?.(); }
      else setErr({ general: mensajeError(er) });
    } finally { setEnviando(false); }
  }

  const resumen = unidad && d && origen ? `${nombreUnidad(unidad)}: de ${origen.nomubi} a ${d.nomubi}. Motivo: ${motivo || "—"}. ${MODOS.find((m) => m.id === modo)?.texto}` : "";
  const detalleObligatorio = motivos.find((x) => x.nombre === motivo)?.detalleObligatorio;
  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Registrar traslado" ancho="max-w-xl"
      confirmarGuardar={{ titulo: "¿Registrar este traslado?", texto: resumen, boton: "Sí, registrar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-traslado-central" className="btn btn-primary !py-2" disabled={enviando || actual.cargando}>{enviando ? "Registrando…" : "Registrar"}</button></>}>
      <form id="f-traslado-central" onSubmit={guardar} className="space-y-4" noValidate>
        {!fija && (
          <Campo etiqueta="Moto" error={err.unidad}>
            <select id="tras-unidad" className="field-input" value={coduni} onChange={(e) => { setCoduni(e.target.value); setConflicto(""); setErr({}); consultar(e.target.value); }}>
              <option value="">{elegibles.length ? "Elige la moto" : "No hay motos con ubicación y sin traslado en curso"}</option>
              {elegibles.map((u) => <option key={u.coduni} value={u.coduni}>{u.nommod}, {capital(u.coluni)}, {u.nummotuni ? `motor ${u.nummotuni}` : `N° ${u.coduni}`} · en {u.ubicacion.nomubi}</option>)}
            </select>
          </Campo>
        )}
        {unidad && <CabeceraUnidad unidad={unidad} ubicacion={actual.cargando ? { nomubi: "…" } : origen} />}
        {fija && err.unidad && <p className="text-[12px] font-medium text-acento">{err.unidad}</p>}
        {activo && <Aviso tipo="info">Va en tránsito de <b>{activo.origen?.nomubi}</b> a <b>{activo.destino?.nomubi}</b>. Confirma su llegada antes de registrar otro traslado.</Aviso>}
        <Campo etiqueta="Destino" error={err.destino}>
          <select id="tras-destino" className="field-input" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elige el destino</option>
            <OpcionesUbicacion ubicaciones={ubicaciones} excluir={origen?.codubi} />
          </select>
        </Campo>
        <fieldset>
          <legend className="field-label">¿En qué situación está?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODOS.map((m) => (
              <label key={m.id} className={`cursor-pointer rounded-xl border-2 p-3 transition ${modo === m.id ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : "border-slate-200 hover:border-slate-300 dark:border-white/10"}`}>
                <input type="radio" name="tras-modo" className="sr-only" checked={modo === m.id} onChange={() => setModo(m.id)} />
                <span className="block text-[14px] font-semibold text-marino dark:text-white">{m.titulo}</span>
                <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{m.texto}</span>
              </label>
            ))}
          </div>
          {err.modo && <p className="mt-1 text-[12px] font-medium text-acento">{err.modo}</p>}
        </fieldset>
        <Campo etiqueta="Motivo del traslado" error={err.motivo}>
          <select id="tras-motivo" className="field-input" value={motivo} onChange={(e) => { setMotivo(e.target.value); setErr((x) => ({ ...x, motivo: undefined, detalle: undefined })); }} data-motivo-traslado>
            <option value="">Elige el motivo</option>
            {motivos.map((m) => <option key={m.nombre} value={m.nombre}>{m.nombre}</option>)}
          </select>
        </Campo>
        <Campo etiqueta={detalleObligatorio ? "Detalle del motivo" : "Detalle (opcional)"} error={err.detalle} ayuda={`${largo(detalle)}/${MAX_DETALLE_MOTIVO}. ${detalleObligatorio ? "Cuenta por qué se traslada." : "Por ejemplo: quién la lleva o qué avisó el taller."}`}>
          <textarea id="tras-obs" className="field-input" rows={2} maxLength={MAX_DETALLE_MOTIVO + 20} value={detalle} onChange={(e) => { setDetalle(e.target.value); setErr((x) => ({ ...x, detalle: undefined })); }} />
        </Campo>
        <p className="text-[12.5px] text-slate-500">Trasladar no cambia la situación comercial: una moto separada o vendida lo sigue estando. Un aviso del taller por WhatsApp no la mueve sola.</p>
        {conflicto && (
          <div data-conflicto><Aviso tipo="error"><b>{conflicto}</b> Se cargó su ubicación actual arriba: revísala y vuelve a registrar si corresponde.</Aviso></div>
        )}
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Confirmar la llegada de un traslado en tránsito (HU-003)
// ---------------------------------------------------------------------------------------------
export function ModalLlegadaCentral({ datos, onClose, onHecho, onConflicto }) {
  const toast = useToast();
  const [error, setError] = useState(""); const [enviando, setEnviando] = useState(false);
  useEffect(() => { setError(""); }, [datos?.movimiento?.codmub]);
  if (!datos) return null;
  const { unidad, movimiento: m } = datos;
  async function confirmar() {
    if (enviando) return;
    setEnviando(true); setError("");
    try {
      await confirmarRecepcionApi(unidad.coduni, m.codmub);
      toast(`Llegada confirmada: la moto figura en ${m.destino?.nomubi}`);
      onHecho?.();
      onClose();
    } catch (er) {
      if (er.status === 409) { setError(`${conPunto(mensajeError(er))} Se actualizó la información de la moto.`); onConflicto?.(); }
      else setError(sinRespuesta(er) ? SIN_RESPUESTA_MOV : mensajeError(er));
    } finally { setEnviando(false); }
  }
  return (
    <Modal abierto onClose={onClose} titulo="Confirmar llegada" ancho="max-w-lg" confirmarGuardar={false}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Volver</button><button className="btn btn-primary !py-2" onClick={confirmar} disabled={enviando} data-confirmar-llegada>{enviando ? "Confirmando…" : "Confirmar llegada"}</button></>}>
      <div className="space-y-4">
        <CabeceraUnidad unidad={unidad} ubicacion={m.origen} />
        <p className="text-[14px] text-slate-600 dark:text-white/70">Viaja de <b className="text-marino dark:text-white">{m.origen?.nomubi}</b> a <b className="text-marino dark:text-white">{m.destino?.nomubi}</b>. Al confirmar, la moto pasa a figurar en {m.destino?.nomubi} y queda registrado quién la recibió y cuándo.</p>
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Ubicación inicial: motos identificadas a mano que aún no tienen ubicación (HU-003)
// ---------------------------------------------------------------------------------------------
export function ModalUbicacionInicial({ unidad, ubicaciones = [], onClose, onHecho, onConflicto }) {
  const toast = useToast();
  const intento = useIntento();
  const [codubi, setCodubi] = useState(""); const [obs, setObs] = useState("");
  const [err, setErr] = useState({}); const [enviando, setEnviando] = useState(false);
  useEffect(() => { setCodubi(""); setObs(""); setErr({}); }, [unidad?.coduni]);
  if (!unidad) return null;
  function validar() {
    const x = {};
    const l = ubicaciones.find((y) => String(y.codubi) === String(codubi));
    if (!codubi) x.codubi = "Elige dónde está la moto.";
    else if (!l || !l.estubi) x.codubi = "Esa ubicación no existe o está inactiva.";
    if (largo(obs) > MAX_OBS_MOV) x.obs = `La observación admite hasta ${MAX_OBS_MOV} caracteres.`;
    setErr(x);
    return Object.keys(x).length === 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    const cuerpo = { codubi, observacion: limpio(obs) || null };
    setEnviando(true);
    try {
      const r = await ubicacionInicialApi(unidad.coduni, cuerpo, intento(JSON.stringify({ u: unidad.coduni, ...cuerpo })));
      toast(r.message || "Ubicación inicial registrada");
      onHecho?.(r.data);
      onClose();
    } catch (er) {
      // Sin ruta en la API ni función en Supabase (falta el PASO-5: docs/supabase-sprint2-conexiones.sql)
      if (er.detalle?.sinRuta || er.detalle?.faltaSql) setErr({ general: "Todavía no se puede registrar la ubicación inicial desde el panel. Pídele a quien administra el sistema que registre dónde está esta moto." });
      else if (er.status === 409) { setErr({ general: `${conPunto(mensajeError(er))} ${textoConflicto(er.detalle?.actual)}` }); onConflicto?.(); }
      else setErr({ general: sinRespuesta(er) ? NO_CONFIRMADO : mensajeError(er) });
    } finally { setEnviando(false); }
  }
  const l = ubicaciones.find((y) => String(y.codubi) === String(codubi));
  return (
    <Modal abierto onClose={onClose} titulo="Registrar ubicación inicial" ancho="max-w-lg"
      confirmarGuardar={{ titulo: "¿Registrar la ubicación inicial?", texto: l ? `${unidad.nummotuni ? `Motor ${unidad.nummotuni}` : `La unidad N° ${unidad.coduni}`} figurará en ${l.nomubi}. Después, cada cambio se registra como traslado.` : "", boton: "Sí, registrar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-ubicacion-inicial" className="btn btn-primary !py-2" disabled={enviando}>{enviando ? "Registrando…" : "Registrar"}</button></>}>
      <form id="f-ubicacion-inicial" onSubmit={guardar} className="space-y-4" noValidate>
        <CabeceraUnidad unidad={unidad} ubicacion={null} />
        <p className="text-[13px] text-slate-500">Esta moto se identificó a mano en Compras y todavía no tiene una ubicación confirmada. Indica dónde está realmente; no se registra como traslado.</p>
        <Campo etiqueta="¿Dónde está?" error={err.codubi}>
          <select id="inicial-ubicacion" className="field-input" value={codubi} onChange={(e) => setCodubi(e.target.value)}><option value="">Elige la ubicación</option><OpcionesUbicacion ubicaciones={ubicaciones} /></select>
        </Campo>
        <Campo etiqueta="Observación (opcional)" error={err.obs} ayuda={`${largo(obs)}/${MAX_OBS_MOV}`}><textarea className="field-input" rows={2} maxLength={MAX_OBS_MOV + 40} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
      </form>
    </Modal>
  );
}
