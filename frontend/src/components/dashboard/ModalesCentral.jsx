// HU-003 y HU-033 · Ventanas para registrar movimientos y avances de preparación en la base central
// Cada registro envía lo que la persona vio (ubicación confirmada o versión); si otra sesión lo cambió antes,
// el servidor avisa el conflicto y no se sobrescribe nada.
import { useCallback, useEffect, useMemo, useState } from "react";
import { mensajeError } from "../../lib/errores";
import { actualizarPreparacionApi, confirmarRecepcionApi, iniciarMovimientoApi, movimientosUnidadApi, sinRespuesta, ubicacionInicialApi, useIntento } from "../../servicios/central";
import { GRUPOS_LUGAR_API, techoDe, ubicacionDe } from "../../servicios/inventarioCentral";
import { Aviso, Campo, Modal, useToast } from "../ui";
import { ColorUnidad, capital } from "./Central";

const limpio = (t) => String(t || "").trim().replace(/\s+/g, " ");
const largo = (t) => [...limpio(t)].length;
const NO_CONFIRMADO = "No se pudo confirmar si se guardó: la conexión falló. Vuelve a intentarlo; esta misma operación no se registrará dos veces.";
const SIN_RESPUESTA_MOV = "No se pudo confirmar si se guardó porque falló la conexión. Revisa la ubicación actualizada antes de volver a intentarlo.";
export const MAX_OBS_MOV = 500;
// El mensaje del servidor puede venir sin punto final
const conPunto = (t) => (/[.!?…]$/.test(String(t).trim()) ? String(t).trim() : `${String(t).trim()}.`);

// Resumen de la moto en la cabecera de cada ventana
function CabeceraUnidad({ unidad, ubicacion }) {
  if (!unidad) return null;
  const x = ubicacion === undefined ? ubicacionDe(unidad) : null;
  const donde = ubicacion === undefined ? x.texto : ubicacion?.nomubi ? `En ${ubicacion.nomubi}` : "Sin ubicación confirmada";
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 text-[13.5px] dark:bg-white/5" data-cabecera-unidad={unidad.coduni}>
      <p className="font-semibold text-marino dark:text-white">{unidad.nommod ? `${unidad.nommod} · motor ${unidad.nummotuni}` : `Unidad N° ${unidad.coduni}`}</p>
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
  const [destino, setDestino] = useState(""); const [modo, setModo] = useState("transito"); const [obs, setObs] = useState("");
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
    setCoduni(fija?.coduni || ""); setDestino(""); setModo("transito"); setObs(""); setErr({}); setConflicto("");
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
    if (largo(obs) > MAX_OBS_MOV) x.obs = `La observación admite hasta ${MAX_OBS_MOV} caracteres.`;
    setErr(x);
    return Object.keys(x).length === 0;
  }

  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    setEnviando(true); setConflicto("");
    try {
      const r = await iniciarMovimientoApi(unidad.coduni, { codubiori: origen.codubi, codubides: destino, obsmub: limpio(obs) || null });
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

  const resumen = unidad && d && origen ? `${unidad.nommod ? `Motor ${unidad.nummotuni}` : `Unidad N° ${unidad.coduni}`}: de ${origen.nomubi} a ${d.nomubi}. ${MODOS.find((m) => m.id === modo)?.texto}` : "";
  return (
    <Modal abierto={abierto} onClose={onClose} titulo="Registrar traslado" ancho="max-w-xl"
      confirmarGuardar={{ titulo: "¿Registrar este traslado?", texto: resumen, boton: "Sí, registrar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-traslado-central" className="btn btn-primary !py-2" disabled={enviando || actual.cargando}>{enviando ? "Registrando…" : "Registrar"}</button></>}>
      <form id="f-traslado-central" onSubmit={guardar} className="space-y-4" noValidate>
        {!fija && (
          <Campo etiqueta="Moto" error={err.unidad}>
            <select id="tras-unidad" className="field-input" value={coduni} onChange={(e) => { setCoduni(e.target.value); setConflicto(""); setErr({}); consultar(e.target.value); }}>
              <option value="">{elegibles.length ? "Elige la moto" : "No hay motos con ubicación y sin traslado en curso"}</option>
              {elegibles.map((u) => <option key={u.coduni} value={u.coduni}>{u.nommod}, {capital(u.coluni)}, motor {u.nummotuni} · en {u.ubicacion.nomubi}</option>)}
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
        <Campo etiqueta="Observación (opcional)" error={err.obs} ayuda={`${largo(obs)}/${MAX_OBS_MOV}. Por ejemplo: quién la lleva o qué avisó el taller.`}>
          <textarea id="tras-obs" className="field-input" rows={2} maxLength={MAX_OBS_MOV + 40} value={obs} onChange={(e) => setObs(e.target.value)} />
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
      if (er.detalle?.sinRuta) setErr({ general: "Todavía no se puede registrar la ubicación inicial desde el panel. Pídele a quien administra el sistema que registre dónde está esta moto." });
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

// ---------------------------------------------------------------------------------------------
// Preparación: armado, avance del techo y condición de entrega (HU-033)
// ---------------------------------------------------------------------------------------------
export function ModalPreparacionCentral({ datos, onClose, onHecho, onConflicto }) {
  const toast = useToast();
  const intento = useIntento();
  const [p, setP] = useState(null);
  const [estado, setEstado] = useState(""); const [origen, setOrigen] = useState("Registro interno");
  const [accesorios, setAccesorios] = useState(""); const [obs, setObs] = useState("");
  const [err, setErr] = useState({}); const [enviando, setEnviando] = useState(false); const [pendientes, setPendientes] = useState(null);
  const etapa = datos?.etapa;
  const clave = datos ? `${datos.unidad?.coduni}|${datos.etapa}|${datos.estado || ""}` : "";
  useEffect(() => {
    if (!datos) return;
    setP(datos.preparacion);
    const t = techoDe(datos.preparacion);
    setEstado(datos.estado || (datos.etapa === "Armado" ? (datos.preparacion?.armado === "Armado terminado" ? "Pendiente de armado" : "Armado terminado") : datos.etapa === "Techo" ? (t.avance === "Pendiente" ? "En proceso" : t.avance === "En proceso" ? "Instalado" : t.avance) : "Lista para entrega"));
    setOrigen("Registro interno"); setAccesorios(""); setObs(""); setErr({}); setPendientes(null);
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!datos || !p) return null;
  const { unidad } = datos;
  const t = techoDe(p);
  const deportivo = Boolean(p.techo?.requiere_proveedor);
  const conProveedor = deportivo && Boolean(p.techo?.proveedor);
  const retrocede = (etapa === "Armado" && p.armado === "Armado terminado" && estado === "Pendiente de armado")
    || (etapa === "Techo" && t.avance === "Instalado" && estado !== "Instalado");
  const faltan = etapa === "Entrega" ? (pendientes || p.pendientes || []) : [];

  function validar() {
    const x = {};
    if (etapa === "Armado" && !["Pendiente de armado", "Armado terminado"].includes(estado)) x.estado = "Elige el estado del armado.";
    if (etapa === "Techo") {
      if (!t.requiereInstalacion) x.estado = t.avance === "Por definir" ? "Primero define la configuración de techo en la ficha." : "La configuración actual no requiere instalar techo.";
      else if (!["Pendiente", "En proceso", "Instalado"].includes(estado)) x.estado = "Elige el avance del techo.";
      else if (estado === t.avance && !limpio(accesorios)) x.estado = "Ese ya es el avance registrado.";
      if (origen === "Aviso de proveedor" && !conProveedor) x.origen = "El aviso de proveedor aplica solo al techo deportivo con su fibrera.";
      if (limpio(accesorios) && !deportivo) x.accesorios = "Solo el techo deportivo admite detalle de accesorios.";
      else if (largo(accesorios) > 250) x.accesorios = "Máximo 250 caracteres.";
    }
    if (etapa === "Entrega" && !p.condiciones_cumplidas) x.general = "Todavía faltan etapas para la entrega.";
    if (retrocede && largo(obs) < 5) x.obs = "Explica por qué vuelve atrás (mínimo 5 caracteres).";
    if (largo(obs) > 500) x.obs = "La observación admite hasta 500 caracteres.";
    setErr(x);
    return Object.keys(x).length === 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    const cuerpo = { etapa, estado, observacion: limpio(obs) || null, version: String(p.version ?? "0"),
      ...(etapa === "Techo" ? { origen, accesorios: limpio(accesorios) || null } : {}) };
    setEnviando(true); setPendientes(null);
    try {
      const r = await actualizarPreparacionApi(unidad.coduni, cuerpo, intento(JSON.stringify({ u: unidad.coduni, ...cuerpo })));
      toast(r.message || "Preparación actualizada");
      onHecho?.(r.data);
      onClose();
    } catch (er) {
      const d = er.detalle || {};
      if (er.status === 409 && d.pendientes) { setPendientes(d.pendientes); if (d.actual) setP(d.actual); setErr({ general: er.message }); }
      else if (er.status === 409 && d.actual) { setP(d.actual); setErr({ general: `${er.message}. Se cargó la información vigente: revísala y vuelve a registrar si corresponde.` }); onConflicto?.(); }
      else setErr({ general: sinRespuesta(er) ? NO_CONFIRMADO : mensajeError(er) });
    } finally { setEnviando(false); }
  }

  const titulo = etapa === "Armado" ? "Armado" : etapa === "Techo" ? "Avance del techo" : "Condición de entrega";
  const confirmacion = etapa === "Entrega" ? `Motor ${unidad.nummotuni} quedará lista para entrega. No significa entregada al comprador.` : `Motor ${unidad.nummotuni}: ${etapa === "Armado" ? estado.toLowerCase() : `techo ${estado.toLowerCase()}`}${origen === "Aviso de proveedor" ? `, según aviso de ${p.techo?.proveedor}` : ""}. La ubicación y la situación comercial no cambian.`;
  return (
    <Modal abierto onClose={onClose} titulo={titulo} ancho="max-w-xl"
      confirmarGuardar={{ titulo: "¿Registrar este avance?", texto: confirmacion, boton: "Sí, registrar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-prep-central" className="btn btn-primary !py-2" disabled={enviando || (etapa === "Entrega" && !p.condiciones_cumplidas)}>{enviando ? "Registrando…" : "Registrar"}</button></>}>
      <form id="f-prep-central" onSubmit={guardar} className="space-y-4" noValidate>
        <CabeceraUnidad unidad={unidad} />
        {etapa === "Armado" && (
          <fieldset>
            <legend className="field-label">Estado del armado</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {["Pendiente de armado", "Armado terminado"].map((op) => (
                <label key={op} className={`cursor-pointer rounded-xl border-2 p-3 text-[14px] font-semibold transition ${estado === op ? "border-marino-700 bg-marino-50 text-marino dark:border-white/50 dark:bg-white/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>
                  <input type="radio" className="sr-only" checked={estado === op} onChange={() => setEstado(op)} />{op}{p.armado === op ? <span className="block text-[12px] font-normal text-slate-400">Registrado ahora</span> : null}
                </label>
              ))}
            </div>
            {err.estado && <p className="mt-1 text-[12px] font-medium text-acento">{err.estado}</p>}
          </fieldset>
        )}
        {etapa === "Techo" && <>
          <div className="rounded-xl border border-slate-200 px-4 py-3 text-[13.5px] dark:border-white/10">
            <p><span className="text-slate-500">Configuración:</span> <b className="text-marino dark:text-white">{t.config}</b>{t.proveedor ? `, ${t.proveedor}` : ""}</p>
            <p className="mt-0.5"><span className="text-slate-500">Avance registrado:</span> <b className="text-marino dark:text-white">{t.avance}</b></p>
          </div>
          {t.requiereInstalacion ? (
            <fieldset>
              <legend className="field-label">Nuevo avance</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {["Pendiente", "En proceso", "Instalado"].map((op) => (
                  <label key={op} className={`cursor-pointer rounded-xl border-2 p-3 text-center text-[14px] font-semibold transition ${estado === op ? "border-marino-700 bg-marino-50 text-marino dark:border-white/50 dark:bg-white/10 dark:text-white" : "border-slate-200 text-slate-500 dark:border-white/10"}`}>
                    <input type="radio" className="sr-only" checked={estado === op} onChange={() => setEstado(op)} />{op}
                  </label>
                ))}
              </div>
              {err.estado && <p className="mt-1 text-[12px] font-medium text-acento">{err.estado}</p>}
            </fieldset>
          ) : <Aviso tipo="aviso">{t.avance === "Por definir" ? "Primero define la configuración de techo en la ficha de la unidad." : "La configuración actual no requiere instalar techo."}</Aviso>}
          {conProveedor && (
            <Campo etiqueta="¿Quién informa el avance?" error={err.origen}>
              <select id="prep-origen" className="field-input" value={origen} onChange={(e) => setOrigen(e.target.value)}>
                <option value="Registro interno">Lo verificó el equipo de EPSA</option>
                <option value="Aviso de proveedor">Aviso de {p.techo.proveedor} (por WhatsApp)</option>
              </select>
            </Campo>
          )}
          {origen === "Aviso de proveedor" && <p className="-mt-2 text-[12.5px] text-slate-500">El aviso no cambia la ubicación: la moto sigue en {unidad.ubicacion?.nomubi || "su ubicación"} hasta que registres su traslado.</p>}
          {deportivo && (
            <Campo etiqueta="Accesorios del techo deportivo (opcional)" error={err.accesorios} ayuda="Solo lo que realmente lleva, por ejemplo cámara de retroceso o sonido. No se presume nada.">
              <input id="prep-accesorios" className="field-input" maxLength={270} value={accesorios} onChange={(e) => setAccesorios(e.target.value)} />
            </Campo>
          )}
        </>}
        {etapa === "Entrega" && (
          p.condiciones_cumplidas
            ? <Aviso tipo="ok">Armado terminado y techo {t.avance === "No requiere" ? "sin instalación pendiente" : "instalado"}. Puedes marcarla lista para entrega. Preparación terminada no equivale a entregada al comprador.</Aviso>
            : <div data-pendientes><Aviso tipo="aviso"><b>Todavía no puede marcarse lista para entrega.</b> Falta:<ul className="mt-1 list-disc pl-5">{faltan.map((x) => <li key={x}>{x}</li>)}</ul></Aviso></div>
        )}
        <Campo etiqueta={retrocede ? "Motivo del cambio" : "Observación (opcional)"} error={err.obs} ayuda={`${largo(obs)}/500`}>
          <textarea id="prep-obs" className="field-input" rows={2} maxLength={540} value={obs} onChange={(e) => setObs(e.target.value)} />
        </Campo>
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
      </form>
    </Modal>
  );
}

