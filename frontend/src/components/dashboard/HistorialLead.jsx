// HU-015 · Última actualización e historial de un interesado (docs/supabase-sprint2-mejoras.sql)
// La base guarda en historiallead cada cambio (registro, asignación o transferencia, contactos, cambios de estado,
// venta concretada y datos editados) con fecha, hora y quién lo hizo, y deja el último en lead.fecactlea,
// lead.detactlea y lead.codusuact. En Leads y Seguimiento la «Última actualización» abre ese historial.
import { useEffect, useMemo, useState } from "react";
import { historialLeadApi, ultimasActualizacionesApi } from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { useConsultaCentral } from "../../servicios/central";
import { Aviso, Modal } from "../ui";
import { Pill } from "./Sprint2";
import { fechaCompleta } from "./Central";

const ETIQUETA = { Convertido: "Venta concretada", Cerrado: "Cerrado sin venta" };
const estadoTexto = (e) => ETIQUETA[e] || e;

// Última actualización de cada interesado visible, por su número (se actualiza sola como las listas)
export function useActualizaciones() {
  const consulta = useConsultaCentral(() => ultimasActualizacionesApi().then((r) => (Array.isArray(r) ? r : [])), [], { clave: "actualizaciones" });
  const porLead = useMemo(() => new Map((consulta.data || []).map((a) => [String(a.codlea), a])), [consulta.data]);
  return { porLead, consulta };
}

// Celda «Última actualización»: fecha y hora, qué cambió y quién; al pulsarla se abre el historial
export function UltimaActualizacion({ act, respaldo, onAbrir }) {
  const fecha = act?.fecha || respaldo?.fecha;
  const detalle = act?.detalle || respaldo?.detalle;
  const usuario = act ? act.usuario : respaldo?.usuario;
  return (
    <button type="button" onClick={onAbrir} className="group block w-full min-w-0 rounded-lg px-2 py-1 -mx-2 text-left hover:bg-slate-50 dark:hover:bg-white/5" title="Ver el historial completo" data-ultima-actualizacion>
      <span className="block whitespace-nowrap text-[13px] font-semibold text-marino group-hover:underline dark:text-white">{fecha ? fechaCompleta(fecha) : "Ver historial"}</span>
      {detalle && <span className="block line-clamp-2 text-[12.5px] text-slate-500 dark:text-slate-300">{detalle}</span>}
      <span className="block text-[12px] text-slate-400">{fecha ? (usuario ? `Por ${usuario}` : "Desde la web") : ""}</span>
    </button>
  );
}

// Ventana con el historial completo, del cambio más reciente al más antiguo
export function ModalHistorialLead({ lead, respaldo = [], onClose }) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, error: "" });
  useEffect(() => {
    if (!lead) return undefined;
    let vigente = true;
    setEstado({ cargando: true, datos: null, error: "" });
    historialLeadApi(lead.codlea)
      .then((datos) => { if (vigente) setEstado({ cargando: false, datos, error: "" }); })
      .catch((e) => { if (vigente) setEstado({ cargando: false, datos: null, error: e?.detalle?.faltaSql ? "" : mensajeError(e), faltaSql: Boolean(e?.detalle?.faltaSql) }); });
    return () => { vigente = false; };
  }, [lead?.codlea]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lead) return null;
  // Sin el SQL de mejoras se muestran los contactos del seguimiento
  const items = estado.datos?.historial || (estado.faltaSql ? respaldo.map((h) => ({ codhle: h.codsle, fecha: h.fecha, tipo: h.tipo === "Venta" ? "Venta concretada" : h.tipo, detalle: h.detalle, proximo: h.proximo, usuario: h.usuario })) : []);
  const ultima = estado.datos?.actualizado;
  return (
    <Modal abierto onClose={onClose} titulo={`Historial · ${lead.nomlea}`} ancho="max-w-xl" sinAvisoCambios confirmarGuardar={false}
      pie={<button className="btn btn-secondary !py-2" onClick={onClose}>Cerrar</button>}>
      <div data-historial-lead>
        {ultima?.fecha && (
          <div className="mb-4 rounded-xl bg-marino-50 px-4 py-3 dark:bg-white/10">
            <p className="text-[12.5px] font-semibold text-marino-700 dark:text-white/80">Última actualización</p>
            <p className="text-[14px] font-semibold text-marino dark:text-white">{fechaCompleta(ultima.fecha)}{ultima.usuario ? ` · ${ultima.usuario}` : " · Web"}</p>
            {ultima.detalle && <p className="text-[13px] text-slate-600 dark:text-slate-300">{ultima.detalle}</p>}
          </div>
        )}
        {estado.cargando && <p className="text-[13.5px] text-slate-500">Cargando el historial…</p>}
        {estado.error && <Aviso tipo="error">{estado.error}</Aviso>}
        {!estado.cargando && !estado.error && items.length === 0 && <p className="text-[13.5px] text-slate-500">Todavía no hay cambios registrados.</p>}
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4 dark:border-white/15">
          {items.map((h) => (
            <li key={h.codhle} className="relative" data-historial-item={h.tipo}>
              <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-marino dark:bg-white" />
              <p className="text-[12.5px] text-slate-400">{fechaCompleta(h.fecha)} · {h.usuario || "Web"}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[14px]">
                <b className="text-marino dark:text-white">{h.tipo}</b>
                {h.estadoNuevo && h.estadoAnterior && <Pill tono="marino">{estadoTexto(h.estadoAnterior)} → {estadoTexto(h.estadoNuevo)}</Pill>}
              </p>
              {h.detalle && <p className="mt-0.5 whitespace-pre-line text-[13.5px] text-slate-600 dark:text-slate-300">{h.detalle}</p>}
              {h.proximo && <p className="mt-0.5 text-[12.5px] text-slate-500">Próximo contacto: {fechaCompleta(h.proximo)}</p>}
            </li>
          ))}
        </ol>
        {lead.obslea && <p className="mt-4 text-[12.5px] text-slate-500">Al registrarse: {lead.obslea}</p>}
      </div>
    </Modal>
  );
}
