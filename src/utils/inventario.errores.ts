import type { Response } from 'express';
import { ErrorHttp } from './errores';
import type { ErrorInventarioBD } from '../types/inventario.types';

export function responderErrorInventario(res: Response, error: unknown) {
  if (error instanceof ErrorHttp)
    return res.status(error.status).json({ ok: false, message: error.message });

  const codigo = (error as ErrorInventarioBD | null)?.code;
  if (codigo === 'PT400') return res.status(400).json({ ok: false, message: 'Los filtros o la paginación no son válidos' });
  if (codigo === '42501') return res.status(403).json({ ok: false, message: 'No tienes permisos para consultar el inventario' });
  return res.status(500).json({ ok: false, message: 'Error interno al consultar el inventario' });
}
