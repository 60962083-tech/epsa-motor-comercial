// HU-007 · Ruta protegida por rol
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export default function ProtectedRoute({ seccion, children }) {
  const { puedeVer } = useAuth();
  if (!puedeVer(seccion)) return <Navigate to="/admin/403" replace />;
  return children;
}
