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
  409: "Otra persona cambió estos datos hace un momento. Revisa la información actual e inténtalo de nuevo.",
  413: "El archivo o los datos son demasiado grandes.",
  500: "No se pudo completar la operación. Inténtalo de nuevo en unos minutos.",
  502: "El sistema no responde en este momento. Inténtalo de nuevo en unos minutos.",
  503: "El sistema no responde en este momento. Inténtalo de nuevo en unos minutos.",
  0: "No hay conexión. Revisa tu internet e inténtalo de nuevo.",
};

// Texto que se muestra al usuario
export function mensajeError(err) {
  if (!err) return "Ocurrió un error inesperado.";
  // «Error» es el texto genérico cuando el servidor no explicó nada: se usa el mensaje por código
  const base = err.message && err.message !== "Error" && err.status !== 0 ? err.message : POR_ESTADO[err.status] || (err.status >= 500 ? POR_ESTADO[500] : "");
  let msg = base || err.message || "Ocurrió un error inesperado.";
  const c = err.detalle?.conflicto;
  if (c?.unidad && typeof c.unidad === "object") msg += ` (${c.campo === "chauni" ? "chasis" : "motor"} ya usado en la ficha #${c.unidad.coduni} de la compra #${c.unidad.codcom})`;
  return msg;
}
