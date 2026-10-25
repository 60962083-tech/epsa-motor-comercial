// HU-007 · Sin acceso (403)
import { Link } from "../../components/dashboard/LinkPanel";
import { IconLock } from "../../components/Icons";

export default function Prohibido() {
  return (
    <div className="fade-in mx-auto max-w-md py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/60"><IconLock /></span>
      <h1 className="mt-5 text-xl font-bold text-marino dark:text-white">No tienes acceso a esta sección</h1>
      <p className="mt-2 text-slate-500">
        Tu rol no tiene permiso para ver esta pantalla, o la gerencia la desactivó en Roles y permisos.
        Si la necesitas, pídele a la gerencia que la active.
      </p>
      <Link to="/admin" className="btn btn-primary mt-6">Volver al resumen</Link>
    </div>
  );
}
