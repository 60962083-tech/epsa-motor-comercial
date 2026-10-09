import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { TIPOS_TECHO } from "../../data/mockData";
import { Aviso, Campo, Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import HUBadge from "../../components/HUBadge";

const DISP = { "No disponible": "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70", Disponible: "bg-emerald-100 text-emerald-700", Separada: "bg-amber-100 text-amber-700", Vendida: "bg-slate-200 text-slate-600" };
const POR_PAGINA = 15;

/**
 * Inventario de unidades — HU-004 "Actualizar la configuración del techo".
 * Regla del backend (HU-002): toda unidad nace de una compra identificada, con estado "No disponible"
 * y sin ubicación. Aquí se registra la recepción, el techo/preparación, el traslado y la liberación para venta.
 */
export default function Inventario() {
  const { unidades, modelos, ubicaciones, actualizar, eliminar } = useApp();
  const { state } = useLocation();
  const { puede, user } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [f, setF] = useState({ q: "", disp: "", modelo: "", ubic: state?.ubic || "", color: "", techo: "" });
  const [pag, setPag] = useState(1);
  const [modal, setModal] = useState(null); // {tipo:'trasladar'|'historial'|'recibir', u}
  const [d, setD] = useState({}); const [err, setErr] = useState({});
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || id;
  const activas = ubicaciones.filter((u) => u.activo);

  const lista = useMemo(() => unidades.filter((u) => {
    const q = f.q.toLowerCase();
    if (q && !`${u.id} ${u.motor} ${u.chasis}`.toLowerCase().includes(q)) return false;
    return (!f.disp || u.disponibilidad === f.disp) && (!f.modelo || u.modelo === f.modelo) && (!f.ubic || (f.ubic === "__sin" ? !u.ubicacion : u.ubicacion === f.ubic)) && (!f.color || u.color === f.color) && (!f.techo || u.techo === f.techo);
  }), [unidades, f]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const setFiltro = (k, v) => { setF({ ...f, [k]: v }); setPag(1); };
  const hoy = () => new Date().toISOString().slice(0, 10);
  const log = (u, detalle) => [...u.historial, { fecha: hoy(), detalle: `${detalle} · ${user.nombre}` }];

  function abrir(tipo, u) {
    setErr({});
    if (tipo === "trasladar") setD({ destino: activas.find((a) => a.nombre !== u.ubicacion)?.nombre || "", motivo: "" });
    if (tipo === "recibir") setD({ destino: activas.find((a) => a.tipo !== "Proveedor de techo")?.nombre || "", detalle: "" });
    setModal({ tipo, u });
  }
  function guardarTraslado(e) {
    e.preventDefault(); const u = modal.u;
    if (!d.destino) return setErr({ destino: "Elige la ubicación de destino." });
    if (d.destino === u.ubicacion) return setErr({ destino: "El destino debe ser distinto a la ubicación actual." });
    if (u.disponibilidad === "Vendida") return setErr({ destino: "Una unidad vendida ya no se traslada." });
    actualizar("unidades", u.id, { ubicacion: d.destino, historial: log(u, `Traslado ${u.ubicacion} → ${d.destino}${d.motivo ? ` (${d.motivo})` : ""}`) }, `${u.id} trasladada a ${d.destino}`);
    toast(`${u.id} trasladada a ${d.destino}`); setModal(null);
  }
  function guardarRecepcion(e) {
    e.preventDefault(); const u = modal.u;
    if (!d.destino) return setErr({ destino: "Elige dónde se recibe la unidad." });
    actualizar("unidades", u.id, { ubicacion: d.destino, historial: log(u, `Recepción física en ${d.destino}${d.detalle ? ` · ${d.detalle}` : ""}`) }, `${u.id} recibida en ${d.destino}`);
    toast(`${u.id} recibida en ${d.destino}`); setModal(null);
  }
  async function liberar(u) {
    if (u.preparacion !== "Lista para entrega" && !(await confirmar({ titulo: "Liberar sin preparación completa", texto: `${u.id} figura como «${u.preparacion}». ¿Igual quieres marcarla como disponible para la venta?`, boton: "Sí, liberar" }))) return;
    if (u.preparacion === "Lista para entrega" && !(await confirmar({ titulo: "Liberar para la venta", texto: `${u.id} quedará disponible y se contará en el stock de la web pública.`, boton: "Liberar" }))) return;
    actualizar("unidades", u.id, { disponibilidad: "Disponible", historial: log(u, "Liberada para la venta") }, `${u.id} liberada para la venta`);
    toast(`${u.id} ya está disponible para la venta`);
  }
  async function borrar(u) {
    if (u.disponibilidad === "Vendida") return toast("Una unidad vendida no se elimina: forma parte del historial de ventas.", "error");
    if (await confirmar({ titulo: "Eliminar unidad", texto: `¿Eliminar la unidad ${u.id} (motor ${u.motor})? Se perderá su historial. Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true })) { eliminar("unidades", u.id, `Unidad eliminada: ${u.id}`); toast("Unidad eliminada"); }
  }

  const sel = (k, et, ops) => <div><label className="field-label">{et}</label><select className="field-input" value={f[k]} onChange={(e) => setFiltro(k, e.target.value)}><option value="">Todos</option>{ops.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.t ?? o}</option>)}</select></div>;
  const cuenta = (fn) => unidades.filter(fn).length;

  return (
    <div>
      <HUBadge code="HU-004" titulo="Actualizar la configuración del techo" />
      <PageHeader titulo="Inventario" subtitulo={`${unidades.length} unidades. Abre la ficha de una unidad para configurar su techo y proveedor (HU-004), recibirla, trasladarla o liberarla para la venta.`}>
        {puede("compras.registrar") && <Link className="btn btn-primary !py-2.5" to="/admin/compras">+ Identificar unidades de una compra</Link>}
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat etiqueta="Por recibir / preparar" valor={cuenta((u) => u.disponibilidad === "No disponible")} nota="Identificadas, aún no a la venta" />
        <Stat etiqueta="Disponibles" valor={cuenta((u) => u.disponibilidad === "Disponible")} tono="verde" />
        <Stat etiqueta="Separadas" valor={cuenta((u) => u.disponibilidad === "Separada")} tono="ambar" />
        <Stat etiqueta="Vendidas" valor={cuenta((u) => u.disponibilidad === "Vendida")} />
        <Stat etiqueta="Sin recepción" valor={cuenta((u) => !u.ubicacion)} nota="En camino desde Crosland" tono="rojo" />
      </div>
      <Card className="mb-5">
        <h2 className="text-[15px] font-extrabold uppercase text-marino dark:text-white">Disponibilidad por sede</h2>
        <p className="mb-3 text-[12.5px] text-slate-400">Unidades disponibles por modelo y ubicación. Toca una celda para filtrar el inventario.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead><tr className="text-left text-slate-400"><th className="py-2 pr-3 font-semibold">Modelo</th>{activas.filter((a) => a.tipo !== "Proveedor de techo").map((a) => <th key={a.id} className="px-2 py-2 text-center font-semibold">{a.nombre}</th>)}<th className="px-2 py-2 text-center font-semibold">Total</th></tr></thead>
            <tbody>
              {modelos.map((m) => {
                const cols = activas.filter((a) => a.tipo !== "Proveedor de techo");
                const tot = unidades.filter((u) => u.modelo === m.id && u.disponibilidad === "Disponible").length;
                return (
                  <tr key={m.id} className="border-t border-slate-100 dark:border-white/10">
                    <td className="py-2 pr-3 font-semibold text-marino dark:text-white">{m.nombre}</td>
                    {cols.map((a) => {
                      const n = unidades.filter((u) => u.modelo === m.id && u.ubicacion === a.nombre && u.disponibilidad === "Disponible").length;
                      return <td key={a.id} className="px-2 py-2 text-center"><button onClick={() => { setF({ q: "", disp: "Disponible", modelo: m.id, ubic: a.nombre, color: "", techo: "" }); setPag(1); }} className={`min-w-[2rem] rounded-md px-2 py-0.5 font-bold ${n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "text-slate-300"}`}>{n}</button></td>;
                    })}
                    <td className="px-2 py-2 text-center font-extrabold text-marino dark:text-white">{tot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2"><label className="field-label">Código o serie</label><input className="field-input" value={f.q} onChange={(e) => setFiltro("q", e.target.value)} placeholder="MC-001, motor o chasis" /></div>
        {sel("disp", "Disponibilidad", ["No disponible", "Disponible", "Separada", "Vendida"])}
        {sel("modelo", "Modelo", modelos.map((m) => ({ v: m.id, t: m.nombre })))}
        {sel("ubic", "Ubicación actual", [{ v: "__sin", t: "Sin recepción" }, ...ubicaciones.map((u) => u.nombre)])}
        {sel("color", "Color", ["Rojo", "Blanco", "Azul"])}
        {sel("techo", "Tipo de techo", TIPOS_TECHO)}
        <div className="flex items-end"><button className="pb-3 text-[13px] font-semibold text-acento hover:underline" onClick={() => { setF({ q: "", disp: "", modelo: "", ubic: "", color: "", techo: "" }); setPag(1); }}>Limpiar filtros</button></div>
      </Card>

      {lista.length === 0 ? <Vacio titulo="Sin unidades con esos filtros" /> : (
        <>
          <Tabla columnas={["Unidad", "Modelo", "Ubicación", "Preparación", "Techo", "Disponibilidad", "Acciones"]}>
            {visibles.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{u.id}</p><p className="text-[11.5px] text-slate-400">{u.motor}</p></td>
                <td className="px-4 py-3">{nombreModelo(u.modelo)}<span className="block text-[12px] text-slate-400">{u.color}</span></td>
                <td className="px-4 py-3">{u.ubicacion || <span className="text-amber-600">Sin recepción</span>}</td>
                <td className="px-4 py-3">{u.preparacion}</td>
                <td className="px-4 py-3">{u.techo}{u.proveedorTecho && <span className="text-slate-400"> · {u.proveedorTecho}</span>}{u.estadoTecho && <span className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.estadoTecho === "Instalado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{u.estadoTecho}</span>}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${DISP[u.disponibilidad]}`}>{u.disponibilidad}</span></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  {puede("unidades.gestionar") && !u.ubicacion && <button className={btnMini} onClick={() => abrir("recibir", u)}>Recibir</button>}
                  <Link className={btnMini} to={`/admin/inventario/${u.id}`}>Ficha y techo</Link>
                  {puede("unidades.gestionar") && u.ubicacion && u.disponibilidad === "No disponible" && <button className={btnMini} onClick={() => liberar(u)}>Liberar</button>}
                  {puede("unidades.trasladar") && u.ubicacion && u.disponibilidad !== "Vendida" && <button className={btnMini} onClick={() => abrir("trasladar", u)}>Trasladar</button>}
                  <button className={btnMini} onClick={() => abrir("historial", u)}>Historial</button>
                  {puede("eliminar") && <button className={btnMiniPeligro} onClick={() => borrar(u)}>Eliminar</button>}
                </div></td>
              </tr>
            ))}
          </Tabla>
          <div className="mt-4 flex items-center justify-between text-[13px] text-slate-500">
            <span>{lista.length} unidades · página {pag} de {paginas}</span>
            <div className="flex gap-2"><button disabled={pag === 1} className={btnMini} onClick={() => setPag(pag - 1)}>← Anterior</button><button disabled={pag === paginas} className={btnMini} onClick={() => setPag(pag + 1)}>Siguiente →</button></div>
          </div>
        </>
      )}

      <Modal abierto={modal?.tipo === "trasladar"} onClose={() => setModal(null)} titulo={`Trasladar ${modal?.u?.id}`} confirmarGuardar ancho="max-w-md" pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-tr" className="btn btn-primary !py-2">Trasladar</button></>}>
        <form id="f-tr" onSubmit={guardarTraslado} className="grid gap-4">
          <p className="text-[13.5px] text-slate-500">Ubicación actual: <b>{modal?.u?.ubicacion}</b></p>
          <Campo etiqueta="Destino" error={err.destino}><select className="field-input" value={d.destino} onChange={(e) => setD({ ...d, destino: e.target.value })}>{activas.map((a) => <option key={a.id}>{a.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Motivo (opcional)"><input className="field-input" value={d.motivo} onChange={(e) => setD({ ...d, motivo: e.target.value })} /></Campo>
          <Aviso tipo="aviso">Solo se muestran ubicaciones activas.</Aviso>
        </form>
      </Modal>
      <Modal abierto={modal?.tipo === "historial"} onClose={() => setModal(null)} titulo={`Historial · ${modal?.u?.id}`} ancho="max-w-md">
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4 dark:border-white/15">
          {[...(modal?.u?.historial || [])].reverse().map((h, i) => <li key={i}><p className="text-[12px] text-slate-400">{h.fecha}</p><p className="text-[14px]">{h.detalle}</p></li>)}
        </ol>
      </Modal>
      <Modal abierto={modal?.tipo === "recibir"} onClose={() => setModal(null)} titulo={`Recibir ${modal?.u?.id}`} confirmarGuardar ancho="max-w-md" pie={<><button className="btn btn-secondary !py-2" onClick={() => setModal(null)}>Cancelar</button><button form="f-rc" className="btn btn-primary !py-2">Registrar recepción</button></>}>
        <form id="f-rc" onSubmit={guardarRecepcion} className="grid gap-4" noValidate>
          <p className="text-[13.5px] text-slate-500">Motor <b>{modal?.u?.motor}</b> · chasis <b>{modal?.u?.chasis}</b></p>
          <Campo etiqueta="Ubicación donde llegó" error={err.destino}><select className="field-input" value={d.destino} onChange={(e) => setD({ ...d, destino: e.target.value })}>{activas.map((a) => <option key={a.id}>{a.nombre}</option>)}</select></Campo>
          <Campo etiqueta="Observación (opcional)"><input className="field-input" value={d.detalle || ""} onChange={(e) => setD({ ...d, detalle: e.target.value })} placeholder="Llegó sin observaciones" /></Campo>
          <Aviso>La unidad sigue «No disponible» hasta que la liberes para la venta.</Aviso>
        </form>
      </Modal>
    </div>
  );
}
