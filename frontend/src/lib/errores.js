// Mensajes amigables por código HTTP (catálogo de errores del backend de Michelle).
export class ApiError extends Error {
  constructor(status, message, detalle) {
    super(message);
    this.status = status;
    this.detalle = detalle || null;
  }
}

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

// Errores de HU-002 (PT410…PT413 y PT409 con conflicto)
export function mensajeError(err) {
  if (!err) return "Ocurrió un error inesperado.";
  // Se muestra tal cual el mensaje del backend de Michelle; el genérico solo si no envió ninguno.
  const base = err.message && err.status !== 0 ? err.message : POR_ESTADO[err.status];
  let msg = base || err.message || "Ocurrió un error inesperado.";
  const c = err.detalle?.conflicto;
  if (c?.unidad && typeof c.unidad === "object") msg += ` (${c.campo === "chauni" ? "chasis" : "motor"} ya usado en la ficha #${c.unidad.coduni} de la compra #${c.unidad.codcom})`;
  return msg;
}
