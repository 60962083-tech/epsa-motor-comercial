// HU-023 · Consultar compras pendientes de identificación o recepción (base central, solo lectura)
// Incluye compras manuales de respaldo (HU-034) y las registradas por la importación de facturas (HU-030).
// Cada situación se informa por separado; las incidencias sin compra llevan al registro documental.
import { useEffect, useMemo, useState } from "react";
import { Link } from "./LinkPanel";
import { comprasPendientesApi, useConsultaCentral } from "../../servicios/central";
import { Stat, Tabla, Vacio, btnMini } from "../ui";
import { Pill } from "./Sprint2";
import { AvisoConexion, BarraActualizacion, ColorUnidad, fechaCompleta } from "./Central";

const SITUACIONES = [
  { id: "Pendiente de factura", corto: "Sin factura", tono: "rojo", nota: "Compra manual que espera su factura" },
  { id: "Pendiente de identificación", corto: "Por identificar", tono: "ambar", nota: "Faltan motores y chasis" },
  { id: "Pendiente de recepción", corto: "Por recibir", tono: "celeste", nota: "Identificadas, aún en Ancón o sin ubicación" },
  { id: "Incidencia documental", corto: "Incidencia", tono: "rojo", nota: "Factura por revisar o con error" },
];
const TONO = Object.fromEntries(SITUACIONES.map((s) => [s.id, s.tono]));

export default function ComprasPendientesCentral({ onSinApi }) {
  const [situacion, setSituacion] = useState("");
  const [origen, setOrigen] = useState("");
  const consulta = useConsultaCentral(() => comprasPendientesApi({ origen: origen || undefined }), [origen]);
  // Si el servidor aún no tiene GET /api/compras-pendientes, la página abre la lista de compras del Sprint 1
  const sinApi = Boolean(consulta.error?.detalle?.sinRuta);
  useEffect(() => { if (sinApi) onSinApi?.(); }, [sinApi]); // eslint-disable-line
  const datos = consulta.data;
  const compras = useMemo(() => (datos?.compras || []).filter((c) => !situacion || c.situaciones.includes(situacion)), [datos, situacion]);
  const sinCompra = situacion && situacion !== "Incidencia documental" ? [] : datos?.documentos_sin_compra || [];
  const conteo = datos?.conteo || {};
  const cuenta = (id) => Number(conteo[id] || 0) + (id === "Incidencia documental" ? (datos?.documentos_sin_compra || []).length : 0);

  return (
    <div data-hu023>
      <AvisoConexion consulta={consulta} que="las compras pendientes" />
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {SITUACIONES.map((s) => <Stat key={s.id} etiqueta={s.corto} valor={cuenta(s.id)} tono={s.tono === "celeste" ? "marino" : s.tono} nota={s.nota} />)}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Situación">
          {[{ id: "", corto: "Todas las pendientes" }, ...SITUACIONES].map((s) => (
            <button key={s.id || "todas"} type="button" aria-pressed={situacion === s.id} onClick={() => setSituacion(s.id)} data-situacion={s.id || "todas"}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold transition ${situacion === s.id ? "border-marino-700 bg-marino-700 text-white dark:border-white dark:bg-white dark:text-marino" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-white/15 dark:text-white/70"}`}>
              {s.corto}{s.id ? <span className="cifra ml-1.5 opacity-70">{cuenta(s.id)}</span> : null}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[13px] font-semibold" htmlFor="pend-origen">Origen</label>
          <select id="pend-origen" className="field-input !w-auto !py-2" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Manual y automático</option><option value="Manual">Registro manual</option><option value="Automático">Factura importada</option>
          </select>
          <BarraActualizacion consulta={consulta} />
        </div>
      </div>

      {datos && compras.length === 0 && sinCompra.length === 0 && (
        <Vacio titulo={situacion || origen ? "No hay compras pendientes con este filtro" : "No hay compras pendientes"} texto={situacion || origen ? "Prueba con otra situación u origen." : "Todas las compras tienen su factura, sus motos identificadas y recibidas."} />
      )}

      {compras.length > 0 && (
        <Tabla columnas={["Compra", "Origen", "Modelo", "Cantidades", "Factura", "Situación", ""]}>
          {compras.map((c) => (
            <tr key={c.codcom} className="align-top" data-compra-pendiente={c.codcom}>
              <td className="px-4 py-3"><Link className="font-semibold text-marino hover:underline dark:text-white" to={`/admin/compras/${c.codcom}`}>N° {c.codcom}</Link><span className="block text-[12px] text-slate-400">{c.feccom}</span>{c.refcom && <span className="block text-[12px] text-slate-400">Pedido {c.refcom}</span>}</td>
              <td className="px-4 py-3"><Pill tono={c.origen === "Automático" ? "celeste" : "gris"}>{c.origen === "Automático" ? "Factura importada" : "Registro manual"}</Pill></td>
              <td className="px-4 py-3">{c.nommod}<span className="block text-[12px] text-slate-400"><ColorUnidad color={c.colcom} /></span></td>
              <td className="px-4 py-3 text-[12.5px]" data-cantidades>
                <span className="block"><b className="cifra text-marino dark:text-white">{c.cantidad_comprada}</b> comprada{c.cantidad_comprada === 1 ? "" : "s"}, <b className="cifra text-marino dark:text-white">{c.cantidad_identificada}</b> identificada{c.cantidad_identificada === 1 ? "" : "s"}</span>
                {c.cantidad_pendiente_identificacion > 0 && <span className="block font-semibold text-amber-700 dark:text-amber-300">{c.cantidad_pendiente_identificacion} por identificar</span>}
                {c.cantidad_pendiente_recepcion > 0 && <span className="block font-semibold text-sky-700 dark:text-sky-300">{c.cantidad_pendiente_recepcion} por recibir{c.cantidad_sin_ubicacion ? ` (${c.cantidad_sin_ubicacion} sin ubicación)` : ""}</span>}
                {c.cantidad_en_traslado > 0 && <span className="block text-slate-500">{c.cantidad_en_traslado} en traslado</span>}
                {c.cantidad_recibida > 0 && <span className="block text-slate-500">{c.cantidad_recibida} ya en sede, fibrera u otra ubicación</span>}
              </td>
              <td className="px-4 py-3 text-[12.5px]">
                {c.factura ? <>
                  <span className="block font-semibold text-marino dark:text-white">{c.factura.numero}</span>
                  <span className="block text-slate-400">{c.factura.tipo === "Importada" ? `Importada${c.factura.fecha_importacion ? ` el ${fechaCompleta(c.factura.fecha_importacion)}` : ""}` : "Registrada a mano"}, emitida {c.factura.fecha_emision}</span>
                  {c.factura.tipo === "Importada" && c.factura.estado && c.factura.estado !== "Importado" && <span className="mt-1 block font-semibold text-acento">{c.factura.estado}{c.factura.motivo ? `: ${c.factura.motivo}` : ""}</span>}
                </> : <span className="text-slate-400">Sin factura todavía</span>}
              </td>
              <td className="px-4 py-3"><div className="flex flex-col gap-1">{c.situaciones.map((s) => <Pill key={s} tono={TONO[s]}>{s}</Pill>)}</div></td>
              <td className="px-4 py-3"><div className="flex flex-col gap-1.5">
                <Link className={btnMini} to={`/admin/compras/${c.codcom}`}>Ver compra</Link>
                {c.factura?.coddoc && <Link className={btnMini} to={`/admin/facturas-recibidas/${c.factura.coddoc}`}>Ver documento</Link>}
              </div></td>
            </tr>
          ))}
        </Tabla>
      )}

      {sinCompra.length > 0 && (
        <section className="mt-6" data-documentos-sin-compra>
          <h3 className="mb-1 text-[15px] font-bold text-marino dark:text-white">Facturas recibidas con incidencia y sin compra registrada</h3>
          <p className="mb-3 text-[12.5px] text-slate-500">No se creó ninguna compra a partir de estos documentos. Revísalos en su registro documental.</p>
          <Tabla columnas={["Factura", "Emisor", "Recibida", "Estado", "Motivo", ""]}>
            {sinCompra.map((d) => (
              <tr key={d.coddoc} className="align-top" data-documento={d.coddoc}>
                <td className="px-4 py-3 font-semibold text-marino dark:text-white">{d.numero || "Sin número legible"}<span className="block text-[12px] font-normal text-slate-400">{d.fecha_emision ? `Emitida ${d.fecha_emision}` : ""}</span></td>
                <td className="px-4 py-3">{d.razon_emisor || "—"}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCompleta(d.recibido || d.fecha_registro)}</td>
                <td className="px-4 py-3"><Pill tono={d.estado === "Error" ? "rojo" : "ambar"}>{d.estado}</Pill></td>
                <td className="max-w-[320px] px-4 py-3 text-[12.5px] text-slate-500">{d.motivo || "—"}</td>
                <td className="px-4 py-3"><Link className={btnMini} to={`/admin/facturas-recibidas/${d.coddoc}`}>Revisar</Link></td>
              </tr>
            ))}
          </Tabla>
        </section>
      )}
      <p className="mt-4 text-[12.5px] text-slate-400">Esta consulta no lee el correo ni mueve motos: las facturas se importan en Facturas recibidas y la llegada de cada moto se registra en Movimientos.</p>
    </div>
  );
}
