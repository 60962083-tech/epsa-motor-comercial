import { Link } from "react-router-dom";
import { IconLock } from "../../components/Icons";
import HUBadge from "../../components/HUBadge";

/**
 * Prohibido.jsx — HU-007, vista 403
 * A esta pantalla llega cualquiera cuyo rol no tenga permiso para
 * la sección que intentó abrir (lo decide ProtectedRoute.jsx).
 */
export default function Prohibido() {
  return (
    <div className="fade-in mx-auto max-w-md py-16 text-center">
      <HUBadge code="HU-007" titulo="Acceso denegado (403)" />
      <IconLock className="mx-auto text-slate-300" />
      <h1 className="mt-4 text-xl font-bold">No tienes acceso a esta sección</h1>
      <p className="mt-2 text-slate-500">
        Tu rol actual no tiene permiso para ver esta pantalla. Si crees que es un error,
        pídele a Flavio o a Deysi que revisen tu rol.
      </p>
      <Link to="/dashboard" className="btn btn-primary mt-6">Volver al resumen</Link>
    </div>
  );
}
