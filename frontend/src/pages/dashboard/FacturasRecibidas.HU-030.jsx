// HU-030 · Facturas recibidas por correo (gerente y administradora)
// Gmail → Apps Script cada 15 minutos → API protegida → lectura del XML → registro en la base central.
// Aquí se revisan los documentos, se confirman equivalencias de modelos y se configura el proceso.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link } from "../../components/dashboard/LinkPanel";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { ajustesImportacionApi, documentosApi, equivalenciasApi, generarCredencialApi, guardarAjustesImportacionApi, guardarEquivalenciaApi, revocarCredencialApi, useConsultaCentral } from "../../servicios/central";
import { Aviso, Campo, Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, useConfirm, useToast } from "../../components/ui";
import { Pestanas, Pill } from "../../components/dashboard/Sprint2";
import { AvisoConexion, BarraActualizacion, Paginador, fechaCompleta, sinApi } from "../../components/dashboard/Central";

export const TONO_DOCUMENTO = { Importado: "verde", "Pendiente de revisión": "ambar", Error: "rojo", Descartado: "gris", "Resuelto manualmente": "celeste", Recibido: "gris" };
const ESTADOS = ["Incidencias", "Importado", "Pendiente de revisión", "Error", "Resuelto manualmente", "Descartado"];
const LIMITE = 50;
const REMITENTE = /^([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|@[a-z0-9.-]+\.[a-z]{2,})$/;

export default function FacturasRecibidas() {
  const [params, setParams] = useSearchParams();
  const pestana = params.get("pestana") || "documentos";
  const cambiar = (p) => setParams(p === "documentos" ? {} : { pestana: p });
  if (!MODO_REAL) {
    return (
      <div>
        <PageHeader titulo="Facturas recibidas" subtitulo="Facturas de Crosland que llegan por correo y registran solas la compra y sus motos." />
        <Aviso>Aquí aparecen las facturas que llegan al correo de compras. En la vista de ejemplo no hay correos que leer.</Aviso>
      </div>
    );
  }
  return (
    <div>
      <PageHeader titulo="Facturas recibidas" subtitulo="Las facturas de Crosland llegan a Gmail; cada 15 minutos el proceso automático las envía al sistema, que registra la compra y una ficha por moto en Ancón. Aquí revisas cada documento y sus incidencias." />
      <div className="mb-5">
        <Pestanas etiqueta="Secciones" valor={pestana} onCambio={cambiar} opciones={[{ id: "documentos", label: "Documentos" }, { id: "equivalencias", label: "Equivalencias de modelos" }, { id: "ajustes", label: "Ajustes del proceso" }]} />
      </div>
      {pestana === "documentos" && <Documentos />}
      {pestana === "equivalencias" && <Equivalencias codigoInicial={params.get("codigo") || ""} />}
      {pestana === "ajustes" && <Ajustes />}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Documentos recibidos
// ---------------------------------------------------------------------------------------------
function Documentos() {
  const [estado, setEstado] = useState("");
  const [offset, setOffset] = useState(0);
  const consulta = useConsultaCentral(() => documentosApi({ estado: estado || undefined, limite: LIMITE, offset }), [estado, offset]);
  const datos = consulta.data;
  const por = datos?.por_estado || {};
  const n = (e) => (e === "Incidencias" ? Number(por["Pendiente de revisión"] || 0) + Number(por.Error || 0) : Number(por[e] || 0));
  const total = Object.values(por).reduce((a, b) => a + Number(b), 0);
  if (sinApi(consulta)) return <AvisoConexion consulta={consulta} que="los documentos" />;

  return (
    <div>
      <AvisoConexion consulta={consulta} que="los documentos" />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Recibidos" valor={total} nota="Desde la fecha de inicio" />
        <Stat etiqueta="Importados" valor={n("Importado")} tono="verde" nota="Compra y motos registradas" />
        <Stat etiqueta="Por revisar" valor={n("Pendiente de revisión")} tono="ambar" nota="Código nuevo, compra previa o duplicado" />
        <Stat etiqueta="Con error" valor={n("Error")} tono="rojo" nota="No se importó nada" />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Estado">
          {[{ id: "", t: "Todos", k: total }, ...ESTADOS.map((e) => ({ id: e, t: e, k: n(e) }))].map((o) => (
            <button key={o.id || "todos"} type="button" aria-pressed={estado === o.id} onClick={() => { setEstado(o.id); setOffset(0); }}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${estado === o.id ? "border-marino-700 bg-marino-700 text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-white/70"}`}>
              {o.t}<span className="cifra ml-1.5 opacity-70">{o.k}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2"><BarraActualizacion consulta={consulta} /></div>
      </div>
      {datos && datos.documentos.length === 0 ? (
        <Vacio titulo={estado ? "No hay documentos con ese estado" : "Todavía no llegan facturas"} texto={estado ? "Prueba con otro estado." : "Cuando el proceso automático lea la primera factura de Crosland, aparecerá aquí. Revisa los Ajustes del proceso: fecha de inicio, remitentes y credencial."} />
      ) : datos && (
        <>
          <Tabla columnas={["Factura", "Recibida", "Emisión", "Estado", "Vehículos", "Intentos", ""]}>
            {datos.documentos.map((d) => (
              <tr key={d.coddoc} className="align-top" data-documento={d.coddoc} data-estado={d.estado}>
                <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/facturas-recibidas/${d.coddoc}`}>{d.numero || "Sin número legible"}</Link><span className="block text-[12px] text-slate-400">{d.razon_emisor || "Emisor sin leer"}</span>{d.reenvio_distinto && <span className="mt-1 block text-[11.5px] font-semibold text-amber-700">Se reenvió con otro contenido</span>}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCompleta(d.recibido || d.fecha_registro)}<span className="block text-[12px] text-slate-400">{d.remitente}</span></td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{d.fecha_emision || "—"}</td>
                <td className="max-w-[300px] px-4 py-3"><Pill tono={TONO_DOCUMENTO[d.estado]}>{d.estado}</Pill>{d.motivo && <span className="mt-1 block text-[12px] text-slate-500">{d.motivo}</span>}</td>
                <td className="px-4 py-3 text-[13px]"><b className="cifra text-marino dark:text-white">{d.unidades_registradas}</b> de {d.vehiculos} registrada{Number(d.vehiculos) === 1 ? "" : "s"}{Number(d.lineas_excluidas) > 0 && <span className="block text-[12px] text-slate-400">{d.lineas_excluidas} línea(s) excluida(s): no son vehículos</span>}</td>
                <td className="px-4 py-3 text-slate-500">{d.intentos}</td>
                <td className="px-4 py-3"><Link className={btnMini} to={`/admin/facturas-recibidas/${d.coddoc}`}>Revisar</Link></td>
              </tr>
            ))}
          </Tabla>
          <Paginador total={Number(datos.total)} limite={LIMITE} offset={offset} onCambio={setOffset} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Equivalencias: código de material del proveedor → modelo interno (sin coincidencias por nombre)
// ---------------------------------------------------------------------------------------------
function Equivalencias({ codigoInicial }) {
  const toast = useToast();
  const consulta = useConsultaCentral(() => equivalenciasApi(), []);
  const [modelos, setModelos] = useState(null);
  const [editar, setEditar] = useState(null);
  useEffect(() => { api.modelosAdminApi().then((r) => setModelos(Array.isArray(r.data) ? r.data : [])).catch(() => setModelos([])); }, []);
  const datos = consulta.data;
  useEffect(() => {
    if (!codigoInicial || !datos || editar) return;
    const p = datos.codigos_pendientes.find((c) => c.codigo_material === codigoInicial);
    if (p) setEditar({ ruc_proveedor: p.ruc_proveedor, codigo_material: p.codigo_material, descripcion: p.descripcion, tipo: "Vehículo", codmod: "", estado: "Verificada", observacion: "" });
  }, [codigoInicial, datos]); // eslint-disable-line react-hooks/exhaustive-deps
  if (sinApi(consulta)) return <AvisoConexion consulta={consulta} que="las equivalencias" />;

  return (
    <div>
      <AvisoConexion consulta={consulta} que="las equivalencias" />
      <p className="mb-4 max-w-3xl text-[13.5px] text-slate-500">Cada código de material de Crosland (SellersItemIdentification/ID del XML) se relaciona con un modelo del sistema. Solo se importan motos con una equivalencia <b>verificada</b>; nunca se adivina por el nombre ni se crea un modelo automáticamente.</p>
      {datos?.codigos_pendientes?.length > 0 && (
        <section className="mb-6" data-codigos-pendientes>
          <h2 className="mb-2 text-[15px] font-bold text-marino dark:text-white">Códigos por revisar</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {datos.codigos_pendientes.map((c) => (
              <Card key={`${c.ruc_proveedor}-${c.codigo_material}`} data-codigo={c.codigo_material}>
                <p className="font-mono text-[15px] font-bold text-marino dark:text-white">{c.codigo_material}</p>
                <p className="mt-0.5 text-[13px] text-slate-500">{c.descripcion || "Sin descripción"}{c.modelo_texto ? `. Modelo en el XML: ${c.modelo_texto}` : ""}</p>
                <p className="mt-1 text-[12.5px] text-slate-400">Aparece en {c.lineas} línea(s) de {c.documentos} documento(s) pendientes.</p>
                <button className="btn btn-primary mt-3 !py-2 text-[13.5px]" onClick={() => setEditar({ ruc_proveedor: c.ruc_proveedor, codigo_material: c.codigo_material, descripcion: c.descripcion, tipo: "Vehículo", codmod: "", estado: "Verificada", observacion: "" })}>Confirmar equivalencia</button>
              </Card>
            ))}
          </div>
        </section>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold text-marino dark:text-white">Equivalencias registradas</h2>
        <div className="flex flex-wrap items-center gap-2">
          <BarraActualizacion consulta={consulta} />
          <button className="btn btn-secondary !py-2.5" onClick={() => setEditar({ ruc_proveedor: "", codigo_material: "", tipo: "Vehículo", codmod: "", estado: "Verificada", observacion: "", nueva: true })}>+ Nueva equivalencia</button>
        </div>
      </div>
      {datos && datos.equivalencias.length === 0 ? <Vacio titulo="Aún no hay equivalencias" texto="Confirma el primer código cuando llegue una factura con un código nuevo, por ejemplo B3-4TLPG250UG4V." /> : datos && (
        <Tabla columnas={["Código de material", "Proveedor", "Tipo", "Modelo del sistema", "Estado", "Actualizado", ""]}>
          {datos.equivalencias.map((e) => (
            <tr key={e.codeqm} className="align-top" data-equivalencia={e.codigo_material}>
              <td className="px-4 py-3 font-mono font-semibold text-marino dark:text-white">{e.codigo_material}{e.observacion && <span className="block font-sans text-[12px] font-normal text-slate-400">{e.observacion}</span>}</td>
              <td className="px-4 py-3">{e.proveedor}<span className="block text-[12px] text-slate-400">RUC {e.ruc_proveedor}</span></td>
              <td className="px-4 py-3">{e.tipo === "Excluido" ? "No es vehículo" : "Vehículo"}</td>
              <td className="px-4 py-3">{e.modelo ? <>{e.modelo.nommod}{e.modelo.estmod !== "Publicado" && <span className="block text-[12px] text-slate-400">{e.modelo.estmod}</span>}</> : "—"}</td>
              <td className="px-4 py-3"><Pill tono={e.estado === "Verificada" ? "verde" : e.estado === "Por revisar" ? "ambar" : "gris"}>{e.estado}</Pill></td>
              <td className="whitespace-nowrap px-4 py-3 text-[12.5px] text-slate-500">{fechaCompleta(e.actualizado)}<span className="block">{e.autor}</span></td>
              <td className="px-4 py-3"><button className={btnMini} onClick={() => setEditar({ ruc_proveedor: e.ruc_proveedor, codigo_material: e.codigo_material, tipo: e.tipo, codmod: e.modelo?.codmod || "", estado: e.estado, observacion: e.observacion || "" })}>Editar</button></td>
            </tr>
          ))}
        </Tabla>
      )}
      <ModalEquivalencia datos={editar} modelos={modelos} onClose={() => setEditar(null)} onGuardado={() => { consulta.refrescar(true); toast("Equivalencia guardada. Reintenta los documentos pendientes para aplicarla."); }} />
    </div>
  );
}

function ModalEquivalencia({ datos, modelos, onClose, onGuardado }) {
  const [f, setF] = useState(null);
  const [err, setErr] = useState({}); const [enviando, setEnviando] = useState(false);
  useEffect(() => { setF(datos); setErr({}); }, [datos]);
  if (!datos || !f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  function validar() {
    const x = {};
    const codigo = String(f.codigo_material || "").trim().toUpperCase();
    if (!codigo) x.codigo_material = "Escribe el código de material tal como figura en el XML.";
    else if (codigo.length > 60 || !/^[A-Z0-9][A-Z0-9 ./_-]*$/.test(codigo)) x.codigo_material = "Solo letras, números, espacios, puntos, guiones o barras (máximo 60).";
    if (f.ruc_proveedor && !/^\d{11}$/.test(f.ruc_proveedor)) x.ruc_proveedor = "El RUC tiene 11 dígitos.";
    if (f.tipo === "Vehículo" && !f.codmod) x.codmod = "Elige el modelo del sistema que corresponde a este código.";
    if (String(f.observacion || "").trim().length > 500) x.observacion = "Máximo 500 caracteres.";
    setErr(x);
    return Object.keys(x).length === 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    setEnviando(true);
    try {
      await guardarEquivalenciaApi({ ruc_proveedor: f.ruc_proveedor || null, codigo_material: String(f.codigo_material).trim().toUpperCase(), tipo: f.tipo,
        codmod: f.tipo === "Vehículo" ? f.codmod : null, estado: f.estado, observacion: String(f.observacion || "").trim() || null });
      onGuardado(); onClose();
    } catch (er) { setErr({ general: mensajeError(er) }); }
    finally { setEnviando(false); }
  }
  const m = (modelos || []).find((x) => String(x.codmod) === String(f.codmod));
  return (
    <Modal abierto onClose={onClose} titulo={f.nueva ? "Nueva equivalencia" : `Equivalencia de ${f.codigo_material}`} ancho="max-w-lg"
      confirmarGuardar={{ titulo: "¿Guardar la equivalencia?", texto: f.tipo === "Vehículo" ? `Las líneas con el código ${String(f.codigo_material).toUpperCase()} se registrarán como ${m?.nommod || "el modelo elegido"}${f.estado === "Verificada" ? "" : " cuando la marques como verificada"}. No crea ni publica modelos.` : `Las líneas con el código ${String(f.codigo_material).toUpperCase()} no entran al inventario de vehículos.`, boton: "Guardar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-equivalencia" className="btn btn-primary !py-2" disabled={enviando}>{enviando ? "Guardando…" : "Guardar"}</button></>}>
      <form id="f-equivalencia" onSubmit={guardar} className="grid gap-4" noValidate>
        {f.descripcion && <p className="rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600 dark:bg-white/5 dark:text-white/70">En el XML: {f.descripcion}</p>}
        <Campo etiqueta="Código de material" error={err.codigo_material}><input id="eq-codigo" className="field-input font-mono uppercase" maxLength={60} value={f.codigo_material} disabled={!f.nueva} onChange={set("codigo_material")} placeholder="B3-4TLPG250UG4V" /></Campo>
        {f.nueva && <Campo etiqueta="RUC del proveedor (vacío = Crosland)" error={err.ruc_proveedor}><input className="field-input" inputMode="numeric" maxLength={11} value={f.ruc_proveedor} onChange={(e) => setF({ ...f, ruc_proveedor: e.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="20502913752" /></Campo>}
        <Campo etiqueta="¿Qué es?">
          <select id="eq-tipo" className="field-input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value, codmod: e.target.value === "Vehículo" ? f.codmod : "" })}>
            <option value="Vehículo">Un vehículo de este modelo</option><option value="Excluido">No es vehículo (aceite, accesorio, bonificación)</option>
          </select>
        </Campo>
        {f.tipo === "Vehículo" && (
          <Campo etiqueta="Modelo del sistema" error={err.codmod} ayuda="Elige el modelo exacto: nunca se asigna por parecido del nombre.">
            <select id="eq-modelo" className="field-input" value={f.codmod} onChange={set("codmod")}>
              <option value="">{modelos === null ? "Cargando modelos…" : "Elige el modelo"}</option>
              {(modelos || []).map((x) => <option key={x.codmod} value={x.codmod}>{x.nommod}{x.estmod !== "Publicado" ? ` (${x.estmod})` : ""}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Estado">
          <select className="field-input" value={f.estado} onChange={set("estado")}>
            <option value="Verificada">Verificada: se usa al importar</option><option value="Por revisar">Por revisar: aún no se usa</option><option value="Inactiva">Inactiva</option>
          </select>
        </Campo>
        <Campo etiqueta="Observación (opcional)" error={err.observacion}><input className="field-input" maxLength={520} value={f.observacion} onChange={set("observacion")} placeholder="Ej: confirmado con Crosland el 18/10" /></Campo>
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------------------------
// Ajustes: fecha de inicio, remitentes autorizados, ubicación de ingreso y credencial técnica
// ---------------------------------------------------------------------------------------------
function Ajustes() {
  const { puede } = useAuth();
  const gerente = puede("importacion.configurar");
  const toast = useToast(); const confirmar = useConfirm();
  const consulta = useConsultaCentral(() => ajustesImportacionApi(), [], { intervalo: 60000 });
  const datos = consulta.data;
  const [f, setF] = useState(null);
  const [almacenes, setAlmacenes] = useState([]);
  const [err, setErr] = useState({}); const [guardando, setGuardando] = useState(false);
  const [credencial, setCredencial] = useState(null);
  useEffect(() => { api.listarUbicaciones().then((r) => setAlmacenes((r.data || []).filter((l) => l.tipubi === "Almacen" && l.estubi))).catch(() => setAlmacenes([])); }, []);
  useEffect(() => {
    if (datos && !f) setF({ fecha: datos.fecha_corte || "", remitentes: (datos.remitentes || []).join("\n"), codubi: datos.ubicacion_ingreso?.codubi || "" });
  }, [datos]); // eslint-disable-line react-hooks/exhaustive-deps
  const lista = useMemo(() => (f?.remitentes || "").split(/[\n,;]+/).map((r) => r.trim().toLowerCase()).filter(Boolean), [f?.remitentes]);

  function validar() {
    const x = {};
    const hoy = new Date();
    const max = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 31).toLocaleDateString("en-CA");
    if (f.fecha && !/^\d{4}-\d{2}-\d{2}$/.test(f.fecha)) x.fecha = "Elige una fecha válida.";
    else if (f.fecha && (f.fecha < "2020-01-01" || f.fecha > max)) x.fecha = "La fecha de inicio debe estar entre 2020 y el próximo mes.";
    if (lista.length > 20) x.remitentes = "Máximo 20 remitentes.";
    else if (lista.some((r) => r.length > 254 || !REMITENTE.test(r))) x.remitentes = `Revisa: ${lista.filter((r) => !REMITENTE.test(r)).join(", ")}. Usa correos completos o un dominio con @ (por ejemplo @crosland.com.pe).`;
    else if (new Set(lista).size !== lista.length) x.remitentes = "Hay remitentes repetidos.";
    if (f.fecha && lista.length === 0) x.remitentes = "Para activar la automatización registra al menos un remitente autorizado.";
    setErr(x);
    return Object.keys(x).length === 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (guardando || !validar()) return;
    const texto = f.fecha ? `Se importarán las facturas recibidas desde el ${f.fecha} y enviadas por ${lista.join(", ")}. Las anteriores no se cargan automáticamente.` : "La automatización quedará pausada: no se importará ninguna factura nueva.";
    if (!(await confirmar({ titulo: "¿Guardar los ajustes?", texto, boton: "Guardar ajustes" }))) return;
    setGuardando(true);
    try {
      await guardarAjustesImportacionApi({ fecha_corte: f.fecha || null, remitentes: lista, codubi_ingreso: f.codubi || null });
      toast("Ajustes de la importación guardados");
      setF(null); consulta.refrescar(true);
    } catch (er) { setErr({ general: mensajeError(er) }); }
    finally { setGuardando(false); }
  }
  async function generar() {
    if (!(await confirmar({ titulo: datos?.credencial?.activa ? "¿Generar una credencial nueva?" : "¿Generar la credencial?", texto: datos?.credencial?.activa ? "La credencial actual dejará de funcionar de inmediato y habrá que actualizarla en la lectura del correo." : "Se mostrará una sola vez, para configurar la lectura automática del correo.", boton: "Generar" }))) return;
    try { const r = await generarCredencialApi(); setCredencial(r.data); consulta.refrescar(true); }
    catch (er) { toast(mensajeError(er), "error"); }
  }
  async function revocar() {
    if (!(await confirmar({ titulo: "¿Revocar la credencial?", texto: "Las facturas del correo dejarán de registrarse solas hasta que generes otra.", boton: "Revocar", peligro: true }))) return;
    try { await revocarCredencialApi(); setCredencial(null); consulta.refrescar(true); toast("Credencial revocada: la lectura automática del correo se detiene"); }
    catch (er) { toast(mensajeError(er), "error"); }
  }

  if (!datos || !f) return <div><AvisoConexion consulta={consulta} que="los ajustes" />{!consulta.error && <p className="py-10 text-center text-slate-400">Cargando ajustes…</p>}</div>;
  return (
    <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-marino dark:text-white">Qué facturas se importan</h2>
          <Pill tono={datos.activa ? "verde" : "gris"}>{datos.activa ? "Automatización activa" : "Automatización pausada"}</Pill>
        </div>
        <p className="mt-1 text-[13px] text-slate-500">Solo facturas (tipo 01) del proveedor autorizado y dirigidas al RUC de EPSA Motor ({datos.ruc_epsa}). Cotizaciones, notas de crédito u otros documentos no crean stock.</p>
        <form onSubmit={guardar} className="mt-5 grid gap-4" noValidate>
          <Campo etiqueta="Fecha de inicio" error={err.fecha} ayuda="Se importan solo las facturas emitidas desde esta fecha. Vacía = automatización pausada. Las anteriores necesitan conciliación antes de cargarse.">
            <input id="aj-fecha" type="date" className="field-input sm:max-w-xs" value={f.fecha} disabled={!gerente} onChange={(e) => setF({ ...f, fecha: e.target.value })} />
          </Campo>
          <Campo etiqueta="Remitentes autorizados" error={err.remitentes} ayuda="Uno por línea: un correo completo o un dominio con @ (por ejemplo @crosland.com.pe). Máximo 20.">
            <textarea id="aj-remitentes" className="field-input font-mono text-[13px]" rows={3} value={f.remitentes} disabled={!gerente} onChange={(e) => setF({ ...f, remitentes: e.target.value })} placeholder="@crosland.com.pe" />
          </Campo>
          <Campo etiqueta="Ubicación inicial de las motos importadas" ayuda="Las motos de la factura empiezan aquí. No significa recibidas en una sede.">
            <select id="aj-ubicacion" className="field-input sm:max-w-sm" value={f.codubi} disabled={!gerente} onChange={(e) => setF({ ...f, codubi: e.target.value })}>
              {!almacenes.some((a) => String(a.codubi) === String(f.codubi)) && f.codubi && <option value={f.codubi}>{datos.ubicacion_ingreso?.nomubi}</option>}
              {!f.codubi && <option value="">Sin definir</option>}
              {almacenes.map((a) => <option key={a.codubi} value={String(a.codubi)}>{a.nomubi}</option>)}
            </select>
          </Campo>
          <div className="rounded-lg bg-slate-50 px-4 py-3 text-[13px] dark:bg-white/5">
            <p className="font-semibold text-marino dark:text-white">Proveedores autorizados</p>
            <ul className="mt-1 text-slate-500">{(datos.proveedores || []).map((p) => <li key={p.ruc}>{p.razon_social}, RUC {p.ruc}{p.activo ? "" : " (inactivo)"}</li>)}</ul>
          </div>
          {err.general && <Aviso tipo="error">{err.general}</Aviso>}
          {gerente ? <div className="flex flex-wrap items-center gap-3"><button className="btn btn-primary" disabled={guardando}>{guardando ? "Guardando…" : "Guardar ajustes"}</button>{datos.actualizado && <span className="text-[12.5px] text-slate-400">Última modificación: {fechaCompleta(datos.actualizado)}{datos.actualizado_por ? `, ${datos.actualizado_por}` : ""}</span>}</div>
            : <p className="text-[12.5px] text-slate-400">Solo el gerente cambia estos ajustes. Tu rol puede consultarlos.</p>}
        </form>
      </Card>

      <div className="space-y-6">
        <Card>
          <h2 className="text-lg font-bold text-marino dark:text-white">Credencial de la lectura del correo</h2>
          <p className="mt-1 text-[13px] text-slate-500">Permite que las facturas del correo de compras se registren solas. Solo sirve para eso y no es la contraseña de ninguna persona. Se guarda cifrada y se muestra una sola vez.</p>
          <p className="mt-3 text-[13.5px]">{datos.credencial?.activa ? <>Activa, termina en <b className="font-mono">…{datos.credencial.termina_en}</b>. Creada {fechaCompleta(datos.credencial.creada)}{datos.credencial.creada_por ? ` por ${datos.credencial.creada_por}` : ""}.</> : <span className="font-semibold text-acento">Sin credencial: las facturas del correo no se registran solas.</span>}</p>
          {credencial && (
            <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-500/40 dark:bg-emerald-500/10" data-credencial-nueva>
              <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-200">Cópiala ahora: no se volverá a mostrar.</p>
              <p className="mt-2 break-all rounded-md bg-white px-3 py-2 font-mono text-[12.5px] text-marino dark:bg-black/30 dark:text-white">{credencial.credencial}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-secondary !py-1.5 text-[13px]" onClick={() => { try { navigator.clipboard.writeText(credencial.credencial); toast("Credencial copiada"); } catch { toast("Selecciónala y cópiala a mano", "error"); } }}>Copiar</button>
                <button className="btn btn-secondary !py-1.5 text-[13px]" onClick={() => setCredencial(null)}>Ya la guardé</button>
              </div>
            </div>
          )}
          {gerente && <div className="mt-4 flex flex-wrap gap-2"><button className="btn btn-primary !py-2" onClick={generar}>{datos.credencial?.activa ? "Generar otra" : "Generar credencial"}</button>{datos.credencial?.activa && <button className="btn btn-secondary !py-2" onClick={revocar}>Revocar</button>}</div>}
          {!gerente && <p className="mt-3 text-[12.5px] text-slate-400">Solo el gerente genera o revoca la credencial.</p>}
        </Card>
        <Card>
          <h2 className="font-bold text-marino dark:text-white">Cómo funciona</h2>
          <ul className="mt-2 space-y-1.5 text-[13px] text-slate-600 dark:text-white/70">
            <li>Cada 15 minutos se revisa el correo de compras de la empresa.</li>
            <li>Las facturas de Crosland que cumplen estos ajustes registran la compra y sus motos en la ubicación inicial, pendientes de armado.</li>
            <li>Si un código de producto no tiene su modelo confirmado, o la factura no coincide con una compra, el documento queda por revisar y no se crea nada a ciegas.</li>
            <li>Un mismo correo recibido dos veces no duplica la compra.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
