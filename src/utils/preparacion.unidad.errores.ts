import type { Response } from 'express';
import { ErrorHttp } from './errores';
import type { ErrorPreparacionBD } from '../types/preparacion.unidad.types';

export function responderErrorPreparacionUnidad(res: Response, error: unknown) {
  if (error instanceof ErrorHttp)
    return res.status(error.status).json({ ok: false, message: error.message });

  const errores: Record<string, [number, string]> = {
    '42501': [403, 'No tienes permisos para consultar o actualizar la preparación'],
    PT400: [400, 'Los datos enviados para la preparación no son válidos'],
    '22023': [400, 'Los datos enviados para la preparación no son válidos'],
    PT404: [404, 'La unidad no existe'],
    PT409: [409, 'La preparación cambió o existe un conflicto de actualización'],
  };
  const [status, message] = errores[(error as ErrorPreparacionBD | null)?.code ?? '']
    ?? [500, 'Error interno al procesar la preparación de la unidad'];
  return res.status(status).json({ ok: false, message });
}
