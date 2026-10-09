import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { MODO_REAL } from "../../lib/config";
import * as api from "../../lib/api";
import { mensajeError } from "../../lib/errores";
import { Aviso, PageHeader, Stat, Tabla, Vacio, btnMini } from "../../components/ui";
import HUBadge from "../../components/HUBadge";

export const ESTADO_COMPRA = { "Pendiente de factura": "bg-slate-200 text-slate-700", "Pendiente de identificación": "bg-amber-100 text-amber-700", Identificada: "bg-emerald-100 text-emerald-700" };

/**
 * Compras a proveedor — listado de HU-034. El formulario de registro está en RegistrarCompra.HU-034.jsx
 * (ruta /admin/compras/nueva) y el detalle con factura e identificación en CompraDetalle.HU-002.jsx.
 */
export default function Compras() {
  const { compras: locales } = useApp();
  const { puede, user } = useAuth();
  const [lista, setLista] = useState(MODO_REAL ? [] : locales);
  const [cargando, setCargando] = useState(MODO_REAL); const [errorApi, setErrorApi] = useState("");
  const [est, setEst] = useState(""); const [q, setQ] = useState("");

  async function cargar() {
    if (!MODO_REAL) { setLista(locales); return; }
    setCargando(true); setErrorApi("");
    try { setLista((await api.listarCompras(100, 0)).data); } catch (e) { setErrorApi(mensajeError(e)); } finally { setCargando(false); }
  }
  useEffect(() => { cargar(); }, [locales]); // eslint-disable-line

  const filtradas = useMemo(() => lista.filter((c) => (!est || c.estcom === est) && (!q || `${c.nommod} ${c.colcom} ${c.codcom}`.toLowerCase().includes(q.toLowerCase()))), [lista, est, q]);
  const pendientes = lista.filter((c) => c.estcom !== "Identificada");
  const gestiona = puede("compras.registrar");

  return (
    <div>
      <HUBadge code="HU-034" titulo="Registrar compra pendiente de factura" />
      <PageHeader titulo="Compras a proveedor" subtitulo="Compras a Crosland: se registran pendientes de factura (HU-034) y luego se completa la factura y la identificación de motos (HU-002).">
        {MODO_REAL && <button className="btn btn-secondary !py-2.5" onClick={cargar}>Actualizar</button>}
        {gestiona && <Link className="btn btn-primary !py-2.5" to="/admin/compras/nueva">+ Registrar compra pendiente de factura</Link>}
      </PageHeader>
      {errorApi && <div className="mb-4"><Aviso tipo="error">{errorApi}</Aviso></div>}
      {!MODO_REAL && <div className="mb-4"><Aviso tipo="aviso">Modo demostración: se simula el contrato de <b>POST/GET /api/compras</b> (incluida la clave de idempotencia).</Aviso></div>}
      {MODO_REAL && <div className="mb-4"><Aviso>Conectado a <b>/api/compras</b>: el listado del backend muestra las compras pendientes de factura o de identificación. Las identificadas se consultan por su número.</Aviso></div>}
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat etiqueta="Pendientes de factura" valor={lista.filter((c) => c.estcom === "Pendiente de factura").length} tono="rojo" />
        <Stat etiqueta="Pendientes de identificación" valor={lista.filter((c) => c.estcom === "Pendiente de identificación").length} tono="ambar" />
        <Stat etiqueta="Motos por identificar" valor={lista.reduce((a, c) => a + (Number(c.cantidad_pendiente) || 0), 0)} />
        <Stat etiqueta="Motos compradas" valor={lista.reduce((a, c) => a + (Number(c.cancom) || 0), 0)} tono="verde" />
      </div>
      <div className="mb-5 grid gap-3 rounded-xl2 border border-slate-100 bg-white p-4 shadow-card dark:border-white/10 dark:bg-[#121a2b] sm:grid-cols-3">
        <div><label className="field-label">Buscar</label><input className="field-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Modelo, color o N°" /></div>
        <div><label className="field-label">Estado</label><select className="field-input" value={est} onChange={(e) => setEst(e.target.value)}><option value="">Todos</option>{Object.keys(ESTADO_COMPRA).map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="flex items-end text-[13px] text-slate-500"><span className="pb-3">{pendientes.length} pendientes de {lista.length}</span></div>
      </div>
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

    </div>
  );
}
