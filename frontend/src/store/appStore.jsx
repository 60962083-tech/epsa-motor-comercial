import { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as D from "../data/mockData";
import { MODO_REAL } from "../lib/config";
import { modelosPublicos } from "../lib/api";
import { emparejarModelos, modeloDesdeApi } from "../lib/modelos";

/**
 * appStore — datos de toda la web (pública + panel).
 * Lo que el panel cambia (publicar/eliminar un modelo, horario de una sede,
 * descripción de un modelo, leads…) se guarda aquí y la web pública lo lee
 * de este mismo lugar, por eso los cambios se ven al instante en ambas.
 * En modo real, el catálogo público se contrasta con GET /api/modelos.
 */
const Ctx = createContext(null);
const CLAVE = "epsa-datos-v7"; // v7: color de cada foto, opiniones de clientes
try { ["epsa-datos-v4", "epsa-datos-v5", "epsa-datos-v6"].forEach((k) => localStorage.removeItem(k)); } catch { /* sin storage */ }

const BASE = () => ({
  modelos: D.MODELOS, ubicaciones: D.UBICACIONES, leads: D.LEADS, seguimientos: D.SEGUIMIENTOS,
  ventas: D.VENTAS, metas: D.METAS, equipo: D.EQUIPO, unidades: D.UNIDADES, compras: D.COMPRAS, opiniones: D.OPINIONES, actividad: [],
  config: { modoAusencia: false },
});

function cargar() {
  try {
    const g = localStorage.getItem(CLAVE);
    if (g) {
      const d = { ...BASE(), ...JSON.parse(g) };
      // Techos guardados con los nombres anteriores: se pasan a los tipos del backend (HU-004)
      // El voucher de un pedido se guardaba en «comprobante» (que es la boleta/factura): pasa a «voucherPago»
      d.ventas = (d.ventas || []).map((v) => (typeof v.comprobante === "string" ? { ...v, voucherPago: v.comprobante, comprobante: null } : v));
      d.unidades = (d.unidades || []).map((u) => { const techo = D.normalizarTecho(u.techo, u.proveedorTecho); return techo === u.techo ? u : { ...u, techo, proveedorTecho: D.TECHO_REQUIERE_PROVEEDOR(techo) ? u.proveedorTecho : "" }; });
      return d;
    }
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
      // El id va al final: un «id: undefined» en el objeto no debe borrar el id generado
      creado = { ...item, id: item.id !== undefined && item.id !== null && item.id !== "" ? item.id : siguienteId(p[ent]) };
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
  let sinFicha = [];
  if (apiModelos) { // null = el backend no respondió (se usa el catálogo local); [] = no hay modelos publicados
    const par = emparejarModelos(apiModelos, s.modelos);
    sinFicha = par.sinFicha;
    publicos = publicos
      .map((m) => {
        const a = par.porLocal.get(m.id);
        if (!a) return m.creadoEnPanel ? m : null; // los modelos creados en el panel se ven aunque el backend aún no los tenga
        return { ...m, codmodApi: String(a.codmod), descripcion: m.editadoEnPanel ? m.descripcion : a.desmod || m.descripcion, imagenApi: m.fotoPropia ? undefined : a.imagenes?.[0]?.urlimo };
      })
      .filter(Boolean);
    // Modelos que Michelle publica en Supabase y que la web aún no tiene: también se ven en la web (con datos básicos)
    const ocupados = new Set(s.modelos.map((m) => m.id));
    publicos = publicos.concat(par.sinFicha.map((a) => { const m = modeloDesdeApi(a, ocupados); ocupados.add(m.id); return m; }));
  }

  const api = {
    ...s, publicos, apiModelos, sinFicha,
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
