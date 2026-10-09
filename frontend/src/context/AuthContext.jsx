import { createContext, useContext, useState } from "react";
import { ROLES } from "../data/mockData";
import { cerrarSesionApi } from "../lib/api";

/**
 * AuthContext (HU-007)
 * Guarda el usuario y su rol. En modo real el rol viene de Supabase
 * (rpc hu007_usuario_actual); en demostración, de los atajos del login.
 * puedeVer(seccion) → menú / rutas. puede(accion) → botones (eliminar, mover…).
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Las sesiones guardadas por versiones anteriores del panel se descartan (v: 4)
    try { const s = JSON.parse(sessionStorage.getItem("epsa-user") || "null"); return s?.v === 4 ? s : null; } catch { return null; }
  });

  function login(nombre, rol, extra = {}) {
    const nuevo = { nombre, rol, ...extra, v: 4 };
    try { sessionStorage.setItem("epsa-user", JSON.stringify(nuevo)); } catch { /* */ }
    setUser(nuevo);
  }
  function logout() {
    try { sessionStorage.removeItem("epsa-user"); } catch { /* */ }
    cerrarSesionApi();
    setUser(null);
  }
  const puedeVer = (seccion) => !!user && !!ROLES[user.rol]?.puede.includes(seccion);
  const puede = (accion) => {
    const p = user ? ROLES[user.rol]?.permisos || [] : [];
    return p.includes("*") || p.includes(accion);
  };

  return <AuthContext.Provider value={{ user, login, logout, puedeVer, puede }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
