import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/**
 * ProtectedRoute (HU-007)
 * -----------------------------------------------------------------
 * Envuelve una pantalla que requiere un permiso puntual.
 * Si el rol actual no tiene ese permiso, en vez de mostrar la
 * pantalla, redirige a /dashboard/403.
 * Uso: <ProtectedRoute seccion="modelos"><ModelosAdmin /></ProtectedRoute>
 * -----------------------------------------------------------------
 */
export default function ProtectedRoute({ seccion, children }) {
  const { puedeVer } = useAuth();
  if (!puedeVer(seccion)) return <Navigate to="/dashboard/403" replace />;
  return children;
}
