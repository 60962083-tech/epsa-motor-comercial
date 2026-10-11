// Errores de la API
export class ApiError extends Error {
  constructor(status, message, detalle) {
    super(message);
    this.status = status;
    this.detalle = detalle || null;
  }
}

// Mensajes por código HTTP
const POR_ESTADO = {
  400: "Revisa los datos ingresados: hay un campo inválido.",
  401: "Tu sesión venció o no es válida. Inicia sesión nuevamente.",
  403: "No tienes permiso para realizar esta operación.",
  404: "No se encontró el registro solicitado.",
  409: "La operación entra en conflicto con datos existentes.",
  413: "La solicitud es demasiado grande.",
  500: "Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.",
  0: "No se pudo conectar con el servidor. Revisa tu conexión a internet.",
};

// Texto que se muestra al usuario
export function mensajeError(err) {
  if (!err) return "Ocurrió un error inesperado.";
  const base = err.message && err.status !== 0 ? err.message : POR_ESTADO[err.status];
  let msg = base || err.message || "Ocurrió un error inesperado.";
  const c = err.detalle?.conflicto;
  if (c?.unidad && typeof c.unidad === "object") msg += ` (${c.campo === "chauni" ? "chasis" : "motor"} ya usado en la ficha #${c.unidad.coduni} de la compra #${c.unidad.codcom})`;
  return msg;
}
