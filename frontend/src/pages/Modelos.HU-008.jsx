import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FILTROS_CATALOGO } from "../data/mockData";
import { useCatalog } from "../store/catalogStore.jsx";
import MotoIllustration from "../components/MotoIllustration";
import HUBadge from "../components/HUBadge";

/**
 * Modelos.jsx — HU-008 "Explorar modelos en un catálogo"
 * Solo se listan los modelos "Publicado". Sin resultados (o catálogo
 * vacío) muestra un estado vacío claro, no una pantalla en blanco.
 * Filtros: tipo de motor, combustible, uso y tipo de techo, igual que
 * en epsamotor.com.pe. Los valores salen de FILTROS_CATALOGO.
 */
const FILTROS_INICIALES = { tipoMotor: "Todos", combustible: "Todos", uso: "Todos", tipoTecho: "Todos" };

export default function Modelos() {
  const { modelos: MODELOS } = useCatalog();
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);

  function actualizarFiltro(campo, valor) {
    setFiltros((f) => ({ ...f, [campo]: valor }));
  }

  function limpiarFiltros() {
    setFiltros(FILTROS_INICIALES);
  }

  const publicados = useMemo(() => {
    return MODELOS.filter((m) => {
      if (m.estado !== "Publicado") return false;
      if (filtros.tipoMotor !== "Todos" && m.tipoMotor !== filtros.tipoMotor) return false;
      if (filtros.combustible !== "Todos" && m.combustible !== filtros.combustible) return false;
      if (filtros.uso !== "Todos" && m.uso !== filtros.uso) return false;
      if (filtros.tipoTecho !== "Todos" && m.tipoTecho !== filtros.tipoTecho) return false;
      return true;
    });
  }, [filtros, MODELOS]);

  const hayFiltrosActivos = Object.values(filtros).some((v) => v !== "Todos");

  return (
    <div className="fade-in mx-auto max-w-6xl px-6 py-14">
      <HUBadge code="HU-008" titulo="Explorar modelos en un catálogo" />
      <div>
        <h1 className="text-2xl font-bold text-marino dark:text-white">Modelos</h1>
        <p className="mt-1 text-slate-500">Explora los modelos publicados por EPSA Motor.</p>
      </div>

      {/* ---------- Filtros ---------- */}
      <div className="mt-6 flex flex-wrap items-end gap-3 rounded-xl2 border border-slate-100 bg-white p-4 dark:border-white/10 dark:bg-[#121a2b]">
        <div className="min-w-[160px]">
          <label className="field-label">Tipo de motor</label>
          <select className="field-input" value={filtros.tipoMotor} onChange={(e) => actualizarFiltro("tipoMotor", e.target.value)}>
            <option>Todos</option>
            {FILTROS_CATALOGO.tipoMotor.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="field-label">Combustible</label>
          <select className="field-input" value={filtros.combustible} onChange={(e) => actualizarFiltro("combustible", e.target.value)}>
            <option>Todos</option>
            {FILTROS_CATALOGO.combustible.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="field-label">Uso</label>
          <select className="field-input" value={filtros.uso} onChange={(e) => actualizarFiltro("uso", e.target.value)}>
            <option>Todos</option>
            {FILTROS_CATALOGO.uso.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="field-label">Techo (HU-004)</label>
          <select className="field-input" value={filtros.tipoTecho} onChange={(e) => actualizarFiltro("tipoTecho", e.target.value)}>
            <option>Todos</option>
            {FILTROS_CATALOGO.tipoTecho.map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        {hayFiltrosActivos && (
          <button onClick={limpiarFiltros} className="text-[13px] font-medium text-marino-700 hover:underline dark:text-white/60">
            Limpiar filtros
          </button>
        )}
      </div>

      {publicados.length === 0 ? (
        // ---------- Ningún modelo calza con el filtro elegido ----------
        <div className="mt-6 rounded-xl2 border-2 border-dashed border-slate-200 bg-slate-50 py-16 text-center dark:border-white/10 dark:bg-white/5">
          <MotoIllustration className="mx-auto w-28 opacity-40" />
          <h2 className="mt-4 text-lg font-semibold">Ningún modelo coincide con estos filtros</h2>
          <p className="mt-1 text-slate-500">Prueba con otra combinación de motor, combustible, uso o techo.</p>
          <button onClick={limpiarFiltros} className="btn btn-secondary mt-5">Limpiar filtros</button>
        </div>
      ) : (
        // ---------- Grilla de modelos: 1 col en celular, 2 en tablet, 3 en desktop ----------
        <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {publicados.map((m) => (
            <Link
              key={m.id}
              to={`/modelos/${m.id}`}
              className="group rounded-xl2 border border-slate-100 bg-white p-5 shadow-card transition hover:-translate-y-1 hover:shadow-cardHover dark:border-white/5 dark:bg-[#121a2b]"
            >
              <div className="overflow-hidden rounded-lg bg-marino-50 dark:bg-white/5">
                <img src={m.imagen} alt={m.nombre} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-2">
                <h3 className="text-[15.5px] font-semibold text-marino dark:text-white">{m.nombre}</h3>
                <span className="shrink-0 rounded-full bg-marino-50 px-2.5 py-1 text-[11px] font-semibold text-marino-700 dark:bg-white/10 dark:text-white/70">{m.precio}</span>
              </div>
              <p className="text-[12.5px] text-slate-400">{m.tipoMotor} · {m.combustible} · {m.uso}</p>
              <span className="text-[13.5px] font-medium text-marino-700 dark:text-white/60">Ver ficha →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
