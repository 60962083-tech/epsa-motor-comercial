// HU-033 · Actualizar la preparación de una unidad
// Pasos: Sin preparar → Pendiente de techo → En preparación → Lista para entrega.
// Al quedar lista, la moto pasa sola a «Disponible». Hoy guarda en este navegador.
// Al conectar con la base: GET /api/preparacion/estados (tabla estadopreparacion),
//   PUT /api/unidades/:id/preparacion { codepr, observacion } y GET /api/unidades/:id/preparacion (historialpreparacion).
import { useCallback, useMemo } from "react";
import { useApp } from "../store/appStore.jsx";
import { useAuth } from "../context/AuthContext";
import { ESTADOS_PREPARACION } from "../data/mockData";
import { hoyLocal, limpiarTexto } from "../lib/validar";
import { siguienteId } from "../lib/sprint2";
import { useMovimientos } from "./movimientos";

export const PASOS = ESTADOS_PREPARACION;
export const numeroPaso = (p) => PASOS.indexOf(p) + 1;
// «Lona» → «techo de lona»; «Techo de fibra deportiva» → «techo de fibra deportiva»
export const nombreTecho = (t) => (/^techo/i.test(t || "") ? String(t).toLowerCase() : `techo de ${String(t || "").toLowerCase()}`);
const ahoraISO = () => new Date().toISOString();

export function usePreparacion() {
  const { historialPreparacion = [], ubicaciones = [], separaciones = [], agregar, actualizar } = useApp();
  const { user } = useAuth();
  const { transitoDe } = useMovimientos();

  const historialDe = useCallback((id) => historialPreparacion.filter((h) => h.unidad === id).sort((a, b) => a.fecha.localeCompare(b.fecha)), [historialPreparacion]);
  const ultimo = useMemo(() => {
    const m = {};
    for (const h of historialPreparacion) if (!m[h.unidad] || h.fecha > m[h.unidad].fecha) m[h.unidad] = h;
    return m;
  }, [historialPreparacion]);
  // Desde cuándo está en su paso actual
  const desdeCuando = useCallback((u) => (ultimo[u.id]?.paso === u.preparacion ? ultimo[u.id].fecha : ""), [ultimo]);
  const tipoDe = (nombre) => ubicaciones.find((a) => a.nombre === nombre)?.tipo || "";
  const llevaTecho = (u) => Boolean(u.techo && u.techo !== "Sin techo");

  // Por qué no se puede pasar a ese paso (texto vacío = sí se puede)
  function bloqueo(u, destino) {
    const actual = PASOS.indexOf(u.preparacion);
    const nuevo = PASOS.indexOf(destino);
    if (nuevo < 0) return "Ese paso no existe.";
    if (u.disponibilidad === "Vendida") return "Esta moto ya se vendió.";
    if (!u.ubicacion) return "Aún no llega a una sede. Registra primero su recepción en Movimientos.";
    if (destino === u.preparacion) return "Ya está en ese paso.";
    const t = transitoDe(u.id);
    if (t) return `Está en camino a ${t.destino}. Confirma su llegada primero.`;
    if (nuevo < actual && u.disponibilidad === "Separada") return "Está separada para un cliente: no se puede retroceder su preparación.";
    if (destino === "Pendiente de techo" && !llevaTecho(u)) return "Esta moto no lleva techo. Configúralo en su ficha o pásala a «En preparación».";
    if (nuevo > PASOS.indexOf("Pendiente de techo") && u.estadoTecho === "Pendiente de instalación") return `El ${nombreTecho(u.techo)} aún no está instalado. Confirma la instalación en su ficha.`;
    if (destino === "Lista para entrega" && tipoDe(u.ubicacion) === "Proveedor de techo") return `Está en ${u.ubicacion} (proveedor de techo). Trasládala a una sede primero.`;
    return "";
  }
  // Siguiente paso sugerido (salta «Pendiente de techo» si no lleva techo)
  function siguiente(u) {
    const i = PASOS.indexOf(u.preparacion);
    let n = PASOS[i + 1];
    if (n === "Pendiente de techo" && (!llevaTecho(u) || u.estadoTecho === "Instalado")) n = PASOS[i + 2];
    return n || "";
  }
  const retrocede = (u, destino) => PASOS.indexOf(destino) < PASOS.indexOf(u.preparacion);
  function validarCambio(u, destino, obs) {
    const b = bloqueo(u, destino);
    if (b) return { general: b };
    const t = limpiarTexto(obs);
    if (retrocede(u, destino) && t.length < 5) return { obs: "Al volver a un paso anterior, escribe el motivo (mínimo 5 caracteres)." };
    if (t.length > 300) return { obs: "Máximo 300 caracteres." };
    return {};
  }

  // Registrar el paso (forzar = cambio automático por techo, sin validar)
  function cambiarPaso(u, destino, obs = "", { forzar = false } = {}) {
    if (!forzar && bloqueo(u, destino)) return "";
    const t = limpiarTexto(obs);
    const libera = destino === "Lista para entrega" && u.disponibilidad === "No disponible";
    const retira = u.preparacion === "Lista para entrega" && destino !== "Lista para entrega" && u.disponibilidad === "Disponible";
    agregar("historialPreparacion", { id: siguienteId(historialPreparacion), unidad: u.id, paso: destino, anterior: u.preparacion || "", fecha: ahoraISO(), usuario: user.nombre, obs: t });
    actualizar("unidades", u.id, (x) => ({
      preparacion: destino,
      ...(libera ? { disponibilidad: "Disponible" } : {}),
      ...(retira ? { disponibilidad: "No disponible" } : {}),
      historial: [...(x.historial || []), { fecha: hoyLocal(), detalle: `Preparación: ${destino}${t ? ` (${t})` : ""}${libera ? ". Queda disponible para la venta" : ""}${retira ? ". Sale de la venta" : ""} · ${user.nombre}` }],
    }), `${u.id}: preparación ${destino}`);
    if (libera) return `${u.id} está lista y ya aparece en Disponibilidad.`;
    if (retira) return `${u.id} volvió a «${destino}» y salió de la venta.`;
    return `${u.id} pasó a «${destino}».`;
  }

  // Liberar para la venta una moto lista que salió de la venta (por ejemplo, volvió del proveedor de techo)
  function bloqueoLiberar(u) {
    if (u.disponibilidad !== "No disponible") return "Ya está a la venta o reservada.";
    if (!u.ubicacion) return "Aún no llega a una sede: registra su recepción.";
    const t = transitoDe(u.id);
    if (t) return `Está en camino a ${t.destino}. Confirma su llegada primero.`;
    if (tipoDe(u.ubicacion) === "Proveedor de techo") return `Está en ${u.ubicacion} (proveedor de techo). Trasládala a una sede primero.`;
    if (u.estadoTecho === "Pendiente de instalación") return `El ${nombreTecho(u.techo)} aún no está instalado.`;
    if (u.preparacion !== "Lista para entrega") return `Está en «${u.preparacion}». Completa su preparación: al quedar lista pasa sola a disponible.`;
    return "";
  }
  function liberar(u) {
    actualizar("unidades", u.id, (x) => ({ disponibilidad: "Disponible", historial: [...(x.historial || []), { fecha: hoyLocal(), detalle: `Liberada para la venta · ${user.nombre}` }] }), `${u.id} liberada para la venta`);
    return `${u.id} ya está disponible para la venta.`;
  }

  // Motos con separación activa (no se retroceden)
  const separadaPara = (id) => separaciones.find((s) => s.unidad === id && s.estado === "Activa");

  return { PASOS, historialDe, desdeCuando, bloqueo, siguiente, retrocede, validarCambio, cambiarPaso, separadaPara, llevaTecho, bloqueoLiberar, liberar };
}
