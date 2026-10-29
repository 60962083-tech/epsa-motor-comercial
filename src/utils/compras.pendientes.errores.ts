import type { Response } from 'express';
import { ErrorHttp } from './errores';

export function responderErrorComprasPendientes(res: Response, error: unknown) {
  if (error instanceof ErrorHttp)
    return res.status(error.status).json({ ok: false, message: error.message });

  const codigo = (error as { code?: string } | null)?.code;
  if (codigo === '42501')
    return res.status(403).json({ ok: false, message: 'No tienes permisos para consultar las compras pendientes' });
  if (codigo === '22023' || codigo === 'PT400')
    return res.status(400).json({ ok: false, message: 'Los parámetros de consulta no son válidos' });
  return res.status(500).json({ ok: false, message: 'Error interno al consultar las compras pendientes' });
}
