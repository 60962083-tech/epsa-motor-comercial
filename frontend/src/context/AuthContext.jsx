// HU-007 · Sesión y permisos por rol
import { createContext, useContext, useState } from "react";
import { ROLES } from "../data/mockData";
import { cerrarSesionApi } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { const s = JSON.parse(sessionStorage.getItem("epsa-user") || "null"); return s?.v === 4 ? s : null; } catch { return null; }
  });

  // Iniciar y cerrar sesión
  function login(nombre, rol, extra = {}) {
    const nuevo = { nombre, rol, ...extra, v: 4 };
    try { sessionStorage.setItem("epsa-user", JSON.stringify(nuevo)); } catch {}
    setUser(nuevo);
  }
  function logout() {
    try { sessionStorage.removeItem("epsa-user"); } catch {}
    cerrarSesionApi();
    setUser(null);
  }
  // Permisos: secciones del menú y acciones
  const puedeVer = (seccion) => !!user && !!ROLES[user.rol]?.puede.includes(seccion);
  const puede = (accion) => {
    const p = user ? ROLES[user.rol]?.permisos || [] : [];
    return p.includes("*") || p.includes(accion);
  };

  return <AuthContext.Provider value={{ user, login, logout, puedeVer, puede }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
