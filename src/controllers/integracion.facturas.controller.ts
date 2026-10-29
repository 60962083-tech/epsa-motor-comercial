import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { leerConfiguracionIntegracionFacturas } from '../config/integracion.facturas.js';
import { ErrorIntegracionHttp, marcarErrorRecepcion, procesarRecepcionFactura } from '../services/integracion.facturas.service.js';
import type { ArchivosRecibidos } from '../services/integracion.facturas.service.js';
import type { HeadersIntegracionFactura, ReservaRecepcionFactura } from '../types/integracion.facturas.types.js';

export const recibirFacturaIntegracion: RequestHandler = async (req, res) => {
  const requestId = randomUUID();
  const contexto = {
    dbIntegracion: res.locals.dbIntegracion,
    headersIntegracion: res.locals.headersIntegracion as HeadersIntegracionFactura | undefined,
    reservaIntegracion: res.locals.reservaIntegracion as ReservaRecepcionFactura | undefined
  };
  try {
    const headers = contexto.headersIntegracion;
    const reserva = contexto.reservaIntegracion;
    const db = contexto.dbIntegracion;
    if (!headers || !reserva || !db) throw new ErrorIntegracionHttp(503, 'INTEGRACION_NO_DISPONIBLE');
    const config = leerConfiguracionIntegracionFacturas();
    const resultado = await procesarRecepcionFactura(db, config.bucket, headers, reserva,
      req.files as ArchivosRecibidos, requestId);
    if (resultado.status === 202) res.setHeader('Retry-After', '2');
    if (resultado.status === 409) return void res.status(409).json({ ok: false, ...resultado.data });
    res.status(resultado.status).json({ ok: true, data: resultado.data });
  } catch (error) {
    const failure = error instanceof ErrorIntegracionHttp
      ? error : new ErrorIntegracionHttp(503, 'INTEGRACION_NO_DISPONIBLE');
    const leasePerdido = failure.status !== 202
      && await marcarErrorRecepcion(contexto, failure.codigo, failure.status) === 'LEASE_PERDIDO';
    if (failure.status === 202) res.setHeader('Retry-After', '2');
    res.status(leasePerdido ? 409 : failure.status)
      .json({ ok: false, code: leasePerdido ? 'LEASE_PERDIDO' : failure.codigo, requestId });
  }
};
