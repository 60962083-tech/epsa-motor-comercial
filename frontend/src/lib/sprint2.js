// Sprint 2 · Estado de conexión de cada historia con la base de datos
// Con la API configurada (MODO_REAL), las historias del Sprint 2 leen y guardan en la base central.
// Sin API, el panel funciona como vista previa y guarda en este navegador.
import { MODO_REAL } from "./config";

// HU-005 y HU-011 ya no son del Sprint 2 (HU-011 pasa al Sprint 3): siguen solo en la vista previa.
export const CONECTADO = {
  "HU-001": MODO_REAL, // Consultar disponibilidad compartida
  "HU-003": MODO_REAL, // Registrar movimientos de ubicación
  "HU-005": false, // Separar una moto con adelanto confirmado (fuera del Sprint 2)
  "HU-011": false, // Enviar una consulta desde la web (Sprint 3)
  "HU-015": MODO_REAL, // Asignar o transferir un interesado
  "HU-023": MODO_REAL, // Consultar compras pendientes de identificación o recepción
  "HU-030": MODO_REAL, // Registrar compras y unidades desde facturas recibidas por correo
  "HU-033": MODO_REAL, // Actualizar la preparación de una unidad
  "HU-036": MODO_REAL, // Gestionar imágenes de modelos mediante API y almacenamiento central
  "EMT-97": MODO_REAL, // Mejora técnica de HU-026: contacto en ubicaciones de trabajo
};

export const NOMBRE_HU = {
  "HU-001": "Consultar disponibilidad compartida",
  "HU-003": "Registrar movimientos de ubicación",
  "HU-005": "Separar una moto con adelanto confirmado",
  "HU-011": "Enviar una consulta desde la web",
  "HU-015": "Asignar o transferir un interesado",
  "HU-023": "Consultar compras pendientes de identificación o recepción",
  "HU-030": "Registrar automáticamente compras y unidades desde facturas recibidas por correo",
  "HU-033": "Actualizar la preparación de una unidad",
  "HU-036": "Gestionar imágenes de modelos mediante API y almacenamiento central",
  "EMT-97": "Registrar contacto en ubicaciones de trabajo (mejora técnica de HU-026)",
};

export const siguienteId = (lista = []) => lista.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

// Nombre visible del cliente (persona o empresa)
export function nombreCliente(c) {
  if (!c) return "Cliente";
  if (c.tipoDoc === "RUC") return c.razonSocial || "Empresa";
  return [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(" ") || "Cliente";
}
