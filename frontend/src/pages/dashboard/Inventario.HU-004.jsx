// HU-004 · Inventario de unidades · Sprint 2: recepción y traslados (HU-003) y preparación (HU-033)
import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Link } from "../../components/dashboard/LinkPanel";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { COLORES } from "../../data/mockData";
import { Card, Modal, PageHeader, Stat, Tabla, Vacio, btnMini, btnMiniPeligro, useConfirm, useToast } from "../../components/ui";
import { useMovimientos } from "../../servicios/movimientos";
import { usePreparacion } from "../../servicios/preparacion";
import { ModalRecibir, ModalTraslado } from "../../components/dashboard/MovimientoModales";

const DISP = { "No disponible": "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-white/70", Disponible: "bg-emerald-100 text-emerald-700", Separada: "bg-amber-100 text-amber-700", Vendida: "bg-slate-200 text-slate-600" };
const POR_PAGINA = 15;

export default function Inventario() {
  const { unidades, modelos, ubicaciones, ventas = [], eliminar } = useApp();
  const { state } = useLocation();
  const { puede } = useAuth();
  const toast = useToast(); const confirmar = useConfirm();
  const [f, setF] = useState({ q: "", disp: "", modelo: "", ubic: state?.ubic || "", color: "" });
  const [pag, setPag] = useState(1);
  const [modal, setModal] = useState(null);
  const { transitoDe } = useMovimientos();
  const prep = usePreparacion();
  const nombreModelo = (u) => modelos.find((m) => m.id === u.modelo)?.nombre || u.nombreModelo || u.modelo || "—";
  const activas = ubicaciones.filter((u) => u.activo);

  const lista = useMemo(() => unidades.filter((u) => {
    const q = f.q.toLowerCase();
    if (q && !`${u.id} ${u.motor} ${u.chasis}`.toLowerCase().includes(q)) return false;
    return (!f.disp || u.disponibilidad === f.disp) && (!f.modelo || u.modelo === f.modelo) && (!f.ubic || (f.ubic === "__sin" ? !u.ubicacion : u.ubicacion === f.ubic)) && (!f.color || u.color === f.color);
  }), [unidades, f]);
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const visibles = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const setFiltro = (k, v) => { setF({ ...f, [k]: v }); setPag(1); };

  // Recepción y traslado: ventanas compartidas (HU-003)
  const abrir = (tipo, u) => setModal({ tipo, u });
  // HU-033: solo se libera una moto lista, en una sede y con el techo instalado
  async function liberar(u) {
    const motivo = prep.bloqueoLiberar(u);
    if (motivo) return toast(`${u.id}: ${motivo}`, "error");
    if (!(await confirmar({ titulo: "Liberar para la venta", texto: `${u.id} quedará disponible y se contará en el stock de la web pública.`, boton: "Liberar" }))) return;
    toast(prep.liberar(u));
  }
  async function borrar(u) {
    if (u.disponibilidad === "Vendida") return toast("Una unidad vendida no se elimina: forma parte del historial de ventas.", "error");
    if (u.disponibilidad === "Separada" || ventas.some((v) => v.unidad === u.id && !["Anulada", "Cancelada"].includes(v.etapa))) return toast(`${u.id} está separada para un pedido: no se puede eliminar.`, "error");
    if (await confirmar({ titulo: "Eliminar unidad", texto: `¿Eliminar la unidad ${u.id} (motor ${u.motor})? Se perderá su historial. Esta acción no se puede deshacer.`, boton: "Eliminar", peligro: true })) { eliminar("unidades", u.id, `Unidad eliminada: ${u.id}`); toast("Unidad eliminada"); }
  }

  const sel = (k, et, ops) => <div><label className="field-label">{et}</label><select className="field-input" value={f[k]} onChange={(e) => setFiltro(k, e.target.value)}><option value="">Todos</option>{ops.map((o) => <option key={o.v ?? o} value={o.v ?? o}>{o.t ?? o}</option>)}</select></div>;
  const cuenta = (fn) => unidades.filter(fn).length;

  return (
    <div>
      <PageHeader titulo="Inventario" subtitulo="Cada unidad con su modelo, color, ubicación y techo. Abre «Ficha y techo» para configurar el techo y su fibrera.">
        {puede("compras.registrar") && <Link className="btn btn-primary !py-2.5" to="/admin/compras">+ Identificar unidades de una compra</Link>}
      </PageHeader>
      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-5">
        <Stat etiqueta="Por recibir / preparar" valor={cuenta((u) => u.disponibilidad === "No disponible")} nota="Identificadas, aún no a la venta" />
        <Stat etiqueta="Disponibles" valor={cuenta((u) => u.disponibilidad === "Disponible")} tono="verde" />
        <Stat etiqueta="Separadas" valor={cuenta((u) => u.disponibilidad === "Separada")} tono="ambar" />
        <Stat etiqueta="Vendidas" valor={cuenta((u) => u.disponibilidad === "Vendida")} />
        <Stat etiqueta="Sin recepción" valor={cuenta((u) => !u.ubicacion)} nota="En camino desde Crosland" tono="rojo" />
      </div>
      <Card className="mb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[15px] font-extrabold uppercase text-marino dark:text-white">Disponibilidad por sede</h2>
          <Link to="/admin/disponibilidad" className="text-[13px] font-semibold text-marino-700 hover:underline dark:text-white">Ver disponibilidad compartida</Link>
        </div>
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
                      return <td key={a.id} className="px-2 py-2 text-center"><button onClick={() => { setF({ q: "", disp: "Disponible", modelo: m.id, ubic: a.nombre, color: "" }); setPag(1); }} className={`min-w-[2rem] rounded-md px-2 py-0.5 font-bold ${n ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "text-slate-300"}`}>{n}</button></td>;
                    })}
                    <td className="px-2 py-2 text-center font-extrabold text-marino dark:text-white">{tot}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Filtros */}
      <Card className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="sm:col-span-2"><label className="field-label">Código o serie</label><input className="field-input" value={f.q} onChange={(e) => setFiltro("q", e.target.value)} placeholder="MC-001, motor o chasis" /></div>
        {sel("disp", "Disponibilidad", ["No disponible", "Disponible", "Separada", "Vendida"])}
        {sel("modelo", "Modelo", modelos.map((m) => ({ v: m.id, t: m.nombre })))}
        {sel("ubic", "Ubicación actual", [{ v: "__sin", t: "Sin recepción" }, ...ubicaciones.map((u) => u.nombre)])}
        {sel("color", "Color", COLORES)}
        <div className="flex items-end"><button className="pb-3 text-[13px] font-semibold text-acento hover:underline" onClick={() => { setF({ q: "", disp: "", modelo: "", ubic: "", color: "" }); setPag(1); }}>Limpiar filtros</button></div>
      </Card>

      {/* Tabla de unidades */}
      {lista.length === 0 ? <Vacio titulo="Sin unidades con esos filtros" /> : (
        <>
          <Tabla columnas={["Unidad", "Modelo", "Ubicación", "Preparación", "Techo", "Disponibilidad", "Acciones"]}>
            {visibles.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3"><p className="font-semibold text-marino dark:text-white">{u.id}</p><p className="text-[11.5px] text-slate-400">{u.motor}</p></td>
                <td className="px-4 py-3">{nombreModelo(u)}<span className="block text-[12px] text-slate-400">{u.color}</span></td>
                <td className="px-4 py-3">{u.ubicacion || <span className="text-amber-600">Sin recepción</span>}{transitoDe(u.id) && <span className="block text-[12px] font-semibold text-sky-700 dark:text-sky-300">En camino a {transitoDe(u.id).destino}</span>}</td>
                <td className="px-4 py-3">{u.preparacion}</td>
                <td className="px-4 py-3" data-techo={u.techo}><span className={`rounded-md px-2 py-0.5 text-[12.5px] font-semibold ${u.techo && u.techo !== "Sin techo" ? "bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-200" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60"}`}>{u.techo || "Sin techo"}</span>{u.proveedorTecho && <span className="text-slate-400"> · {u.proveedorTecho}</span>}{u.estadoTecho && <span className={`mt-1 block w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${u.estadoTecho === "Instalado" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{u.estadoTecho}</span>}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${DISP[u.disponibilidad]}`}>{u.disponibilidad}</span></td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1.5">
                  {puede("unidades.gestionar") && !u.ubicacion && <button className={btnMini} onClick={() => abrir("recibir", u)}>Recibir</button>}
                  <Link className={btnMini} to={`/admin/inventario/${u.id}`}>Ficha y techo</Link>
                  {puede("unidades.gestionar") && u.ubicacion && u.disponibilidad === "No disponible" && <button className={btnMini} onClick={() => liberar(u)}>Liberar</button>}
                  {puede("unidades.trasladar") && u.ubicacion && u.disponibilidad !== "Vendida" && !transitoDe(u.id) && <button className={btnMini} onClick={() => abrir("trasladar", u)}>Trasladar</button>}
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

      {/* Historial */}
      <Modal abierto={modal?.tipo === "historial"} onClose={() => setModal(null)} titulo={`Historial · ${modal?.u?.id}`} ancho="max-w-md">
        <ol className="space-y-3 border-l-2 border-slate-200 pl-4 dark:border-white/15">
          {[...(modal?.u?.historial || [])].reverse().map((h, i) => <li key={i}><p className="text-[12px] text-slate-400">{h.fecha}</p><p className="text-[14px]">{h.detalle}</p></li>)}
        </ol>
      </Modal>
      <ModalTraslado abierto={modal?.tipo === "trasladar"} unidad={modal?.u} onClose={() => setModal(null)} />
      <ModalRecibir unidad={modal?.tipo === "recibir" ? modal.u : null} onClose={() => setModal(null)} />
    </div>
  );
}
