import { UNIDADES, LEADS } from "../../data/mockData";

/**
 * Resumen.jsx
 * No es una de las 10 historias que te pidieron, pero hace falta
 * como primera pantalla después de iniciar sesión. Se mantiene
 * simple a propósito.
 */
export default function Resumen() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-marino dark:text-white">Resumen</h1>
      <p className="mt-1 text-slate-500">Periodo: por definir. Solo considera registros existentes en el sistema.</p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl2 border border-marino-700/30 p-5">
          <p className="text-[13px] font-semibold text-marino dark:text-white/70">Unidades registradas</p>
          <p className="mt-1 text-3xl font-bold">{UNIDADES.length}</p>
        </div>
        <div className="rounded-xl2 border border-marino-700/30 p-5">
          <p className="text-[13px] font-semibold text-marino dark:text-white/70">Leads registrados</p>
          <p className="mt-1 text-3xl font-bold">{LEADS.length}</p>
        </div>
        <div className="rounded-xl2 border border-marino-700/30 p-5">
          <p className="text-[13px] font-semibold text-marino dark:text-white/70">Pendientes de seguimiento</p>
          <p className="mt-1 text-3xl font-bold">{LEADS.filter((l) => l.estado !== "Vendida").length}</p>
        </div>
      </div>
    </div>
  );
}
