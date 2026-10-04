import { useState } from "react";
import { UBICACIONES as INICIAL } from "../../data/mockData";
import Badge from "../../components/Badge";
import HUBadge from "../../components/HUBadge";

/**
 * Ubicaciones.jsx — HU-026
 * "Administrar las ubicaciones de trabajo" (catálogo y desactivación)
 * -----------------------------------------------------------------
 * Lista las sedes propias y los proveedores/almacenes externos.
 * El botón Activar/Desactivar sí cambia el estado en pantalla (useState
 * local), para que se sienta real; lo único que falta es que, en vez
 * de vivir en memoria del navegador, quede guardado en Supabase.
 * -----------------------------------------------------------------
 */
export default function Ubicaciones() {
  const [lista, setLista] = useState(INICIAL);

  function alternar(id) {
    setLista((prev) => prev.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u)));
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
                  <button onClick={() => alternar(u.id)} className="font-medium text-marino-700 hover:underline dark:text-white/70">
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
