import { createContext, useContext, useState, useEffect } from "react";
import { MODELOS as MODELOS_INICIAL, UBICACIONES as UBICACIONES_INICIAL } from "../data/mockData";

// Guarda el catálogo (modelos y ubicaciones) en localStorage para que
// publicar/retirar un modelo o activar/desactivar una sede se note en
// toda la web al instante, sin backend todavía. Cuando exista Supabase,
// este archivo se reemplaza por las consultas reales; las pantallas que
// usan useCatalog() no deberían cambiar mucho más allá de eso.
const CatalogContext = createContext(null);
const CLAVE_STORAGE = "epsa-catalogo-v1";

function cargarInicial() {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (guardado) return JSON.parse(guardado);
  } catch {
    // localStorage no disponible o dato corrupto: seguimos con los datos base
  }
  return { modelos: MODELOS_INICIAL, ubicaciones: UBICACIONES_INICIAL };
}

export function CatalogProvider({ children }) {
  const [estado, setEstado] = useState(cargarInicial);

  useEffect(() => {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(estado));
  }, [estado]);

  function togglePublicadoModelo(id) {
    setEstado((prev) => ({
      ...prev,
      modelos: prev.modelos.map((m) =>
        m.id === id ? { ...m, estado: m.estado === "Publicado" ? "Borrador" : "Publicado" } : m
      ),
    }));
  }

  function toggleActivoUbicacion(id) {
    setEstado((prev) => ({
      ...prev,
      ubicaciones: prev.ubicaciones.map((u) => (u.id === id ? { ...u, activo: !u.activo } : u)),
    }));
  }

  function restablecer() {
    localStorage.removeItem(CLAVE_STORAGE);
    setEstado({ modelos: MODELOS_INICIAL, ubicaciones: UBICACIONES_INICIAL });
  }

  return (
    <CatalogContext.Provider value={{ ...estado, togglePublicadoModelo, toggleActivoUbicacion, restablecer }}>
      {children}
    </CatalogContext.Provider>
  );
}

export const useCatalog = () => useContext(CatalogContext);
