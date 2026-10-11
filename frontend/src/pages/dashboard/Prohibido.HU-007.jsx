// HU-007 · Sin acceso (403)
import { Link } from "react-router-dom";
import { IconLock } from "../../components/Icons";

export default function Prohibido() {
  return (
    <div className="fade-in mx-auto max-w-md py-16 text-center">
      <IconLock className="mx-auto text-slate-300" />
      <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.18em] text-acento">Error 403</p>
      <h1 className="mt-1 text-xl font-bold">No tienes acceso a esta sección</h1>
      <p className="mt-2 text-slate-500">
        Tu rol actual no tiene permiso para ver esta pantalla. Si crees que es un error,
        pídele a la gerencia que revise tu rol en Equipo.
      </p>
      <Link to="/admin" className="btn btn-primary mt-6">Volver al resumen</Link>
    </div>
  );
}
