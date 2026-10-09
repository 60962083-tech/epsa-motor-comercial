import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../store/appStore.jsx";
import { useAuth } from "../../context/AuthContext";
import { formatoSoles, SEDES_ATENCION } from "../../data/mockData";
import { Card, PageHeader, Stat } from "../../components/ui";
import { BarChart, LineChart, Donut, RankingBarras } from "../../components/charts";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function ultimosMeses(n) {
  const h = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(h.getFullYear(), h.getMonth() - (n - 1 - i), 1);
    return { clave: d.toISOString().slice(0, 7), etiqueta: MESES[d.getMonth()] };
  });
}

/** Resumen operativo: KPIs, gráficos interactivos y puesta en marcha comercial. */
export default function Resumen() {
  const { user } = useAuth();
  const { ventas, leads, unidades, seguimientos, modelos, ubicaciones, equipo, metas, actividad } = useApp();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [sede, setSede] = useState("Todas");
  const [metrica, setMetrica] = useState("cantidad");

  const en = (f) => (!desde || f >= desde) && (!hasta || f <= hasta);
  const V = useMemo(() => ventas.filter((v) => en(v.fecha) && (sede === "Todas" || v.sede === sede)), [ventas, desde, hasta, sede]); // eslint-disable-line
  const L = useMemo(() => leads.filter((l) => en(l.fecha) && (sede === "Todas" || l.sede === sede)), [leads, desde, hasta, sede]); // eslint-disable-line
  const U = unidades.filter((u) => sede === "Todas" || u.ubicacion === sede);
  const nombreModelo = (id) => modelos.find((m) => m.id === id)?.nombre || id;

  const cerradas = V.filter((v) => ["Pedido registrado", "Entregado"].includes(v.etapa));
  const solicitudes = ventas.filter((v) => v.etapa === "Solicitud web").length;
  const sinAsignar = leads.filter((l) => (l.responsable === "Sin asignar" || !l.responsable) && !["Cerrado ganado", "Perdido"].includes(l.estado)).length;
  const ingresos = cerradas.reduce((s, v) => s + v.total, 0);
  const adelantos = cerradas.reduce((s, v) => s + v.adelanto, 0);
  const ganados = L.filter((l) => l.estado === "Cerrado ganado").length;
  const conv = L.length ? Math.round((ganados / L.length) * 100) : 0;
  const hoy = new Date().toISOString().slice(0, 10);
  const pendSeg = seguimientos.filter((s) => !s.hecho);
  const vencidos = pendSeg.filter((s) => s.fecha < hoy).length;
  const disp = U.filter((u) => u.disponibilidad === "Disponible").length;
  const transito = U.filter((u) => !u.ubicacion).length;

  const meses = ultimosMeses(6);
  const porMes = meses.map((m) => {
    const vs = cerradas.filter((v) => v.fecha.startsWith(m.clave));
    return { etiqueta: m.etiqueta, cantidad: vs.length, monto: vs.reduce((s, v) => s + v.total, 0), leads: L.filter((l) => l.fecha.startsWith(m.clave)).length };
  });

  const cuenta = (arr, fn) => { const o = {}; arr.forEach((x) => { const k = fn(x); o[k] = (o[k] || 0) + 1; }); return Object.entries(o).map(([k, v]) => ({ id: k, etiqueta: k, v })).sort((a, b) => b.v - a.v); };
  const ventasModelo = cuenta(cerradas, (v) => nombreModelo(v.modelo)).slice(0, 6);
  const canales = cuenta(L, (l) => l.canal);
  const embudo = ["Nuevo", "En seguimiento", "Cotizado", "Cerrado ganado", "Perdido"].map((e) => ({ etiqueta: e.replace("Cerrado ganado", "Ganado"), v: L.filter((l) => l.estado === e).length }));
  const consultados = cuenta(L, (l) => l.modelo).map((d) => ({ ...d, etiqueta: nombreModelo(d.id) })).slice(0, 6);
  const inventarioPorUbic = cuenta(unidades, (u) => u.ubicacion || "Sin recepción");

  const mesActual = new Date().toISOString().slice(0, 7);
  const lista = [
    ["Hay sedes activas", ubicaciones.some((u) => u.tipo === "Sede propia" && u.activo), "/admin/ubicaciones"],
    ["Hay modelos publicados", modelos.some((m) => m.estado === "Publicado"), "/admin/modelos"],
    ["Hay vendedores activos", equipo.some((p) => p.rol === "vendedor" && p.activo), "/admin/equipo"],
    ["Inventario cargado", unidades.length > 0, "/admin/inventario"],
    ["Metas del mes registradas", metas.some((m) => m.mes === mesActual), "/admin/metas"],
  ];

  return (
    <div>
      <PageHeader titulo={`Hola, ${String(user.nombre).split(" ")[0]}`} subtitulo="Resumen operativo de EPSA Motor. Pasa el mouse (o toca) los gráficos para ver el detalle.">
        {import.meta.env.VITE_ROUTER !== "memory" && <button className="btn btn-secondary !py-2" onClick={() => window.print()}>Imprimir</button>}
      </PageHeader>

      <Card className="mb-6 flex flex-wrap items-end gap-3">
        <div><label className="field-label">Desde</label><input type="date" className="field-input" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
        <div><label className="field-label">Hasta</label><input type="date" className="field-input" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        <div><label className="field-label">Sede</label>
          <select className="field-input" value={sede} onChange={(e) => setSede(e.target.value)}><option>Todas</option>{SEDES_ATENCION.map((s) => <option key={s}>{s}</option>)}</select>
        </div>
        {(desde || hasta || sede !== "Todas") && <button className="pb-3 text-[13px] font-semibold text-acento hover:underline" onClick={() => { setDesde(""); setHasta(""); setSede("Todas"); }}>Limpiar filtros</button>}
      </Card>

      {(solicitudes > 0 || sinAsignar > 0) && (
        <div className="mb-6 grid gap-3 md:grid-cols-2">
          {solicitudes > 0 && <Link to="/admin/ventas" className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-amber-900 transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"><span><b className="cifra text-[18px]">{solicitudes}</b> {solicitudes === 1 ? "solicitud de compra" : "solicitudes de compra"} desde la web por atender</span><span className="text-[13px] font-semibold">Ver en Ventas</span></Link>}
          {sinAsignar > 0 && <Link to="/admin/leads" className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-5 py-4 text-sky-900 transition hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100"><span><b className="cifra text-[18px]">{sinAsignar}</b> {sinAsignar === 1 ? "lead sin asignar" : "leads sin asignar"}</span><span className="text-[13px] font-semibold">Repartir en Leads</span></Link>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat etiqueta="Ventas registradas" valor={cerradas.length} nota={`${V.filter((v) => v.etapa === "Cotización").length} cotizaciones abiertas`} />
        <Stat etiqueta="Ingresos" valor={formatoSoles(ingresos)} nota={`Adelantos: ${formatoSoles(adelantos)}`} tono="verde" />
        <Stat etiqueta="Leads" valor={L.length} nota={`Conversión ${conv}%`} />
        <Stat etiqueta="Seguimientos pendientes" valor={pendSeg.length} nota={vencidos ? `${vencidos} vencidos` : "Al día"} tono={vencidos ? "rojo" : "marino"} />
        <Stat etiqueta="Unidades en inventario" valor={U.length} nota={`${disp} disponibles`} />
        <Stat etiqueta="Por recibir" valor={transito} nota="Identificadas, sin recepción física" tono="ambar" />
        <Stat etiqueta="Modelos publicados" valor={modelos.filter((m) => m.estado === "Publicado").length} nota={`de ${modelos.length} en catálogo`} />
        <Stat etiqueta="Entregas pendientes" valor={cerradas.filter((v) => v.etapa === "Pedido registrado").length} nota="Pedidos por entregar" tono="ambar" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-marino dark:text-white">Ventas por mes</h2>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-[12.5px] dark:bg-white/10">
              {[["cantidad", "Unidades"], ["monto", "Monto"]].map(([k, l]) => (
                <button key={k} onClick={() => setMetrica(k)} className={`rounded-md px-3 py-1 font-semibold ${metrica === k ? "bg-white text-marino shadow dark:bg-marino-700 dark:text-white" : "text-slate-500"}`}>{l}</button>
              ))}
            </div>
          </div>
          <BarChart datos={porMes} series={[{ clave: metrica, nombre: metrica === "monto" ? "Monto" : "Unidades" }]} formato={metrica === "monto" ? formatoSoles : (v) => v} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Ventas por modelo</h2>
          {ventasModelo.length ? <Donut datos={ventasModelo} tam={170} /> : <p className="py-8 text-center text-slate-400">Sin ventas en este periodo.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Leads por mes</h2>
          <LineChart ancho={380} alto={230} datos={porMes.map((m) => ({ etiqueta: m.etiqueta, v: m.leads }))} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Embudo de leads</h2>
          <BarChart datos={embudo.map((e) => ({ etiqueta: e.etiqueta.slice(0, 9), v: e.v }))} series={[{ clave: "v", nombre: "Leads" }]} ancho={380} alto={230} />
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-marino dark:text-white">Modelos más consultados</h2><Link to="/admin/leads" className="text-[12.5px] font-semibold text-marino-700 hover:underline dark:text-white/70">Ver leads →</Link></div>
          <RankingBarras datos={consultados} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Leads por canal</h2>
          <Donut datos={canales} tam={160} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Inventario por ubicación</h2>
          <Donut datos={inventarioPorUbic} tam={160} />
        </Card>
        <Card>
          <h2 className="mb-3 font-bold text-marino dark:text-white">Puesta en marcha comercial</h2>
          <ul className="space-y-2.5">
            {lista.map(([t, ok, to]) => (
              <li key={t}><Link to={to} className="flex items-center gap-3 rounded-lg p-1.5 text-[14px] hover:bg-slate-50 dark:hover:bg-white/5">
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold ${ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{ok ? "✓" : "!"}</span>{t}
              </Link></li>
            ))}
          </ul>
        </Card>
        <Card className="xl:col-span-3">
          <h2 className="mb-3 font-bold text-marino dark:text-white">Actividad reciente</h2>
          {actividad.length === 0 ? <p className="text-[13.5px] text-slate-400">Aún no hay movimientos. Lo que hagas en el panel (publicar un modelo, registrar un lead, editar una sede…) aparecerá aquí.</p> : (
            <ul className="divide-y divide-slate-100 text-[13.5px] dark:divide-white/10">
              {actividad.slice(0, 8).map((a) => <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span>{a.detalle}</span><span className="text-slate-400">{new Date(a.fecha).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" })} · {a.quien}</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
