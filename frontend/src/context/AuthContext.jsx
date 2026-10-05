import { createContext, useContext, useState } from "react";
import { ROLES } from "../data/mockData";

/**
 * AuthContext
 * -----------------------------------------------------------------
 * Guarda qué rol "inició sesión" para poder mostrar u ocultar
 * opciones del menú y bloquear pantallas (HU-007).
 *
 * TODO (Michelle): reemplazar login() por la llamada real a
 * Supabase Auth (supabase.auth.signInWithPassword) y, en vez de
 * guardar el rol que el usuario elige en un <select>, leerlo de la
 * tabla de usuarios según quién inició sesión.
 * -----------------------------------------------------------------
 */
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Se guarda en sessionStorage para no perder la sesión si recargan la página,
  // pero se borra al cerrar la pestaña (apropiado para una demo sin backend real).
  const [user, setUser] = useState(() => {
    const saved = sessionStorage.getItem("epsa-user");
    return saved ? JSON.parse(saved) : null;
  });

  function login(nombre, rol) {
    const nuevo = { nombre, rol };
    sessionStorage.setItem("epsa-user", JSON.stringify(nuevo));
    setUser(nuevo);
  }

  function logout() {
    sessionStorage.removeItem("epsa-user");
    setUser(null);
  }

  // true si el rol actual tiene permiso para ver una sección del menú
  function puedeVer(seccion) {
    if (!user) return false;
    return ROLES[user.rol]?.puede.includes(seccion);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, puedeVer }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
