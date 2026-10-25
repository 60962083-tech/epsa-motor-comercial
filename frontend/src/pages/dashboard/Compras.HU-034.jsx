// HU-034 · Compras a proveedor · HU-023: pendientes de identificación o recepción
import useAutoRefresco from "../../hooks/useAutoRefresco";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "../../components/dashboard/LinkPanel";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import { pendientesDeCompras, textoEspera, tonoEspera } from "../../servicios/comprasPendientes";
import { ColorPunto, EstadoConexion, Pestanas, Pill, fechaCorta } from "../../components/dashboard/Sprint2";
import { ModalRecibir, nombreModeloDe } from "../../components/dashboard/MovimientoModales";
import ComprasPendientesCentral from "../../components/dashboard/ComprasPendientesCentral";
import { comprasRecordadas, olvidarCompra } from "../../servicios/comprasRecientes";

export const ESTADO_COMPRA = { "Pendiente de factura": "bg-slate-200 text-slate-700", "Pendiente de identificación": "bg-amber-100 text-amber-700", Identificada: "bg-emerald-100 text-emerald-700" };

// Lista de compras
export default function Compras() {
  const { compras: locales, unidades, modelos, publicos } = useApp();
  const { puede, user } = useAuth();
  const [lista, setLista] = useState(MODO_REAL ? [] : locales);
  const [cargando, setCargando] = useState(MODO_REAL); const [errorApi, setErrorApi] = useState("");
  const [est, setEst] = useState(""); const [q, setQ] = useState("");
  const [vista, setVista] = useState(MODO_REAL ? "pendientes" : "todas");
  const [recibir, setRecibir] = useState(null);
  const abrioLista = useRef(false); // una sola vez: si falta la API de pendientes, se abre la lista de compras

  async function cargar(silencioso = false) {
    if (!MODO_REAL) { setLista(locales); return; }
    if (!silencioso) { setCargando(true); setErrorApi(""); }
    try { setLista((await api.listarCompras(100, 0)).data); } catch (e) { if (!silencioso) setErrorApi(mensajeError(e)); } finally { if (!silencioso) setCargando(false); }
  }
  useEffect(() => { cargar(); }, [locales]); // eslint-disable-line
  useAutoRefresco(() => cargar(true), 30000, MODO_REAL);

  // Compras abiertas o registradas desde este equipo que ya no están pendientes de factura (dato vigente de la API)
  const [recientes, setRecientes] = useState([]);
  useEffect(() => {
    if (!MODO_REAL) return;
    const enLista = new Set(lista.map((c) => String(c.codcom)));
    const ids = comprasRecordadas().filter((id) => !enLista.has(id)).slice(0, 15);
    if (!ids.length) { setRecientes([]); return; }
    let vivo = true;
    Promise.allSettled(ids.map((id) => api.obtenerCompra(id))).then((rs) => {
      if (!vivo) return;
      rs.forEach((r, i) => { if (r.status === "rejected" && r.reason?.status === 404) olvidarCompra(ids[i]); });
      setRecientes(rs.filter((r) => r.status === "fulfilled" && r.value?.data).map((r) => r.value.data));
    });
    return () => { vivo = false; };
  }, [lista]);

  const filtradas = useMemo(() => lista.filter((c) => (!est || c.estcom === est) && (!q || `${c.nommod} ${c.colcom} ${c.codcom}`.toLowerCase().includes(q.toLowerCase()))), [lista, est, q]);
  const pendientes = lista.filter((c) => c.estcom !== "Identificada");
  const gestiona = puede("compras.registrar");
  const pend = useMemo(() => pendientesDeCompras(lista, unidades), [lista, unidades]);
  const atrasadas = [...pend.porIdentificar, ...pend.porRecibir].filter((x) => x.espera > 7).length;

  return (
    <div>
      <PageHeader titulo="Compras a proveedor" subtitulo={MODO_REAL ? "Compras a Crosland: las facturas que llegan por correo registran la compra y sus motos; la compra manual queda como respaldo." : "Compras a Crosland: primero se registran pendientes de factura y luego se adjunta la factura y se identifican las motos."}>
        {vista !== "todas" && <EstadoConexion hu="HU-023" />}
        {MODO_REAL && vista === "todas" && <button className="btn btn-secondary !py-2.5" onClick={cargar}>Actualizar</button>}
        {MODO_REAL && puede("compras.factura") && <Link className="btn btn-secondary !py-2.5" to="/admin/facturas-recibidas">Facturas recibidas</Link>}
        {gestiona && <Link id="btn-nueva-compra" className="btn btn-acento !py-2.5 shadow-lg shadow-acento/25" to="/admin/compras/nueva">+ Registrar compra pendiente de factura</Link>}
      </PageHeader>
      {MODO_REAL && (
        <div className="mb-5">
          <Pestanas etiqueta="Compras" valor={vista} onCambio={setVista} opciones={[{ id: "pendientes", label: "Pendientes" }, { id: "todas", label: "Compras por completar", n: lista.length }]} />
        </div>
      )}
      {MODO_REAL && vista === "pendientes" && <ComprasPendientesCentral onSinApi={() => { if (!abrioLista.current) { abrioLista.current = true; setVista("todas"); } }} />}
      {(!MODO_REAL || vista === "todas") && <>
      {errorApi && <div className="mb-4"><Aviso tipo="error">{errorApi}</Aviso></div>}
      {/* Indicadores */}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Pendientes de factura" valor={lista.filter((c) => c.estcom === "Pendiente de factura").length} tono="rojo" />
        <Stat etiqueta="Pendientes de identificación" valor={lista.filter((c) => c.estcom === "Pendiente de identificación").length} tono="ambar" />
        <Stat etiqueta="Motos por identificar" valor={lista.reduce((a, c) => a + (Number(c.cantidad_pendiente) || 0), 0)} />
        <Stat etiqueta="Motos compradas" valor={lista.reduce((a, c) => a + (Number(c.cancom) || 0), 0)} tono="verde" />
      </div>
      {!MODO_REAL && (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Pestanas etiqueta="Compras" valor={vista} onCambio={setVista} opciones={[
          { id: "todas", label: "Todas las compras", n: lista.length },
          { id: "identificar", label: "Por identificar", n: pend.porIdentificar.length, alerta: true },
          { id: "recibir", label: "Por recibir", n: pend.porRecibir.length, alerta: true },
        ]} />
        {atrasadas > 0 && <p className="text-[13px] font-semibold text-acento">{atrasadas === 1 ? "1 pendiente lleva" : `${atrasadas} pendientes llevan`} más de 7 días</p>}
      </div>
      )}

      {/* HU-023 · Por identificar */}
      {vista === "identificar" && (pend.porIdentificar.length === 0 ? <Vacio titulo="Nada por identificar" texto="Todas las compras tienen su factura y las series de sus motos." /> : (
        <Tabla columnas={["N°", "Modelo", "Qué falta", "Comprada", "Esperando", "Acción"]}>
          {pend.porIdentificar.map((c) => (
            <tr key={c.codcom} data-pendiente-compra={c.codcom}>
              <td className="px-4 py-3 font-semibold">#{c.codcom}</td>
              <td className="px-4 py-3">{c.nommod}<span className="flex items-center gap-1.5 text-[12px] text-slate-400"><ColorPunto color={c.colcom} className="h-2.5 w-2.5" />{c.colcom}, {c.cancom} moto{Number(c.cancom) === 1 ? "" : "s"}</span></td>
              <td className="px-4 py-3"><span className="font-semibold text-marino dark:text-white">{c.falta}</span><span className="block text-[12px] text-slate-400">{c.estcom}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCorta(c.feccom)}</td>
              <td className="px-4 py-3"><Pill tono={tonoEspera(c.espera)}>{textoEspera(c.espera)}{c.espera > 7 ? ", atrasada" : ""}</Pill></td>
              <td className="px-4 py-3"><Link className={btnMini} to={`/admin/compras/${c.codcom}`}>{user.rol === "vendedor" ? "Ver" : c.accion}</Link></td>
            </tr>
          ))}
        </Tabla>
      ))}

      {/* HU-023 · Por recibir */}
      {vista === "recibir" && (pend.porRecibir.length === 0 ? <Vacio titulo="Nada por recibir" texto="Todas las motos identificadas ya llegaron a una sede o almacén." /> : (
        <Tabla columnas={["Compra", "Moto", "Modelo", "Identificada", "Esperando", "Acción"]}>
          {pend.porRecibir.map((u) => (
            <tr key={u.id} data-pendiente-recepcion={u.id}>
              <td className="px-4 py-3 font-semibold">{u.codcom ? <Link className="text-marino-700 hover:underline dark:text-white" to={`/admin/compras/${u.codcom}`}>#{u.codcom}</Link> : "—"}</td>
              <td className="px-4 py-3"><span className="font-semibold text-marino dark:text-white">{u.id}</span><span className="block text-[12px] text-slate-400">motor {u.motor} / chasis {u.chasis}</span></td>
              <td className="px-4 py-3">{nombreModeloDe(u, modelos, publicos)}<span className="flex items-center gap-1.5 text-[12px] text-slate-400"><ColorPunto color={u.color} className="h-2.5 w-2.5" />{u.color}</span></td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaCorta(u.desde)}</td>
              <td className="px-4 py-3"><Pill tono={tonoEspera(u.espera)}>{textoEspera(u.espera)}{u.espera > 7 ? ", atrasada" : ""}</Pill></td>
              <td className="px-4 py-3">{puede("unidades.gestionar") ? <button className={btnMini} onClick={() => setRecibir(u)}>Recibir</button> : <span className="text-[12.5px] text-slate-400">Solo administración</span>}</td>
            </tr>
          ))}
        </Tabla>
      ))}
      {vista === "todas" && <>
      <div className="mb-5 grid gap-3 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#121a2b] sm:grid-cols-3">
        <div><label className="field-label">Buscar</label><input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Modelo, color o N°" /></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option>{Object.keys(ESTADO_COMPRA).map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="flex items-end text-[13px] text-slate-500"><span className="pb-3">{pendientes.length} pendientes de {lista.length}</span></div>
      </div>
      {/* Tabla de compras */}
      {cargando ? <p className="py-10 text-center text-slate-400">Cargando compras…</p> : filtradas.length === 0 ? <Vacio titulo="No hay compras" texto="Registra la primera compra a proveedor." /> : (
        <Tabla columnas={["N°", "Modelo", "Color", "Cantidad", "Pendiente de identificar", "Fecha", "Estado", "Acciones"]}>
          {filtradas.map((c) => (
            <tr key={c.codcom}>
              <td className="px-4 py-3 font-semibold">#{c.codcom}</td>
              <td className="px-4 py-3">{c.nommod}</td><td className="px-4 py-3">{c.colcom}</td>
              <td className="px-4 py-3">{c.cancom}</td><td className="px-4 py-3">{c.cantidad_pendiente}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-500">{c.feccom} {c.horcom}</td>
              <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ESTADO_COMPRA[c.estcom] || "bg-slate-200"}`}>{c.estcom}</span></td>
              <td className="px-4 py-3"><Link className={btnMini} to={`/admin/compras/${c.codcom}`}>{user.rol === "vendedor" ? "Ver" : "Factura y unidades"}</Link></td>
            </tr>
          ))}
        </Tabla>
      )}
      {MODO_REAL && recientes.length > 0 && (
        <div className="mt-8" data-compras-recientes>
          <h2 className="font-bold text-marino dark:text-white">Compras recientes</h2>
          <p className="mb-3 text-[13px] text-slate-500">Compras que abriste o registraste desde este equipo y ya tienen su factura.</p>
          <Tabla columnas={["N°", "Modelo", "Color", "Cantidad", "Pendiente de identificar", "Estado", "Acciones"]}>
            {recientes.map((c) => (
              <tr key={c.codcom}>
                <td className="px-4 py-3 font-semibold">#{c.codcom}</td>
                <td className="px-4 py-3">{c.nommod}</td><td className="px-4 py-3">{c.colcom}</td>
                <td className="px-4 py-3">{c.cancom}</td><td className="px-4 py-3">{c.cantidad_pendiente}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-[12px] font-semibold ${ESTADO_COMPRA[c.estcom] || "bg-slate-200"}`}>{c.estcom}</span></td>
                <td className="px-4 py-3"><Link className={btnMini} to={`/admin/compras/${c.codcom}`}>{user.rol === "vendedor" ? "Ver" : "Factura y unidades"}</Link></td>
              </tr>
            ))}
          </Tabla>
        </div>
      )}
      </>}
      </>}

      <ModalRecibir unidad={recibir} onClose={() => setRecibir(null)} />
    </div>
  );
}
