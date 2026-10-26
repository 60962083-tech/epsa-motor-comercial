// Ventas a clientes con la base central (docs/supabase-sprint2-conexiones.sql)
// Una venta concretada es un interesado que el vendedor cerró como «Convertido» desde aquí o desde Seguimiento;
// el detalle (forma de pago, monto y notas) queda en su historial de seguimientolead. El vendedor ve las suyas
// y la gerencia las de todo el equipo.
import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { limpiarTexto } from "../../lib/validar";
import { Campo, Card, Modal, PageHeader, Stat, Tabla, Vacio } from "../ui";
import { AvisoConexion, BarraActualizacion, fechaCompleta, sinApi } from "./Central";
import SeccionPendiente from "./SeccionPendiente";
import { ABIERTO, ModalContacto, useSeguimiento } from "./SeguimientoCentral";

// Fecha y detalle de la venta: el registro «Venta» más reciente del historial
const ventaDe = (l) => l.historial?.find((h) => h.tipo === "Venta") || l.historial?.[0] || null;

export default function VentasCentral() {
  const { puede } = useAuth();
  const gestiona = puede("leads.asignar");
  const consulta = useSeguimiento();
  const [texto, setTexto] = useState("");
  const [elegir, setElegir] = useState(false);
  const [lead, setLead] = useState(null);
  const todos = useMemo(() => consulta.data || [], [consulta.data]);
  const ventas = useMemo(() => todos.filter((l) => l.estlea === "Convertido")
    .map((l) => ({ ...l, venta: ventaDe(l) }))
    .sort((a, b) => String(b.venta?.fecha || "").localeCompare(String(a.venta?.fecha || ""))), [todos]);
  const q = limpiarTexto(texto).toLowerCase();
  const lista = ventas.filter((v) => !q || `${v.nomlea} ${v.tellea} ${v.nommod || ""} ${v.responsable?.nombre || ""}`.toLowerCase().includes(q));
  const mes = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const abiertos = todos.filter(ABIERTO);

  if (sinApi(consulta) || consulta.error?.detalle?.faltaSql) return <SeccionPendiente titulo="Ventas a clientes" />;

  return (
    <div data-ventas-central>
      <PageHeader titulo="Ventas a clientes" subtitulo={gestiona ? "Ventas concretadas por el equipo. Cada una sale del seguimiento de un interesado." : "Tus ventas concretadas. Regístralas aquí o desde Seguimiento."}>
        <button className="btn btn-primary !py-2.5" onClick={() => setElegir(true)} disabled={!abiertos.length} data-registrar-venta>+ Registrar venta</button>
      </PageHeader>
      <AvisoConexion consulta={consulta} que="las ventas" />

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Ventas del mes" valor={consulta.data ? ventas.filter((v) => (v.venta?.fecha ? new Date(v.venta.fecha).toLocaleDateString("en-CA").slice(0, 7) : "") === mes).length : "—"} tono="verde" />
        <Stat etiqueta="Ventas en total" valor={consulta.data ? ventas.length : "—"} />
        <Stat etiqueta="Interesados en proceso" valor={consulta.data ? abiertos.length : "—"} nota="Nuevos, contactados o en seguimiento" />
        <Stat etiqueta="Cerrados sin venta" valor={consulta.data ? todos.filter((l) => l.estlea === "Cerrado").length : "—"} />
      </div>

      <Card className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2"><label className="field-label" htmlFor="ven-buscar">Buscar</label><input id="ven-buscar" className="field-input" value={texto} maxLength={100} onChange={(e) => setTexto(e.target.value)} placeholder="Cliente, celular, modelo o vendedor" /></div>
          <div className="flex items-end gap-3 lg:col-span-2"><BarraActualizacion consulta={consulta} /></div>
        </div>
      </Card>

      {consulta.data && lista.length === 0 ? (
        <Vacio titulo={ventas.length ? "No hay ventas con esa búsqueda" : "Todavía no hay ventas concretadas"} texto={ventas.length ? "Busca con otro dato." : "Cuando un interesado compre, márcalo con «Registrar venta» o con «Venta concretada» en Seguimiento."} />
      ) : consulta.data && (
        <Tabla columnas={["Fecha", "Cliente", "Moto", "Detalle de la venta", "Vendedor"]}>
          {lista.map((v) => (
            <tr key={v.codlea} className="align-top" data-venta={v.codlea}>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCompleta(v.venta?.fecha)}</td>
              <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{v.nomlea}</p><p className="text-[12.5px] text-slate-400">{v.tellea}</p></td>
              <td className="px-4 py-3">{v.nommod || <span className="text-slate-400">Sin modelo</span>}{v.collea && <span className="block text-[12px] text-slate-400">{v.collea}</span>}</td>
              <td className="max-w-[22rem] px-4 py-3 text-slate-600 dark:text-slate-300">{v.venta?.detalle || "—"}</td>
              <td className="px-4 py-3">{v.venta?.usuario || v.responsable?.nombre || "—"}</td>
            </tr>
          ))}
        </Tabla>
      )}

      {/* Elegir el interesado que compró */}
      <ElegirInteresado abierto={elegir} interesados={abiertos} onClose={() => setElegir(false)} onElegir={(l) => { setElegir(false); setLead(l); }} />
      <ModalContacto lead={lead} venta onClose={() => setLead(null)} onHecho={() => consulta.refrescar(true)} />
    </div>
  );
}

function ElegirInteresado({ abierto, interesados, onClose, onElegir }) {
  const [codlea, setCodlea] = useState("");
  if (!abierto) return null;
  const elegido = interesados.find((l) => l.codlea === codlea) || interesados[0];
  return (
    <Modal abierto onClose={onClose} titulo="Registrar venta" ancho="max-w-md" sinAvisoCambios confirmarGuardar={false}
      pie={<><button className="btn btn-secondary !py-2" onClick={onClose}>Cancelar</button><button className="btn btn-primary !py-2" disabled={!elegido} onClick={() => onElegir(elegido)} data-continuar-venta>Continuar</button></>}>
      <Campo etiqueta="¿Qué interesado compró?" ayuda="Solo aparecen los interesados que siguen abiertos.">
        <select id="ven-interesado" className="field-input" value={elegido?.codlea || ""} onChange={(e) => setCodlea(e.target.value)}>
          {interesados.map((l) => <option key={l.codlea} value={l.codlea}>{l.nomlea} · {l.tellea}{l.nommod ? ` · ${l.nommod}` : ""}</option>)}
        </select>
      </Campo>
    </Modal>
  );
}
