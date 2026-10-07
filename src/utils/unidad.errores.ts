import type { Response } from 'express';
import { ErrorHttp } from './errores';
import type { ConflictoIdentificacion, ErrorUnidadBD } from '../types/unidad.types';

function conflictoSeguro(details: string | undefined): ConflictoIdentificacion | undefined {
  try {
    const dato = JSON.parse(details ?? '') as ConflictoIdentificacion;
    const u = dato.unidad;
    if (!['nummotuni', 'chauni'].includes(dato.campo) || !u ||
        ![u.coduni, u.codcom, u.codmod, u.nummotuni, u.chauni, u.fecreguni].every(x => typeof x === 'string') ||
        !(u.coluni === null || typeof u.coluni === 'string')) return undefined;
    return { campo: dato.campo, unidad: {
      coduni: u.coduni, codcom: u.codcom, codmod: u.codmod,
      nummotuni: u.nummotuni, chauni: u.chauni, coluni: u.coluni, fecreguni: u.fecreguni
    } };
  } catch { return undefined; }
}

export function responderErrorUnidad(res: Response, error: unknown) {
  if (error instanceof ErrorHttp)
    return res.status(error.status).json({ ok: false, message: error.message });
  const bd = error as ErrorUnidadBD | null;
  const errores: Record<string, [number, string]> = {
    '42501': [403, 'Solo gerente y administradora pueden gestionar la identificación'],
    'PT400': [400, 'Revisa los datos de factura y de identificación'],
    'PT404': [404, 'La compra no existe'],
    'PT410': [409, 'Registra los metadatos de la factura recibida antes de identificar'],
    'PT411': [409, 'Modelo, color o cantidad no coinciden con la compra o factura; requiere revisión'],
    'PT412': [409, 'El lote supera la cantidad de motos pendiente de identificar'],
    'PT413': [409, 'La compra ya tiene otra factura registrada; requiere revisión'],
    'PT409': [409, 'Motor o chasis ya registrado; la ficha existente no fue modificada'],
    '23505': [409, 'Motor o chasis duplicado; consulta las unidades existentes'],
    '23514': [400, 'Los datos no cumplen las restricciones de identificación'],
    '23503': [400, 'La compra o el modelo relacionado no existe'],
    '40001': [409, 'La compra cambió durante la operación; consulta y vuelve a intentar'],
    '40P01': [409, 'Otra operación está modificando estas unidades; consulta y vuelve a intentar']
  };
  const [status, message] = errores[bd?.code ?? ''] ?? [500, 'Error interno al identificar unidades'];
  const conflicto = bd?.code === 'PT409' ? conflictoSeguro(bd.details) : undefined;
  return res.status(status).json({ ok: false, message, ...(conflicto ? { conflicto } : {}) });
}

