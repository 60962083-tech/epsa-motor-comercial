import { useState } from "react";
import { MODELOS as INICIAL } from "../../data/mockData";
import Badge from "../../components/Badge";
import HUBadge from "../../components/HUBadge";

/**
 * ModelosAdmin.jsx — HU-012
 * "Administrar modelos publicados" (borrador / publicado)
 * -----------------------------------------------------------------
 * Publicar/retirar un modelo aquí SÍ cambia lo que ves en /modelos
 * (la web pública), porque ambas pantallas leen del mismo arreglo
 * MODELOS de mockData.js. El día que exista Supabase, las dos
 * pantallas van a leer la misma tabla, así que el comportamiento
 * ya queda correcto desde ahora.
 * -----------------------------------------------------------------
 */
export default function ModelosAdmin() {
  const [modelos, setModelos] = useState(INICIAL);

  function alternarPublicacion(id) {
    setModelos((prev) =>
      prev.map((m) => (m.id === id ? { ...m, estado: m.estado === "Publicado" ? "Borrador" : "Publicado" } : m))
    );
  }

  return (
    <div>
      <HUBadge code="HU-012" titulo="Administrar modelos publicados" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marino dark:text-white">Gestión de modelos</h1>
          <p className="text-slate-500">El catálogo describe modelos comerciales; no representa las unidades físicas del stock.</p>
        </div>
        <button className="btn btn-primary btn-sm">+ Nuevo modelo</button>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-slate-200 dark:border-white/10">
        <table className="w-full text-[14px]">
          <thead className="bg-marino-50 text-left text-[13px] text-marino dark:bg-white/5 dark:text-white/70">
            <tr><th className="px-4 py-3">Modelo</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {modelos.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{m.nombre}</td>
                <td className="px-4 py-3"><Badge estado={m.estado} /></td>
                <td className="px-4 py-3 space-x-3">
                  <button className="font-medium text-marino-700 hover:underline dark:text-white/70">Editar</button>
                  <button onClick={() => alternarPublicacion(m.id)} className="font-medium text-marino-700 hover:underline dark:text-white/70">
                    {m.estado === "Publicado" ? "Retirar" : "Publicar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl2 bg-marino-50 p-4 text-[13.5px] text-marino dark:bg-white/5 dark:text-white/70">
        Solo los modelos en estado Publicado aparecen en la web pública. Pruébalo: retira "Torito" aquí
        y luego mira el catálogo público, ya no debería aparecer.
      </div>
    </div>
  );
}
