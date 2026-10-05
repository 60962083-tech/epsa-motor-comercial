import { Link } from "react-router-dom";
import { UNIDADES } from "../../data/mockData";
import Badge from "../../components/Badge";

/**
 * Unidades.jsx
 * Lista de unidades registradas. No es una de las 10 historias
 * pedidas, pero es el punto desde donde se entra a HU-002
 * (vincular/completar identificación) y a HU-004 (techo), así que
 * tiene que existir para que esas dos pantallas sean alcanzables.
 */
export default function Unidades() {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-marino dark:text-white">Unidades</h1>
          <p className="text-slate-500">Una unidad puede estar en una sede y, aun así, no estar disponible para la venta.</p>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl2 border border-slate-200 dark:border-white/10">
        <table className="w-full text-[14px]">
          <thead className="bg-marino-50 text-left text-[13px] text-marino dark:bg-white/5 dark:text-white/70">
            <tr>
              <th className="px-4 py-3">Identificador</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Techo</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/10">
            {UNIDADES.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                <td className="px-4 py-3 font-medium">{u.id}</td>
                <td className="px-4 py-3">{u.modelo}</td>
                <td className="px-4 py-3">{u.ubicacion}</td>
                <td className="px-4 py-3">{u.techo}</td>
                <td className="px-4 py-3"><Badge estado={u.estado} /></td>
                <td className="px-4 py-3">
                  <Link to={`/dashboard/unidades/${u.id}/vincular`} className="mr-3 font-medium text-marino-700 hover:underline dark:text-white/70">
                    Identificar
                  </Link>
                  <Link to={`/dashboard/unidades/${u.id}/techo`} className="font-medium text-marino-700 hover:underline dark:text-white/70">
                    Techo
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl2 bg-marino-50 p-4 text-[13.5px] text-marino dark:bg-white/5 dark:text-white/70">
        Esta vista no emite comprobantes ni registra pagos. Las boletas y el pago se manejan fuera del sistema.
      </div>
    </div>
  );
}
