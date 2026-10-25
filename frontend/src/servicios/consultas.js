// HU-011 · Enviar una consulta desde la web
// Hoy se guarda en este navegador: interesado (lead), primer seguimiento y, si es cotización, solicitud en Ventas.
// Al conectar con la base: POST /api/consultas, público y sin sesión, con una función SECURITY DEFINER que
//   valida los datos, aplica el antispam (límite por IP, campo trampa y celular repetido en 24 horas),
//   asigna al vendedor activo con menos interesados abiertos y crea el primer seguimiento.
//   Columnas nuevas sugeridas en lead: mensaje, tipo de consulta, forma de pago, techo de interés,
//   y el consentimiento (acepta y fecha) de la Ley 29733.
import { hoyLocal, limpiarTexto } from "../lib/validar";
import { formatoSoles } from "../data/mockData";

export const VERSION_CONSENTIMIENTO = "2026-10";
export const TEXTO_CONSENTIMIENTO = "Acepto que EPSA Motor use mi nombre y celular solo para responder esta consulta y contactarme por teléfono o WhatsApp, según la Ley 29733 de Protección de Datos Personales.";
export const POLITICA_DATOS = [
  "Usamos tus datos solo para responder tu consulta y darte información de la moto que te interesa.",
  "No los vendemos ni los compartimos con otras empresas.",
  "Puedes pedir que los borremos o los corrijamos escribiendo a inversionesepsamotor@gmail.com.",
];
export const codigoConsulta = (id) => `W-${String(id).padStart(5, "0")}`;

// Antispam en el navegador (el servidor repetirá estas reglas)
const CLAVE_ENVIOS = "epsa-consultas-enviadas";
export const MAX_ENVIOS = 3;
const VENTANA_MS = 10 * 60000;
export const SEGUNDOS_MINIMOS = 3;
function envios() { try { return JSON.parse(localStorage.getItem(CLAVE_ENVIOS) || "[]").filter((t) => Date.now() - t < VENTANA_MS); } catch { return []; } }
export const limiteAlcanzado = () => envios().length >= MAX_ENVIOS;
export function anotarEnvio() { try { localStorage.setItem(CLAVE_ENVIOS, JSON.stringify([...envios(), Date.now()])); } catch {} }

const ABIERTO = (l) => !["Cerrado ganado", "Perdido"].includes(l.estado);
const siguiente = (lista) => lista.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

// Reparto: vendedor activo de la sede con menos interesados abiertos
export function asignarVendedor({ equipo = [], leads = [], config = {} }, sede) {
  if (config?.modoAusencia) return "Sin asignar";
  const cand = equipo.filter((p) => p.rol === "vendedor" && p.activo && !p.ausente && p.recibeLeads !== false);
  const lista = cand.filter((p) => p.sede === sede).length ? cand.filter((p) => p.sede === sede) : cand;
  if (!lista.length) return "Sin asignar";
  return lista.map((p) => ({ n: p.nombre, c: leads.filter((l) => l.responsable === p.nombre && ABIERTO(l)).length })).sort((a, b) => a.c - b.c)[0].n;
}

// Guardar la consulta (cotización o pregunta)
export function registrarConsultaWeb(app, d) {
  const { leads, ventas, agregar, actualizar } = app;
  const hoy = hoyLocal();
  const nombre = limpiarTexto(d.nombre);
  const mensaje = limpiarTexto(d.mensaje);
  const consentimiento = { acepta: true, fecha: new Date().toISOString(), version: VERSION_CONSENTIMIENTO };
  const esCotizacion = d.tipo === "cotizar";
  const modelo = d.modelo || null;
  const techoTxt = d.techo?.precio ? d.techo.nombre : "";
  const detalle = esCotizacion
    ? `${modelo.nombre}${d.color ? ` (${d.color})` : ""}${techoTxt ? ` · techo ${techoTxt}` : " · sin techo"} · ${d.pago} · total ${d.total ? formatoSoles(d.total) : "a consultar"}`
    : `Consulta${modelo ? ` sobre el ${modelo.nombre}` : ""}: ${mensaje}`;
  const solicitud = esCotizacion ? { cliente: nombre, celular: d.telefono, modelo: modelo.id, color: d.color, techo: techoTxt, techoPrecio: d.techo?.precio || 0, pago: d.pago, sede: d.sede, total: d.total || 0 } : null;

  const existente = leads.find((l) => l.telefono === d.telefono && ABIERTO(l));
  if (existente) {
    const otroNombre = nombre.toLowerCase() !== limpiarTexto(existente.contacto).toLowerCase() ? ` (esta vez como ${nombre})` : "";
    actualizar("leads", existente.id, { ...(modelo ? { modelo: modelo.id, color: d.color || existente.color } : {}), ultimaConsulta: hoy, mensaje: mensaje || existente.mensaje, consentimiento, nota: `${existente.nota ? `${existente.nota} · ` : ""}Volvió a escribir por la web el ${hoy}${otroNombre}: ${detalle}` }, `Cliente conocido volvió a escribir: ${existente.contacto}`);
    if (esCotizacion) {
      const pendiente = ventas.find((v) => v.leadId === existente.id && v.etapa === "Solicitud web");
      if (pendiente) actualizar("ventas", pendiente.id, { ...solicitud, fecha: hoy }, `Solicitud web actualizada: ${nombre} · ${modelo.nombre}`);
      else agregar("ventas", { id: siguiente(ventas), fecha: hoy, documento: "", etapa: "Solicitud web", vendedor: existente.responsable, adelanto: 0, unidad: null, canal: "Formulario web", origen: "Web de EPSA", leadId: existente.id, ...solicitud }, `Solicitud de compra web: ${nombre} · ${modelo.nombre}`);
    }
    if (existente.responsable && existente.responsable !== "Sin asignar") agregar("seguimientos", { leadId: existente.id, fecha: hoy, tipo: "Llamada", responsable: existente.responsable, hecho: false, detalle: `Volvió a escribir: ${detalle}` });
    return { codigo: existente.codigoWeb || codigoConsulta(existente.id), repetido: true, responsable: existente.responsable };
  }
  const id = siguiente(leads);
  const responsable = asignarVendedor(app, d.sede);
  const codigo = codigoConsulta(id);
  agregar("leads", {
    id, fecha: hoy, contacto: nombre, telefono: d.telefono, canal: "Formulario web", modelo: modelo?.id || "", color: d.color || "", sede: d.sede, responsable, estado: "Nuevo",
    tipoConsulta: esCotizacion ? "Cotización" : "Consulta", mensaje, consentimiento, codigoWeb: codigo,
    nota: esCotizacion ? `${techoTxt ? `Techo: ${techoTxt}` : "Sin techo"} · Pago: ${d.pago}${mensaje ? ` · ${mensaje}` : ""}` : mensaje,
  }, `Nueva ${esCotizacion ? "cotización" : "consulta"} desde la web: ${nombre}${modelo ? ` (${modelo.nombre})` : ""}`);
  if (responsable !== "Sin asignar") agregar("seguimientos", { leadId: id, fecha: hoy, tipo: "Llamada", responsable, hecho: false, detalle: `Primer contacto: ${esCotizacion ? `cotización web del ${detalle}` : detalle}` }, `Seguimiento automático para ${nombre}`);
  if (esCotizacion) agregar("ventas", { id: siguiente(ventas), fecha: hoy, documento: "", etapa: "Solicitud web", vendedor: responsable, adelanto: 0, unidad: null, canal: "Formulario web", origen: "Web de EPSA", leadId: id, ...solicitud }, `Solicitud de compra web: ${nombre} · ${modelo.nombre}`);
  return { codigo, repetido: false, responsable };
}
