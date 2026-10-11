// Datos de la web y del panel (compartidos)
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import * as D from "../data/mockData";
import { MODO_REAL } from "../lib/config";
import { modelosPublicos, sedesPublicasApi } from "../lib/api";
import { emparejarModelos, modeloDesdeApi } from "../lib/modelos";

const Ctx = createContext(null);
const CLAVE = "epsa-datos-v7";
try { ["epsa-datos-v4", "epsa-datos-v5", "epsa-datos-v6"].forEach((k) => localStorage.removeItem(k)); } catch {}

// Datos iniciales
const BASE = () => ({
  modelos: D.MODELOS, ubicaciones: D.UBICACIONES, leads: D.LEADS, seguimientos: D.SEGUIMIENTOS,
  ventas: D.VENTAS, metas: D.METAS, equipo: D.EQUIPO, unidades: D.UNIDADES, compras: D.COMPRAS, opiniones: D.OPINIONES, actividad: [],
  config: { modoAusencia: false },
});

// Cargar lo guardado en el navegador
function cargar() {
  try {
    const g = localStorage.getItem(CLAVE);
    if (g) {
      const d = { ...BASE(), ...JSON.parse(g) };
      d.ventas = (d.ventas || []).map((v) => (typeof v.comprobante === "string" ? { ...v, voucherPago: v.comprobante, comprobante: null } : v));
      d.unidades = (d.unidades || []).map((u) => { const techo = D.normalizarTecho(u.techo, u.proveedorTecho); return techo === u.techo ? u : { ...u, techo, proveedorTecho: D.TECHO_REQUIERE_PROVEEDOR(techo) ? u.proveedorTecho : "" }; });
      return d;
    }
  } catch {}
  return BASE();
}

const siguienteId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

// HU-010 · Sedes: Supabase + datos del panel
const claveSede = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/^\s*sede\s+/, "").replace(/[^a-z0-9]/g, "");
function unirSedes(api, ubicaciones) {
  const locales = ubicaciones.filter((u) => u.tipo === "Sede propia");
  const usadas = new Set();
  return api.map((a) => {
    const l = locales.find((x) => !usadas.has(x.id) && claveSede(x.nombre) === claveSede(a.nomsed));
    if (l) usadas.add(l.id);
    return {
      ...l, id: l?.id ?? `sede-${a.codsed}`, codsed: String(a.codsed), tipo: "Sede propia", activo: true,
      nombre: l?.nombre || String(a.nomsed || "").replace(/^\s*sede\s+/i, "").trim(),
      direccion: a.dirsed || l?.direccion || "", telefono: a.telsed || l?.telefono || "", correo: l?.correo || "",
      horario: a.horsed || l?.horario || "", horarioNota: a.horsed ? "" : l?.horarioNota || "",
    };
  });
}

// Proveedor de datos
export function AppProvider({ children }) {
  const [s, setS] = useState(cargar);
  const [apiModelos, setApiModelos] = useState(null);
  const [apiSedes, setApiSedes] = useState(null);
  const guardado = useRef("");

  // Guardar cambios en el navegador
  useEffect(() => {
    try {
      const t = JSON.stringify(s);
      if (t !== guardado.current) { guardado.current = t; localStorage.setItem(CLAVE, t); }
    } catch {}
  }, [s]);

  // Sincronizar pestañas del mismo navegador
  useEffect(() => {
    const alCambiar = (e) => {
      if (e.key !== CLAVE) return;
      if (e.newValue === null) { setS(BASE()); return; }
      if (e.newValue === guardado.current) return;
      guardado.current = e.newValue;
      setS(cargar());
    };
    window.addEventListener("storage", alCambiar);
    return () => window.removeEventListener("storage", alCambiar);
  }, []);

  // Catálogo y sedes desde la API
  useEffect(() => {
    if (!MODO_REAL) return;
    modelosPublicos().then((r) => setApiModelos(r.data)).catch(() => setApiModelos(null));
    sedesPublicasApi().then((r) => setApiSedes(Array.isArray(r.data) ? r.data : null)).catch(() => setApiSedes(null));
  }, []);

  // Agregar, editar y eliminar registros
  const registrar = useCallback((detalle, quien = "Sistema") => {
    setS((p) => ({ ...p, actividad: [{ id: Date.now() + Math.random(), fecha: new Date().toISOString(), detalle, quien }, ...p.actividad].slice(0, 60) }));
  }, []);

  const agregar = useCallback((ent, item, nota) => {
    let creado;
    setS((p) => {
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
    try { localStorage.removeItem(CLAVE); } catch {}
    setS(BASE());
  }, []);

  // Catálogo público (modelos publicados)
  let publicos = s.modelos.filter((m) => m.estado === "Publicado");
  let sinFicha = [];
  if (apiModelos) {
    const par = emparejarModelos(apiModelos, s.modelos);
    sinFicha = par.sinFicha;
    publicos = publicos
      .map((m) => {
        const a = par.porLocal.get(m.id);
        if (!a) return m.creadoEnPanel ? m : null;
        return { ...m, codmodApi: String(a.codmod), descripcion: m.editadoEnPanel ? m.descripcion : a.desmod || m.descripcion, imagenApi: m.fotoPropia ? undefined : a.imagenes?.[0]?.urlimo };
      })
      .filter(Boolean);
    const ocupados = new Set(s.modelos.map((m) => m.id));
    publicos = publicos.concat(par.sinFicha.map((a) => { const m = modeloDesdeApi(a, ocupados); ocupados.add(m.id); return m; }));
  }

  // Sedes de la web
  const sedes = apiSedes?.length ? unirSedes(apiSedes, s.ubicaciones) : s.ubicaciones.filter((u) => u.tipo === "Sede propia" && u.activo);

  const api = {
    ...s, publicos, apiModelos, sinFicha, apiSedes,
    agregar, actualizar, eliminar, reemplazar, restablecer, registrar, configurar,
    sedes,
    modelo: (id) => s.modelos.find((m) => m.id === id),
    togglePublicadoModelo: (id) => actualizar("modelos", id, (m) => ({ estado: m.estado === "Publicado" ? "Borrador" : "Publicado" })),
    toggleActivoUbicacion: (id) => actualizar("ubicaciones", id, (u) => ({ activo: !u.activo })),
  };
  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export const useApp = () => useContext(Ctx);
