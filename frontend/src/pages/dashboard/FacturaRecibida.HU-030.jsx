// HU-030 · Evidencia de un documento recibido por correo y resolución de sus incidencias
// Muestra la factura, sus fechas (emisión, recepción e importación), líneas, unidades, compras y el historial,
// con cada operación atribuida al proceso automático o a la persona que la resolvió.
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Link } from "../../components/dashboard/LinkPanel";
import { mensajeError } from "../../lib/errores";
import { abrirBlob, archivoDocumentoApi, documentoApi, reintentarDocumentoApi, resolverDocumentoApi, sinRespuesta, useConsultaCentral } from "../../servicios/central";
import { Aviso, Campo, Card, Modal, PageHeader, btnMini, useConfirm, useToast } from "../../components/ui";
import { EstadoConexion, Pill } from "../../components/dashboard/Sprint2";
import { AvisoConexion, BarraActualizacion, ColorUnidad, fechaCompleta } from "../../components/dashboard/Central";
import { TONO_DOCUMENTO } from "./FacturasRecibidas.HU-030";

const TONO_LINEA = { Importada: "verde", Excluida: "gris", "Pendiente de revisión": "ambar", Error: "rojo", Recibida: "gris" };
const ABIERTO = ["Pendiente de revisión", "Error", "Recibido"];

export default function FacturaRecibidaRuta() {
  const { id } = useParams();
  return <FacturaRecibida key={id} id={id} />;
}

function FacturaRecibida({ id }) {
  const toast = useToast(); const confirmar = useConfirm();
  const valido = /^[1-9]\d{0,18}$/.test(String(id));
  const consulta = useConsultaCentral(() => documentoApi(id), [id], { activo: valido });
  const d = consulta.data;
  const [resolver, setResolver] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const candidatos = useMemo(() => {
    const m = new Map();
    for (const l of d?.lineas || []) for (const c of l.detalle?.candidatos || []) m.set(c.codcom, c);
    return [...m.values()];
  }, [d]);
  const codigosSinEquivalencia = useMemo(() => [...new Set((d?.lineas || []).filter((l) => l.estado === "Pendiente de revisión" && /equivalencia/i.test(l.motivo || "")).map((l) => l.codigo_material).filter(Boolean))], [d]);

  if (!valido || (consulta.error?.status === 404 && !consulta.error?.detalle?.sinRuta && !d)) return <div className="space-y-3"><Aviso tipo="error">No encontramos ese documento.</Aviso><Link className="btn btn-secondary" to="/admin/facturas-recibidas">Volver a facturas recibidas</Link></div>;
  if (!d) return <div><AvisoConexion consulta={consulta} que="el documento" />{!consulta.error && <p className="py-10 text-center text-slate-400">Cargando el documento…</p>}</div>;

  const abierto = ABIERTO.includes(d.estado);
  async function archivo(tipo, descargar) {
    try { abrirBlob(await archivoDocumentoApi(d.coddoc, tipo), descargar); }
    catch (er) { toast(mensajeError(er), "error"); }
  }
  async function reintentar() {
    if (!(await confirmar({ titulo: "¿Reintentar la importación?", texto: "Se vuelve a procesar el XML guardado con las equivalencias y compras actuales. No duplica compras ni motos ya registradas.", boton: "Reintentar" }))) return;
    setTrabajando(true);
    try { const r = await reintentarDocumentoApi(d.coddoc); toast(r.message || "Reintento terminado"); }
    catch (er) { toast(sinRespuesta(er) ? "No se pudo confirmar el resultado. Actualiza para ver el estado vigente." : mensajeError(er), "error"); }
    finally { setTrabajando(false); consulta.refrescar(true); }
  }

  return (
    <div>
      <PageHeader titulo={`Factura ${d.numero || "sin número legible"}`} subtitulo={`${d.razon_emisor || "Emisor sin leer"}${d.ruc_emisor ? `, RUC ${d.ruc_emisor}` : ""}`}>
        <EstadoConexion hu="HU-030" consulta={consulta} />
        <BarraActualizacion consulta={consulta} />
        <Link to="/admin/facturas-recibidas" className="btn btn-secondary !py-2.5">Facturas recibidas</Link>
      </PageHeader>
      <AvisoConexion consulta={consulta} que="el documento" />

      <Card className="mb-6" data-estado-documento={d.estado}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <Pill tono={TONO_DOCUMENTO[d.estado]}>{d.estado}</Pill>
            {d.motivo && <p className="mt-2 max-w-3xl text-[14px] text-slate-700 dark:text-white/80">{d.motivo}</p>}
            {d.estado === "Importado" && <p className="mt-2 text-[14px] text-slate-600 dark:text-white/70">Se registraron {d.unidades_registradas} moto{Number(d.unidades_registradas) === 1 ? "" : "s"} en {d.unidades?.[0]?.ubicacion?.nomubi || "Ancón"}. La factura no significa recepción en una sede, armado terminado ni moto lista para entrega.</p>}
            {d.resuelto_por && <p className="mt-1 text-[12.5px] text-slate-400">Resuelto por {d.resuelto_por}{d.fecha_resolucion ? ` el ${fechaCompleta(d.fecha_resolucion)}` : ""}.</p>}
          </div>
          {abierto && (
            <div className="flex flex-wrap gap-2">
              {d.tiene_xml && <button className="btn btn-primary !py-2" disabled={trabajando} onClick={reintentar}>{trabajando ? "Reintentando…" : "Reintentar importación"}</button>}
              <button className="btn btn-secondary !py-2" onClick={() => setResolver({ accion: candidatos.length ? "vincular" : "manual" })}>Resolver incidencia</button>
            </div>
          )}
        </div>
        {abierto && codigosSinEquivalencia.length > 0 && (
          <div className="mt-4"><Aviso tipo="aviso">Falta confirmar qué modelo es {codigosSinEquivalencia.length === 1 ? "el código" : "los códigos"} <b className="font-mono">{codigosSinEquivalencia.join(", ")}</b>. {codigosSinEquivalencia.map((c) => <Link key={c} className="ml-1 font-semibold underline" to={`/admin/facturas-recibidas?pestana=equivalencias&codigo=${encodeURIComponent(c)}`}>Confirmar {c}</Link>)}. Después reintenta la importación.</Aviso></div>
        )}
        {abierto && candidatos.length > 0 && <div className="mt-4"><Aviso tipo="aviso">Hay compras manuales previas del mismo modelo y color. Indica si esta factura corresponde a una de ellas o si es una compra nueva: el sistema no elige por fecha, color ni nombre.</Aviso></div>}
        {abierto && !d.tiene_xml && <div className="mt-4"><Aviso tipo="aviso">El correo no trajo el XML de la factura o no se pudo leer. No se registran motos sin ese dato: regístralas a mano en Compras a proveedor o pide que reenvíen el correo con el XML.</Aviso></div>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <h2 className="font-bold text-marino dark:text-white">Datos de la factura</h2>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-2">
            {[["Número", d.numero], ["Tipo de documento", d.tipo_documento === "01" ? "Factura (01)" : d.tipo_documento], ["Emisor", `${d.razon_emisor || "—"}${d.ruc_emisor ? `, RUC ${d.ruc_emisor}` : ""}`], ["Receptor", d.ruc_receptor ? `RUC ${d.ruc_receptor}` : "—"],
              ["Fecha de emisión", d.fecha_emision || "—"], ["Moneda", d.moneda || "—"], ["Pedidos", (d.pedidos?.length ? d.pedidos : [...new Set((d.lineas || []).map((l) => l.pedido).filter(Boolean))]).join(", ") || "—"], ["Intentos de proceso", `${d.intentos}${d.ultimo_intento ? `, el último ${fechaCompleta(d.ultimo_intento)}` : ""}`]].map(([k, v]) => (
              <div key={k}><dt className="text-slate-400">{k}</dt><dd className="font-semibold text-marino dark:text-white">{v || "—"}</dd></div>
            ))}
          </dl>
        </Card>
        <Card>
          <h2 className="font-bold text-marino dark:text-white">Correo y archivos</h2>
          <dl className="mt-3 space-y-2 text-[13px]">
            <div><dt className="text-slate-400">Recibido en Gmail</dt><dd className="font-semibold text-marino dark:text-white">{fechaCompleta(d.correo?.recibido) || "—"}</dd></div>
            <div><dt className="text-slate-400">Registrado en el sistema</dt><dd className="font-semibold text-marino dark:text-white">{fechaCompleta(d.fecha_registro)}</dd></div>
            <div><dt className="text-slate-400">Importado</dt><dd className="font-semibold text-marino dark:text-white">{d.fecha_importacion ? fechaCompleta(d.fecha_importacion) : "Todavía no"}</dd></div>
            <div><dt className="text-slate-400">Remitente</dt><dd className="break-all">{d.correo?.remitente || "—"}</dd></div>
            <div><dt className="text-slate-400">Asunto</dt><dd>{d.correo?.asunto || "—"}</dd></div>
          </dl>
          <p className="mt-2 text-[12px] text-slate-400">La importación no es la hora del pago a Crosland.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {d.tiene_pdf ? <><button className={btnMini} onClick={() => archivo("pdf", false)}>Ver PDF</button><button className={btnMini} onClick={() => archivo("pdf", true)}>Descargar PDF</button></> : <span className="text-[12.5px] text-slate-400">Sin PDF</span>}
            {d.tiene_xml && <button className={btnMini} onClick={() => archivo("xml", true)}>Descargar XML</button>}
          </div>
          {d.reenvio_distinto && <p className="mt-3 text-[12.5px] font-semibold text-amber-700">Llegó otra versión de esta factura con contenido distinto. Se conservó la primera; revisa el correo.</p>}
        </Card>
      </div>

      <Card className="mt-6 !p-0">
        <div className="px-5 pt-5"><h2 className="font-bold text-marino dark:text-white">Líneas del XML</h2><p className="text-[12.5px] text-slate-500">Las motos se reconocen por su código de material y una equivalencia verificada; aceites, accesorios y bonificaciones quedan excluidos.</p></div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead className="bg-slate-50 text-[12px] text-slate-500 dark:bg-white/5"><tr>{["#", "Código", "Descripción", "Cant.", "Pedido", "Modelo y color", "Motor / chasis", "Resultado"].map((c) => <th key={c} className="px-4 py-2.5 font-semibold">{c}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/10">
              {(d.lineas || []).map((l) => (
                <tr key={l.coddli} className="align-top" data-linea={l.numero_linea} data-estado={l.estado}>
                  <td className="px-4 py-2.5 text-slate-400">{l.numero_linea}</td>
                  <td className="px-4 py-2.5 font-mono text-[12.5px]">{l.codigo_material || "—"}</td>
                  <td className="max-w-[220px] px-4 py-2.5">{l.descripcion}</td>
                  <td className="px-4 py-2.5">{l.cantidad}</td>
                  <td className="px-4 py-2.5 font-mono text-[12.5px]">{l.pedido || "—"}</td>
                  <td className="px-4 py-2.5">{l.modelo?.nommod || (l.es_vehiculo ? <span className="text-amber-700">Sin equivalencia</span> : "—")}{l.color && <span className="block text-[12px] text-slate-400"><ColorUnidad color={l.color} /></span>}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px]">{(l.motores || []).map((m, i) => <span key={m} className="block">{m}{l.chasis?.[i] ? ` / ${l.chasis[i]}` : ""}</span>)}{!(l.motores || []).length && "—"}</td>
                  <td className="max-w-[260px] px-4 py-2.5"><Pill tono={TONO_LINEA[l.estado] || "gris"}>{l.estado}</Pill>{l.motivo && <span className="mt-1 block text-[12px] text-slate-500">{l.motivo}</span>}{l.codcom && <Link className="mt-1 block text-[12px] font-semibold text-marino-700 hover:underline dark:text-white" to={`/admin/compras/${l.codcom}`}>Compra N° {l.codcom}</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(d.lineas || []).length === 0 && <p className="px-5 pb-5 text-[13px] text-slate-400">No se pudieron leer líneas de este documento.</p>}
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Motos registradas ({(d.unidades || []).length})</h2>
          {(d.unidades || []).length === 0 ? <p className="text-[13px] text-slate-400">Este documento no registró motos.</p> : (
            <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-white/10">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-slate-50 text-[12px] text-slate-500 dark:bg-white/5"><tr>{["Motor", "Chasis / VIN", "Modelo y ubicación"].map((c) => <th key={c} className="whitespace-nowrap px-3 py-2.5 font-semibold">{c}</th>)}</tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/10">
                  {d.unidades.map((u) => (
                    <tr key={u.coduni} className="align-top">
                      <td className="px-3 py-2.5"><Link className="font-mono font-semibold text-marino hover:underline dark:text-white" to={`/admin/inventario/${u.coduni}`}>{u.nummotuni}</Link>{u.pedido && <span className="block text-[11.5px] text-slate-400">Pedido {u.pedido}</span>}</td>
                      <td className="break-all px-3 py-2.5 font-mono text-[12px]">{u.chauni}{u.vinuni && u.vinuni !== u.chauni ? <span className="block text-slate-400">{u.vinuni}</span> : null}</td>
                      <td className="px-3 py-2.5">{u.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={u.coluni} />, {u.ubicacion?.nomubi || "sin ubicación"}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(d.compras || []).length > 0 && (
            <div className="mt-4 space-y-1.5 text-[13px]">
              {d.compras.map((c) => <p key={c.codcom}><Link className="font-semibold text-marino-700 hover:underline dark:text-white" to={`/admin/compras/${c.codcom}`}>Compra N° {c.codcom}</Link> · {c.origen === "Automático" ? "creada por la importación" : "manual previa completada"} · {c.nommod}, {c.colcom}, {c.cancom} moto{c.cancom === 1 ? "" : "s"} · {c.estcom}</p>)}
            </div>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Historial del documento</h2>
          {(d.eventos || []).length === 0 ? <p className="text-[13px] text-slate-400">Sin eventos.</p> : (
            <ol className="space-y-3 border-l-2 border-slate-200 pl-4 dark:border-white/15">
              {d.eventos.map((e, i) => (
                <li key={i} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marino dark:bg-white" />
                  <p className="font-semibold text-marino dark:text-white">{e.tipo}: {e.resultado}</p>
                  <p className="text-[12px] text-slate-400">{fechaCompleta(e.fecha)}, {e.autor}</p>
                  {e.detalle && <p className="text-[12.5px] text-slate-500">{e.detalle}</p>}
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <ModalResolver datos={resolver ? { documento: d, candidatos, accion: resolver.accion } : null} onClose={() => setResolver(null)} onHecho={() => consulta.refrescar(true)} />
    </div>
  );
}

// Resolver una incidencia: vincular a una compra manual, registrar como compra nueva, resolver a mano o descartar
function ModalResolver({ datos, onClose, onHecho }) {
  const toast = useToast();
  const [accion, setAccion] = useState(datos?.accion || "manual");
  const [codcom, setCodcom] = useState("");
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState({}); const [enviando, setEnviando] = useState(false);
  const clave = datos ? `${datos.documento.coddoc}|${datos.accion}` : "";
  const [vista, setVista] = useState("");
  if (datos && vista !== clave) { setVista(clave); setAccion(datos.accion); setCodcom(""); setMotivo(""); setErr({}); }
  if (!datos) return null;
  const { documento: d, candidatos } = datos;
  const opciones = [
    ...(candidatos.length ? [{ id: "vincular", t: "Corresponde a una compra manual previa", x: "Completa esa compra con esta factura; no se cuenta dos veces." }, { id: "nueva", t: "Es una compra nueva", x: "Se registra una compra aparte para estas motos." }] : []),
    { id: "manual", t: "Resolver a mano", x: "La compra y su factura se registran a mano en Compras a proveedor. El documento queda como resuelto manualmente." },
    { id: "descartar", t: "Descartar", x: "No corresponde importarlo (por ejemplo, documento ajeno o duplicado). No se registra stock." },
  ];
  const largo = [...motivo.trim()].length;
  function validar() {
    const x = {};
    if (!opciones.some((o) => o.id === accion)) x.accion = "Elige cómo resolverlo.";
    if (accion === "vincular" && !codcom) x.codcom = "Elige la compra manual.";
    if ((accion === "manual" || accion === "descartar") && largo < 5) x.motivo = "Explica el motivo (mínimo 5 caracteres).";
    if (largo > 500) x.motivo = "Máximo 500 caracteres.";
    setErr(x);
    return Object.keys(x).length === 0;
  }
  async function guardar(e) {
    e.preventDefault();
    if (enviando || !validar()) return;
    setEnviando(true);
    try {
      const r = await resolverDocumentoApi(d.coddoc, { accion, ...(accion === "vincular" ? { codcom } : {}), motivo: motivo.trim() || null });
      toast(r.message || "Incidencia resuelta");
      onHecho(); onClose();
    } catch (er) {
      if (er.status === 409) { setErr({ general: `${er.message}.` }); onHecho(); }
      else setErr({ general: sinRespuesta(er) ? "No se pudo confirmar el resultado. Cierra y actualiza para ver el estado vigente antes de reintentar." : mensajeError(er) });
    } finally { setEnviando(false); }
  }
  const elegido = opciones.find((o) => o.id === accion);
  return (
    <Modal abierto onClose={onClose} titulo={`Resolver ${d.numero || "documento"}`} ancho="max-w-xl"
      confirmarGuardar={{ titulo: "¿Confirmar la resolución?", texto: `${elegido?.t}. ${elegido?.x}${accion === "vincular" && codcom ? ` Compra N° ${codcom}.` : ""} Quedará registrado con tu usuario.`, boton: "Confirmar", validar }}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button form="f-resolver" className="btn btn-primary !py-2" disabled={enviando}>{enviando ? "Guardando…" : "Confirmar"}</button></>}>
      <form id="f-resolver" onSubmit={guardar} className="space-y-4" noValidate>
        <fieldset className="space-y-2">
          {opciones.map((o) => (
            <label key={o.id} className={`block cursor-pointer rounded-xl border-2 p-3 transition ${accion === o.id ? "border-marino-700 bg-marino-50 dark:border-white/50 dark:bg-white/10" : "border-slate-200 dark:border-white/10"}`}>
              <input type="radio" name="resolver" className="sr-only" checked={accion === o.id} onChange={() => setAccion(o.id)} />
              <span className="block text-[14px] font-semibold text-marino dark:text-white">{o.t}</span><span className="block text-[12.5px] text-slate-500">{o.x}</span>
            </label>
          ))}
          {err.accion && <p className="text-[12px] font-medium text-acento">{err.accion}</p>}
        </fieldset>
        {accion === "vincular" && (
          <Campo etiqueta="Compra manual" error={err.codcom}>
            <select id="resolver-compra" className="field-input" value={codcom} onChange={(e) => setCodcom(e.target.value)}>
              <option value="">Elige la compra</option>
              {candidatos.map((c) => <option key={c.codcom} value={c.codcom}>N° {c.codcom}: {c.cancom} moto{c.cancom === 1 ? "" : "s"}, {c.colcom}, registrada {c.feccom}{c.refcom ? `, pedido ${c.refcom}` : ", sin pedido"}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta={accion === "manual" || accion === "descartar" ? "Motivo" : "Comentario (opcional)"} error={err.motivo} ayuda={`${largo}/500`}>
          <textarea id="resolver-motivo" className="field-input" rows={2} maxLength={520} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </Campo>
        {err.general && <Aviso tipo="error">{err.general}</Aviso>}
      </form>
    </Modal>
  );
}
