// Sprint 2 · Servicios de la base central (API de Express + Supabase)
// Todas las lecturas y escrituras pasan por la API con la sesión del usuario: el navegador no guarda copias.
import { useCallback, useEffect, useRef, useState } from "react";
import { BUCKET_FOTOS, borrarArchivoStorage, cacheConsultas, modelosAdminApi, pedir, pedirBinario, seriesUnidadesApi, subirArchivoStorage, ubicacionInicialSqlApi } from "../lib/api";
import { ApiError, mensajeError } from "../lib/errores";
import useAutoRefresco from "../hooks/useAutoRefresco";

// Intervalo de actualización automática de las vistas abiertas del panel (además, al volver a la ventana o pestaña)
export const REFRESCO_MS = 5000;

// La misma lectura pedida a la vez por varias partes de una pantalla se hace una sola vez
// (solo mientras está en camino: la siguiente lectura siempre trae datos nuevos)
const enCurso = new Map();
function unaVez(clave, fn) {
  if (!enCurso.has(clave)) enCurso.set(clave, fn().finally(() => enCurso.delete(clave)));
  return enCurso.get(clave);
}

const consulta = (params = {}) => {
  const q = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "").map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  return q ? `?${q}` : "";
};

// Clave de intento (Idempotency-Key): la misma operación reenviada no se registra dos veces
export function nuevaClave() {
  try { if (crypto?.randomUUID) return crypto.randomUUID(); } catch {}
  const b = new Uint8Array(16);
  (globalThis.crypto || window.crypto).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// Una clave por intento: se conserva si la red falla (reintento seguro) y se renueva al cambiar los datos
export function useIntento() {
  const ref = useRef({ clave: "", firma: "" });
  return useCallback((firma) => {
    if (!ref.current.clave || ref.current.firma !== firma) ref.current = { clave: nuevaClave(), firma };
    return ref.current.clave;
  }, []);
}

// ¿El error significa que no hubo respuesta del servidor (puede haberse guardado o no)?
export const sinRespuesta = (e) => !e || e.status === 0 || e.status >= 500;

// HU-001 · Inventario central
// ---------------------------------------------------------------------------------------------
// HU-001 · Inventario central (GET /api/inventario de Michelle: páginas de hasta 100 motos)
// Se traduce a la forma que usan las pantallas; la situación comercial se muestra tal como está en la base.
// ---------------------------------------------------------------------------------------------
const COMERCIAL_API = { Disponible: "Libre" };
export function unidadDesdeApi(x = {}) {
  const prep = x.preparacion?.nomepr || "";
  return {
    coduni: String(x.coduni), codmod: x.modelo?.codmod ? String(x.modelo.codmod) : "", nommod: x.modelo?.nommod || "",
    coluni: x.color || "", nummotuni: x.nummotuni || "", chauni: x.chauni || "",
    ubicacion: x.ubicacionConfirmada || null,
    movimiento_activo: x.movimientoActivo ? { ...x.movimientoActivo, origen: x.ubicacionConfirmada || null } : null,
    comercial: COMERCIAL_API[x.situacionComercial] || x.situacionComercial || "Sin dato",
    preparacion: { central: true, estado: prep, lista_para_entrega: /lista para entrega/i.test(prep), techo: { configuracion: x.techo?.nomtte || "" } },
  };
}
async function paginas(ruta, params, items) {
  const todas = []; let total = 0; let resto = null;
  for (let offset = 0, n = 0; n < 40; n++, offset += 100) {
    const r = await pedir(`${ruta}${consulta({ ...params, limite: 100, offset })}`);
    const d = r.data;
    const lote = items(d) || [];
    todas.push(...lote);
    if (d && !Array.isArray(d)) { total = Number(d.total ?? todas.length); resto = d; }
    if (lote.length < 100 || (total && todas.length >= total)) break;
  }
  return { lista: todas, total: total || todas.length, resto };
}
export const inventarioApi = ({ codubi, codmod } = {}) => unaVez(`inventario:${codubi || ""}:${codmod || ""}`, () => leerInventario({ codubi, codmod }));
// Motor y chasis no vienen en el inventario de la API: se completan con la función SQL del PASO 5 (si está)
let sinSeries = false;
const leerSeries = () => (sinSeries ? Promise.resolve(null) : seriesUnidadesApi().catch((e) => { if (e?.detalle?.faltaSql) sinSeries = true; return null; }));
async function leerInventario({ codubi, codmod }) {
  const [inv, ubic, series] = await Promise.all([
    paginas("/api/inventario", { codubi, codmod }, (d) => d?.items),
    pedir("/api/ubicaciones").then((r) => r.data || []).catch(() => null),
    leerSeries(),
  ]);
  const porUnidad = new Map((Array.isArray(series) ? series : []).map((s) => [String(s.coduni), s]));
  const unidades = inv.lista.map((x) => { const s = porUnidad.get(String(x.coduni)); return unidadDesdeApi(s ? { ...x, nummotuni: x.nummotuni || s.nummotuni, chauni: x.chauni || s.chauni } : x); });
  const ubicaciones = ubic ? ubic.map((l) => ({ codubi: String(l.codubi), nomubi: l.nomubi, tipubi: l.tipubi, estubi: l.estubi !== false }))
    : [...new Map(unidades.filter((u) => u.ubicacion).map((u) => [u.ubicacion.codubi, { ...u.ubicacion, estubi: true }])).values()];
  return { unidades, ubicaciones, total: inv.total, resumen: inv.resto?.resumen || null };
}
// Ficha de una moto: se busca en el inventario central
export async function unidadCentralApi(coduni) {
  const { unidades } = await inventarioApi();
  const u = unidades.find((x) => String(x.coduni) === String(coduni));
  if (!u) throw new ApiError(404, "No encontramos esa moto en el inventario central.");
  return u;
}

// HU-003 · Movimientos de ubicación (diseño de Michelle): la salida deja la moto «En tránsito» desde su ubicación
// confirmada y la recepción la finaliza; recién ahí cambia la ubicación. El origen enviado es el que vio la persona:
// si otra sesión la movió antes, el servidor responde 409 y no se sobrescribe nada.
// Movimientos de todas las motos: si el servidor no publica GET /api/movimientos, se arman con lo que la API sí
// tiene: el inventario y el historial de cada moto (GET /api/unidades/:id/movimientos), de a seis a la vez.
let sinListaGeneral = false;
async function movimientosDesdeUnidades(soloActivos) {
  const { unidades } = await inventarioApi();
  const elegidas = soloActivos ? unidades.filter((u) => u.movimiento_activo) : unidades;
  const lista = [];
  for (let i = 0; i < elegidas.length; i += 6) {
    const lote = await Promise.all(elegidas.slice(i, i + 6).map((u) => movimientosUnidadApi(u.coduni)
      .then((d) => d.movimientos.map((m) => ({ ...m, coduni: String(u.coduni), unidad: { nommod: u.nommod, nummotuni: u.nummotuni, coluni: u.coluni } })))));
    lista.push(...lote.flat());
  }
  return lista.sort((a, b) => momentoMov(b.fechaSalida, b.horaSalida).localeCompare(momentoMov(a.fechaSalida, a.horaSalida)) || Number(b.codmub) - Number(a.codmub));
}
export async function historialMovimientosApi({ estado, limite = 50, offset = 0 } = {}) {
  if (!sinListaGeneral) {
    try { return (await pedir(`/api/movimientos${consulta({ estado, limite, offset })}`)).data; }
    catch (e) { if (!e?.detalle?.sinRuta) throw e; sinListaGeneral = true; }
  }
  const todos = await movimientosDesdeUnidades(estado === "En transito");
  const filtrados = estado ? todos.filter((m) => m.estado === estado) : todos;
  return { movimientos: filtrados.slice(offset, offset + limite), total: filtrados.length };
}
export const movimientosUnidadApi = (coduni) => pedir(`/api/unidades/${coduni}/movimientos`).then((r) => {
  const d = r.data || {};
  return { ...d, movimientos: (d.movimientos || []).filter(Boolean) };
});
export const iniciarMovimientoApi = (coduni, { codubiori, codubides, obsmub }) =>
  pedir(`/api/unidades/${coduni}/movimientos`, { metodo: "POST", cuerpo: { codubiori: String(codubiori), codubides: String(codubides), obsmub: obsmub || null } });
export const confirmarRecepcionApi = (coduni, codmub) => pedir(`/api/unidades/${coduni}/movimientos/${codmub}/recepcion`, { metodo: "PATCH" });
// Ubicación inicial de una moto identificada a mano: si la API no tiene la ruta, la registra la función SQL del PASO 5
export async function ubicacionInicialApi(coduni, cuerpo, clave) {
  try { return await pedir(`/api/unidades/${coduni}/ubicacion-inicial`, { metodo: "POST", cuerpo, headers: { "Idempotency-Key": clave } }); }
  catch (e) { if (!e?.detalle?.sinRuta) throw e; }
  const data = await ubicacionInicialSqlApi(coduni, cuerpo.codubi, cuerpo.observacion);
  return { message: "Ubicación inicial registrada", data };
}
// Fecha y hora de un movimiento tal como las registra el servidor («2026-10-21» y «10:45:12»)
export const momentoMov = (fecha, hora) => (fecha ? `${fecha}T${String(hora || "00:00:00").slice(0, 8)}` : "");

// HU-033 · Preparación
export const preparacionApi = (coduni) => pedir(`/api/unidades/${coduni}/preparacion`).then((r) => r.data);
export const actualizarPreparacionApi = (coduni, cuerpo, clave) => pedir(`/api/unidades/${coduni}/preparacion`, { metodo: "PUT", cuerpo, headers: { "Idempotency-Key": clave } });

// HU-023 · Compras pendientes
export const comprasPendientesApi = ({ situacion, origen, limite = 200, offset = 0 } = {}) => pedir(`/api/compras-pendientes${consulta({ situacion, origen, limite, offset })}`).then((r) => r.data);
export const pedidoCompraApi = (codcom, refcom) => pedir(`/api/compras/${codcom}/pedido`, { metodo: "PUT", cuerpo: { refcom } });

// ---------------------------------------------------------------------------------------------
// HU-015 · Leads (diseño de Michelle): lista paginada, responsables y asignación con el responsable esperado
// ---------------------------------------------------------------------------------------------
const nombreUsuario = (u) => [u?.nomusu, u?.apepatusu, u?.apematusu].filter(Boolean).join(" ");
export function leadDesdeApi(l = {}) {
  return {
    ...l, codlea: String(l.codlea),
    modelo: l.nommod ? { codmod: l.codmod, nommod: l.nommod } : null,
    sede: l.nomsed ? { codsed: l.codsed, nomsed: l.nomsed } : null,
    whatsapp: l.receptorWhatsapp ? { numcwa: l.receptorWhatsapp, nomcwa: "" } : null,
    responsable: l.responsable ? { codusu: String(l.responsable.codusu), nombre: nombreUsuario(l.responsable), rol: l.responsable.rol, activo: true } : null,
  };
}
export async function leadsCentralApi() {
  const { lista } = await paginas("/api/leads", {}, (d) => (Array.isArray(d) ? d : d?.items));
  return { leads: lista.map(leadDesdeApi) };
}
export const responsablesApi = () => pedir("/api/leads/responsables").then((r) => (r.data || []).map((u) => ({ codusu: String(u.codusu), nombre: nombreUsuario(u), rol: u.rol, activo: true })));
export const asignarLeadApi = (codlea, { codusuNuevo, codusuEsperado, motivo }) =>
  pedir(`/api/leads/${encodeURIComponent(codlea)}/responsable`, { metodo: "PATCH", cuerpo: { codusuNuevo: String(codusuNuevo), codusuEsperado: codusuEsperado == null ? null : String(codusuEsperado), motivo: motivo || "" } });

// HU-030 · Facturas recibidas por correo
export const documentosApi = ({ estado, limite = 50, offset = 0 } = {}) => pedir(`/api/documentos-compra${consulta({ estado, limite, offset })}`).then((r) => r.data);
export const documentoApi = (coddoc) => pedir(`/api/documentos-compra/${coddoc}`).then((r) => r.data);
export const reintentarDocumentoApi = (coddoc) => pedir(`/api/documentos-compra/${coddoc}/reintentar`, { metodo: "POST" });
export const resolverDocumentoApi = (coddoc, cuerpo) => pedir(`/api/documentos-compra/${coddoc}/resolver`, { metodo: "POST", cuerpo });
export const archivoDocumentoApi = (coddoc, tipo) => pedirBinario(`/api/documentos-compra/${coddoc}/archivo/${tipo}`);
export const equivalenciasApi = () => pedir("/api/equivalencias").then((r) => r.data);
export const guardarEquivalenciaApi = (cuerpo) => pedir("/api/equivalencias", { metodo: "PUT", cuerpo });
export const ajustesImportacionApi = () => pedir("/api/importaciones/ajustes").then((r) => r.data);
export const guardarAjustesImportacionApi = (cuerpo) => pedir("/api/importaciones/ajustes", { metodo: "PUT", cuerpo });
export const generarCredencialApi = () => pedir("/api/importaciones/credencial", { metodo: "POST" });
export const revocarCredencialApi = () => pedir("/api/importaciones/credencial", { metodo: "DELETE" });

// HU-036 · Imágenes de modelos (diseño de Michelle): el archivo se sube al bucket «modelos» de Supabase en
// <codmod>/<uuid>.<ext> y después se registra su dirección con las rutas de HU-012. Si el registro falla, se borra
// solo el archivo nuevo; la foto anterior nunca se toca. Si no hubo respuesta, se revisa antes de borrar.
const EXTENSION = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const rutaFotoNueva = (codmod, archivo) => `${codmod}/${nuevaClave()}.${EXTENSION[archivo.type] || "jpg"}`;

async function registrarConLimpieza(codmod, ruta, urlimo, registrar) {
  try { return await registrar(); }
  catch (e) {
    if (e.status === 0) {
      // Sin respuesta: puede que el registro sí se haya guardado. Se revisa antes de borrar el archivo.
      try {
        const r = await modelosAdminApi();
        const m = (r.data || []).find((x) => String(x.codmod) === String(codmod));
        if ((m?.imagenes || []).some((i) => i.urlimo === urlimo)) return { data: null, verificado: true };
      } catch { throw e; }
    }
    try { await borrarArchivoStorage(BUCKET_FOTOS, [ruta]); }
    catch { throw new ApiError(e.status ?? 500, `${mensajeError(e)} Además, el archivo subido quedó sin usar en el almacenamiento.`, { ...e.detalle, archivoSinUsar: ruta }); }
    throw e;
  }
}
export async function subirFotoModeloApi(codmod, archivo, ordimo) {
  const ruta = rutaFotoNueva(codmod, archivo);
  const urlimo = await subirArchivoStorage(BUCKET_FOTOS, ruta, archivo);
  return registrarConLimpieza(codmod, ruta, urlimo, () => pedir(`/api/modelos/${codmod}/imagenes`, { metodo: "POST", cuerpo: { urlimo, ordimo } }));
}
export async function reemplazarFotoModeloApi(codmod, codimo, archivo, ordimo) {
  const ruta = rutaFotoNueva(codmod, archivo);
  const urlimo = await subirArchivoStorage(BUCKET_FOTOS, ruta, archivo);
  return registrarConLimpieza(codmod, ruta, urlimo, () => pedir(`/api/modelos/${codmod}/imagenes/${codimo}`, { metodo: "PUT", cuerpo: { urlimo, ordimo } }));
}
export const enlazarFotoModeloApi = (codmod, urlimo, ordimo) => pedir(`/api/modelos/${codmod}/imagenes`, { metodo: "POST", cuerpo: { urlimo, ordimo } });
export const ordenFotoModeloApi = (codmod, codimo, urlimo, ordimo) => pedir(`/api/modelos/${codmod}/imagenes/${codimo}`, { metodo: "PUT", cuerpo: { urlimo, ordimo } });
export const estadoFotoModeloApi = (codmod, codimo, estimo) => pedir(`/api/modelos/${codmod}/imagenes/${codimo}/estado`, { metodo: "PATCH", cuerpo: { estimo } });

// Consulta que se actualiza sola: conserva los datos si falla la red y avisa que pueden estar desactualizados
// Con «clave», al volver a la pantalla se muestran al instante los últimos datos de esta sesión y se actualizan.
export function useConsultaCentral(cargar, deps = [], { intervalo = REFRESCO_MS, activo = true, clave = "" } = {}) {
  const [estado, setEstado] = useState(() => {
    const previo = clave && activo ? cacheConsultas.get(clave) : null;
    return { data: previo?.data ?? null, error: null, cargando: activo, actualizado: previo?.actualizado ?? null, fallo: null };
  });
  const vigente = useRef(0);
  const enVuelo = useRef(false);
  const fn = useRef(cargar);
  fn.current = cargar;
  const refrescar = useCallback(async (silencioso = false) => {
    if (!activo) return null;
    // Una actualización automática no se encima a otra que todavía no responde
    if (silencioso && enVuelo.current) return null;
    const n = ++vigente.current;
    enVuelo.current = true;
    if (!silencioso) setEstado((e) => ({ ...e, cargando: true }));
    try {
      const data = await fn.current();
      if (n !== vigente.current) return null;
      const actualizado = new Date().toISOString();
      if (clave) cacheConsultas.set(clave, { data, actualizado });
      setEstado({ data, error: null, cargando: false, actualizado, fallo: null });
      return data;
    } catch (error) {
      if (n !== vigente.current) return null;
      setEstado((e) => ({ ...e, cargando: false, error: e.data ? null : error, fallo: error }));
      return null;
    } finally {
      if (n === vigente.current) enVuelo.current = false;
    }
  }, [activo, clave, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { refrescar(Boolean(clave && cacheConsultas.has(clave))); }, [refrescar]); // eslint-disable-line react-hooks/exhaustive-deps
  useAutoRefresco(() => refrescar(true), intervalo, activo);
  // Sin conexión: se avisa enseguida, sin esperar al siguiente intento
  useEffect(() => {
    if (!activo) return undefined;
    const caida = () => setEstado((e) => ({ ...e, fallo: e.fallo || { status: 0, message: "Sin conexión a internet" } }));
    const vuelve = () => refrescar(true);
    window.addEventListener("offline", caida);
    window.addEventListener("online", vuelve);
    return () => { window.removeEventListener("offline", caida); window.removeEventListener("online", vuelve); };
  }, [activo, refrescar]);
  return { ...estado, refrescar };
}

// Descargar o abrir un archivo privado recibido como Blob
export function abrirBlob({ blob, nombre }, descargar = false) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.rel = "noopener";
  if (descargar) a.download = nombre || "archivo"; else a.target = "_blank";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
