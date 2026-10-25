// HU-033 · Actualizar la preparación de una unidad (tablero de pasos)
import { useMemo, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { PASO_PREPARACION } from "../../data/mockData";
import { usePreparacion } from "../../servicios/preparacion";
import { useMovimientos } from "../../servicios/movimientos";
import { haceCuanto } from "../../lib/validar";
import { Aviso, Card, PageHeader, Vacio, useToast } from "../../components/ui";
import { ColorPunto, EstadoConexion, Pill, TONO_DISPONIBILIDAD } from "../../components/dashboard/Sprint2";
import { nombreModeloDe } from "../../components/dashboard/MovimientoModales";
import PreparacionModal from "../../components/dashboard/PreparacionModal";

const VISIBLES_LISTAS = 6;
const tiempoEnPaso = (desde) => { const t = haceCuanto(desde); return /momento|min/.test(t) ? "Recién llegó a este paso" : `Lleva ${t.replace(/^hace /, "")} en este paso`; };

export default function Preparacion() {
  const { unidades, modelos, publicos, ubicaciones } = useApp();
  const { puede } = useAuth();
  const prep = usePreparacion();
  const { transitoDe, porRecibir } = useMovimientos();
  const [f, setF] = useState({ sede: "", modelo: "", q: "" });
  const [modal, setModal] = useState(null);
  const [verListas, setVerListas] = useState(false);
  const toast = useToast();
  const gestiona = puede("unidades.gestionar");
  const nombre = (u) => nombreModeloDe(u, modelos, publicos);

  const enProceso = useMemo(() => unidades.filter((u) => u.ubicacion && u.disponibilidad !== "Vendida").filter((u) => {
    const q = f.q.trim().toLowerCase();
    return (!f.sede || u.ubicacion === f.sede) && (!f.modelo || u.modelo === f.modelo) && (!q || `${u.id} ${u.motor} ${nombre(u)}`.toLowerCase().includes(q));
  }), [unidades, f]); // eslint-disable-line
  const columnas = prep.PASOS.map((p) => ({ paso: p, lista: enProceso.filter((u) => (u.preparacion || "Sin preparar") === p).sort((a, b) => (prep.desdeCuando(a) || "").localeCompare(prep.desdeCuando(b) || "")) }));
  // Las listas más recientes primero
  columnas[3].lista.sort((a, b) => (prep.desdeCuando(b) || "").localeCompare(prep.desdeCuando(a) || ""));
  const sedes = ubicaciones.filter((a) => a.activo && a.tipo !== "Proveedor de techo");

  return (
    <div>
      <PageHeader titulo="Preparación de motos" subtitulo="Cada moto recibida pasa por cuatro pasos. Cuando queda lista para entrega, aparece sola en Disponibilidad para todos los vendedores.">
        <EstadoConexion hu="HU-033" />
      </PageHeader>

      {porRecibir.length > 0 && <div className="mb-4"><Aviso tipo="aviso">{porRecibir.length === 1 ? "1 moto aún no llega" : `${porRecibir.length} motos aún no llegan`} a una sede. <Link className="font-semibold underline" to="/admin/movimientos">Recíbelas en Movimientos</Link> para empezar su preparación.</Aviso></div>}

      <Card className="mb-5 grid gap-3 sm:grid-cols-3">
        <div><label className="field-label">Sede o almacén</label><select className="field-input" value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })}><option value="">Todas</option>{sedes.map((s) => <option key={s.id}>{s.nombre}</option>)}{ubicaciones.filter((a) => a.tipo === "Proveedor de techo").map((s) => <option key={s.id}>{s.nombre}</option>)}</select></div>
        <div><label className="field-label">Modelo</label><select className="field-input" value={f.modelo} onChange={(e) => setF({ ...f, modelo: e.target.value })}><option value="">Todos</option>{modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select></div>
        <div><label className="field-label">Buscar</label><input className="field-input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Código o motor" /></div>
      </Card>

      {/* Tablero: un paso por columna */}
      <div className="grid gap-4 lg:grid-cols-4" data-tablero="preparacion">
        {columnas.map(({ paso, lista }, i) => {
          const ultima = i === columnas.length - 1;
          const mostrar = ultima && !verListas ? lista.slice(0, VISIBLES_LISTAS) : lista;
          return (
            <section key={paso} className="flex min-w-0 flex-col rounded-xl2 bg-slate-100/70 p-3 dark:bg-white/[0.03]" aria-label={paso} data-columna={paso}>
              <header className="mb-3 px-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-[14.5px] font-bold text-marino dark:text-white">
                    <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] ${ultima ? "bg-emerald-500 text-white" : "bg-marino-700 text-white dark:bg-white dark:text-marino"}`}>{i + 1}</span>{paso}
                  </h2>
                  <span className="cifra rounded-full bg-white px-2 py-0.5 text-[12px] font-bold text-slate-600 dark:bg-white/10 dark:text-white/70">{lista.length}</span>
                </div>
                <p className="mt-1 text-[12px] leading-snug text-slate-500">{PASO_PREPARACION[paso]}</p>
              </header>
              <div className="flex-1 space-y-2.5">
                {lista.length === 0 && <p className="rounded-lg border-2 border-dashed border-slate-200 px-3 py-6 text-center text-[12.5px] text-slate-400 dark:border-white/10">Sin motos en este paso</p>}
                {mostrar.map((u) => {
                  const sig = prep.siguiente(u);
                  const motivo = sig ? prep.bloqueo(u, sig) : "";
                  const t = transitoDe(u.id);
                  const desde = prep.desdeCuando(u);
                  return (
                    <article key={u.id} className="rounded-xl bg-white p-3 shadow-card dark:bg-[#121a2b]" data-unidad={u.id}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <Link to={`/admin/inventario/${u.id}`} className="font-bold text-marino hover:underline dark:text-white">{u.id}</Link>
                          <p className="truncate text-[12.5px] text-slate-500">{nombre(u)}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-[12px] text-slate-500"><ColorPunto color={u.color} className="h-2.5 w-2.5" />{u.color}</span>
                      </div>
                      <p className="mt-2 text-[12.5px] text-slate-600 dark:text-white/70">{t ? <span className="font-semibold text-sky-700 dark:text-sky-300">En camino a {t.destino}</span> : u.ubicacion}</p>
                      {u.techo && u.techo !== "Sin techo" && <p className="mt-1 text-[12px] text-slate-500">{u.techo}{u.proveedorTecho ? ` de ${u.proveedorTecho}` : ""}{u.estadoTecho === "Pendiente de instalación" && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">(por instalar)</span>}</p>}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        {desde ? <span className="text-[11.5px] text-slate-400">{tiempoEnPaso(desde)}</span> : <span />}
                        {ultima && <Pill tono={TONO_DISPONIBILIDAD[u.disponibilidad]}>{u.disponibilidad}</Pill>}
                      </div>
                      {gestiona && !ultima && (
                        <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-white/10">
                          {sig && !motivo
                            ? <button className="btn btn-primary w-full !py-2 text-[13px]" onClick={() => setModal({ u, destino: sig })}>Pasar a «{sig}»</button>
                            : <p className="text-[12px] leading-snug text-amber-700 dark:text-amber-300">{motivo}</p>}
                          <button className="mt-1.5 w-full text-center text-[12.5px] font-semibold text-slate-500 hover:text-marino dark:hover:text-white" onClick={() => setModal({ u })}>Elegir otro paso</button>
                        </div>
                      )}
                      {gestiona && ultima && u.disponibilidad === "No disponible" && (
                        <div className="mt-2.5 border-t border-slate-100 pt-2.5 dark:border-white/10">
                          {prep.bloqueoLiberar(u)
                            ? <p className="text-[12px] leading-snug text-amber-700 dark:text-amber-300">Fuera de la venta: {prep.bloqueoLiberar(u)}</p>
                            : <button className="btn btn-primary w-full !py-2 text-[13px]" onClick={() => toast(prep.liberar(u))}>Liberar para la venta</button>}
                        </div>
                      )}
                      {gestiona && ultima && u.disponibilidad === "Disponible" && <button className="mt-2 w-full text-center text-[12.5px] font-semibold text-slate-500 hover:text-marino dark:hover:text-white" onClick={() => setModal({ u })}>Volver a un paso anterior</button>}
                    </article>
                  );
                })}
                {ultima && lista.length > VISIBLES_LISTAS && <button className="w-full rounded-lg py-2 text-[12.5px] font-semibold text-marino-700 hover:bg-white dark:text-white/80 dark:hover:bg-white/5" onClick={() => setVerListas(!verListas)}>{verListas ? "Ver menos" : `Ver las ${lista.length} listas`}</button>}
              </div>
            </section>
          );
        })}
      </div>
      {enProceso.length === 0 && <div className="mt-4"><Vacio titulo="No hay motos con esos filtros" texto="Cambia la sede o el modelo." /></div>}
      {!gestiona && <p className="mt-4 text-[12.5px] text-slate-400">Solo administración y gerencia cambian la preparación.</p>}

      <PreparacionModal unidad={modal?.u || null} destinoInicial={modal?.destino} onClose={() => setModal(null)} />
    </div>
  );
}
