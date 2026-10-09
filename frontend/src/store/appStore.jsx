import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as D from "../data/mockData";
import { MODO_REAL } from "../lib/config";
import { modelosPublicos } from "../lib/api";

/**
 * appStore — datos de toda la web (pública + panel).
 * Lo que el panel cambia (publicar/eliminar un modelo, horario de una sede,
 * descripción de un modelo, leads…) se guarda aquí y la web pública lo lee
 * de este mismo lugar, por eso los cambios se ven al instante en ambas.
 * En modo real, el catálogo público se contrasta con GET /api/modelos (HU-012).
 */
const Ctx = createContext(null);
const CLAVE = "epsa-datos-v5"; // v5: nuevas cuentas de acceso (admin, vend, geren)
try { localStorage.removeItem("epsa-datos-v4"); } catch { /* sin storage */ }

const BASE = () => ({
  modelos: D.MODELOS, ubicaciones: D.UBICACIONES, leads: D.LEADS, seguimientos: D.SEGUIMIENTOS,
  ventas: D.VENTAS, metas: D.METAS, equipo: D.EQUIPO, unidades: D.UNIDADES, compras: D.COMPRAS, actividad: [],
  config: { modoAusencia: false },
});

function cargar() {
  try {
    const g = localStorage.getItem(CLAVE);
    if (g) return { ...BASE(), ...JSON.parse(g) };
  } catch { /* storage no disponible */ }
  return BASE();
}

const siguienteId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

export function AppProvider({ children }) {
  const [s, setS] = useState(cargar);
  const [apiModelos, setApiModelos] = useState(null); // null = sin datos del backend

  useEffect(() => {
    try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* sin storage */ }
  }, [s]);

  // Modo real: catálogo público desde el backend (solo modelos Publicado)
  useEffect(() => {
    if (!MODO_REAL) return;
    modelosPublicos().then((r) => setApiModelos(r.data)).catch(() => setApiModelos(null));
  }, []);

  const registrar = useCallback((detalle, quien = "Sistema") => {
    setS((p) => ({ ...p, actividad: [{ id: Date.now() + Math.random(), fecha: new Date().toISOString(), detalle, quien }, ...p.actividad].slice(0, 60) }));
  }, []);

  const agregar = useCallback((ent, item, nota) => {
    let creado;
    setS((p) => {
      creado = { id: typeof item.id !== "undefined" ? item.id : siguienteId(p[ent]), ...item };
      return { ...p, [ent]: [creado, ...p[ent]] };
    });
    if (nota) registrar(nota);
    return creado;
  }, [registrar]);

  const actualizar = useCallback((ent, id, patch, nota) => {
    setS((p) => ({ ...p, [ent]: p[ent].map((x) => (x.id === id ? { ...x, ...(typeof patch === "function" ? patch(x) : patch) } : x)) }));
    if (nota) registrar(nota);
  }, [registrar]);

  const eliminar = useCallback((ent, id, nota) => {
    setS((p) => ({ ...p, [ent]: p[ent].filter((x) => x.id !== id) }));
    if (nota) registrar(nota);
  }, [registrar]);

  const reemplazar = useCallback((ent, lista) => setS((p) => ({ ...p, [ent]: lista })), []);
  const configurar = useCallback((patch, nota) => { setS((p) => ({ ...p, config: { ...p.config, ...patch } })); if (nota) registrar(nota); }, [registrar]);
  const restablecer = useCallback(() => {
    try { localStorage.removeItem(CLAVE); } catch { /* */ }
    setS(BASE());
  }, []);

  // Catálogo público: modelos Publicado (y, en modo real, confirmados por el backend)
  let publicos = s.modelos.filter((m) => m.estado === "Publicado");
  if (apiModelos && apiModelos.length) {
    const norm = (t) => String(t || "").toLowerCase().replace(/\s+/g, " ").trim();
    const locales = publicos;
    publicos = publicos
      .map((m) => {
        const a = apiModelos.find((x) => String(x.codmod) === String(m.codmod) || norm(x.nommod) === norm(m.nombre));
        if (!a) return null;
        return { ...m, descripcion: a.desmod || m.descripcion, imagenApi: a.imagenes?.[0]?.urlimo };
      })
      .filter(Boolean);
    if (publicos.length === 0) publicos = locales; // nombres del backend aún no coinciden: no dejamos la web vacía
  }

  const api = {
    ...s, publicos, apiModelos,
    agregar, actualizar, eliminar, reemplazar, restablecer, registrar, configurar,
    // atajos usados por la web pública
    sedes: s.ubicaciones.filter((u) => u.tipo === "Sede propia" && u.activo),
    modelo: (id) => s.modelos.find((m) => m.id === id),
    togglePublicadoModelo: (id) => actualizar("modelos", id, (m) => ({ estado: m.estado === "Publicado" ? "Borrador" : "Publicado" })),
    toggleActivoUbicacion: (id) => actualizar("ubicaciones", id, (u) => ({ activo: !u.activo })),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
export const useCatalog = useApp;
