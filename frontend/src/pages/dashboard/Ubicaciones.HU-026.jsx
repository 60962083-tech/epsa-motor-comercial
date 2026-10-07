import { useCatalog } from "../../store/catalogStore.jsx";
import Badge from "../../components/Badge";
import HUBadge from "../../components/HUBadge";

/**
 * Ubicaciones.jsx — HU-026 "Administrar las ubicaciones de trabajo"
 * Desactivar una sede aquí la saca de verdad de la web pública (/sedes),
 * porque ambas pantallas comparten el mismo catálogo (useCatalog).
 */
export default function Ubicaciones() {
  const { ubicaciones: lista, toggleActivoUbicacion } = useCatalog();

  function alternar(u) {
    const accion = u.activo ? "desactivar" : "activar";
    if (!window.confirm(`¿Seguro que quieres ${accion} "${u.nombre}"?`)) return;
    toggleActivoUbicacion(u.id);
  }

  return (
    <div>
      <HUBadge code="HU-026" titulo="Administrar las ubicaciones de trabajo" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marino dark:text-white">Gestión de ubicaciones</h1>
          <p className="text-slate-500">Evita escribir el mismo lugar con nombres distintos en otras pantallas.</p>
        </div>
        <button className="btn btn-primary btn-sm">+ Ubicación</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-slate-200 dark:border-white/10">
        <table className="w-full text-[14px]">
          <thead className="bg-marino-50 text-left text-[13px] text-marino dark:bg-white/5 dark:text-white/70">
            <tr><th className="px-4 py-3">Ubicación</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {lista.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{u.nombre}</td>
                <td className="px-4 py-3 text-slate-500">{u.tipo}</td>
                <td className="px-4 py-3"><Badge estado={u.activo ? "Activo" : "Inactivo"} /></td>
                <td className="px-4 py-3">
                  <button onClick={() => alternar(u)} className="font-medium text-marino-700 hover:underline dark:text-white/70">
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[12.5px] text-slate-400">
        Una ubicación desactivada deja de ofrecerse para nuevos registros, pero conserva su historial.
      </p>
    </div>
  );
}
