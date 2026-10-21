import type { Response } from 'express';
import { ErrorHttp } from './errores';
import type { ErrorMovimientoBD } from '../types/movimiento.types';

export function responderErrorMovimiento(res: Response, error: unknown) {
  if (error instanceof ErrorHttp)
    return res.status(error.status).json({ ok: false, message: error.message });

  const errores: Record<string, [number, string]> = {
    '42501': [403, 'No tienes permisos para realizar esta operación de movimientos'],
    PT400: [400, 'Revisa los códigos de unidad, origen y destino'],
    PT404: [404, 'No se encontró la unidad, movimiento o ubicación indicada'],
    PT409: [409, 'La unidad cambió de ubicación; consulta su estado e inténtalo de nuevo'],
    PT422: [409, 'El origen o destino está inactivo'],
    PT423: [409, 'La unidad todavía no tiene una ubicación confirmada'],
    PT424: [409, 'La unidad ya tiene un movimiento activo'],
    PT425: [409, 'El movimiento ya no está en tránsito o la unidad cambió de estado'],
    '23505': [409, 'La unidad ya tiene un movimiento activo'],
    '23514': [400, 'El movimiento no cumple las restricciones de origen y destino'],
    '23503': [404, 'No se encontró la unidad, movimiento o ubicación indicada'],
    '40001': [409, 'La unidad cambió durante la operación; consulta y vuelve a intentar'],
    '40P01': [409, 'Otra operación está modificando esta unidad; consulta y vuelve a intentar']
  };
  const [status, message] = errores[(error as ErrorMovimientoBD | null)?.code ?? '']
    ?? [500, 'Error interno al procesar el movimiento'];
  return res.status(status).json({ ok: false, message });
}
