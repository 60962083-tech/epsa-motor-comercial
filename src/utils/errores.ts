import { Response } from 'express';
export class ErrorHttp extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function responderError(res: Response, error: unknown) {
  if (error instanceof ErrorHttp) return res.status(error.status).json({ ok: false, message: error.message });
  const code = (error as { code?: string })?.code;
  const conocidos: Record<string, [number, string]> = {
    '23505': [409, 'Ya existe una ubicación con ese nombre normalizado'],
    '23514': [400, 'Los datos no cumplen las restricciones de la ubicación'],
    '42501': [403, 'No tienes permisos para realizar esta operación'],
    'PT409': [409, 'Resuelve las unidades asignadas o los traslados activos antes de desactivar la ubicación'],
    'PT422': [409, 'La ubicación está inactiva o no existe']
  };
  const [status, message] = conocidos[code ?? ''] ?? [500, 'Error interno al procesar la ubicación'];
  return res.status(status).json({ ok: false, message });
}

