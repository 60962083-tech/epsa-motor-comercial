import { createHmac, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerConfiguracionIntegracionFacturas, ErrorConfiguracionIntegracion } from '../config/integracion.facturas.js';
import { crearClienteIntegracionSupabase } from '../config/supabase.js';
import type { HeadersIntegracionFactura, ReservaRecepcionFactura } from '../types/integracion.facturas.types.js';

export const RUTA_CANONICA_FACTURAS = '/api/integraciones/facturas';
export const PREFIJO_CANONICO_FACTURAS = 'EPSA-HU030-HMAC-V1';
export type FabricaClienteIntegracion = () => SupabaseClient;

export class ErrorHmacIntegracion extends Error {
  constructor(public readonly status: number, public readonly codigo: string) {
    super(codigo);
    this.name = 'ErrorHmacIntegracion';
  }
}

export function construirCanonicalFactura(input: Pick<HeadersIntegracionFactura,
  'keyId' | 'timestamp' | 'timestampTexto' | 'nonce' | 'gmailMessageId' | 'sha256Xml' | 'sha256Pdf'>): string {
  return [PREFIJO_CANONICO_FACTURAS, 'POST', RUTA_CANONICA_FACTURAS, input.keyId,
    input.timestampTexto, input.nonce, input.gmailMessageId, input.sha256Xml, input.sha256Pdf ?? '-'].join('\n');
}

function headerUnico(value: string | string[] | undefined): string {
  if (typeof value !== 'string' || value.length === 0) throw new ErrorHmacIntegracion(401, 'AUTENTICACION_INVALIDA');
  return value;
}

export function validarHeadersIntegracionFactura(
  headers: Record<string, string | string[] | undefined>,
  nowSeconds = Math.floor(Date.now() / 1000)
): HeadersIntegracionFactura {
  let config;
  try { config = leerConfiguracionIntegracionFacturas(); }
  catch (error) {
    if (error instanceof ErrorConfiguracionIntegracion) throw error;
    throw new ErrorConfiguracionIntegracion();
  }
  const keyId = headerUnico(headers['x-epsa-key-id']);
  const timestampTexto = headerUnico(headers['x-epsa-timestamp']);
  const nonce = headerUnico(headers['x-epsa-nonce']);
  const gmailMessageId = headerUnico(headers['x-epsa-message-id']);
  const sha256Xml = headerUnico(headers['x-epsa-xml-sha256']);
  const sha256PdfTexto = headerUnico(headers['x-epsa-pdf-sha256']);
  const firma = headerUnico(headers['x-epsa-signature']);

  if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId)) throw new ErrorHmacIntegracion(400, 'KEY_ID_INVALIDO');
  if (!/^(0|[1-9]\d{0,11})$/.test(timestampTexto)) throw new ErrorHmacIntegracion(401, 'TIMESTAMP_INVALIDO');
  const timestamp = Number(timestampTexto);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > config.toleranciaSegundos)
    throw new ErrorHmacIntegracion(401, 'TIMESTAMP_FUERA_DE_RANGO');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(nonce))
    throw new ErrorHmacIntegracion(400, 'NONCE_INVALIDO');
  if (!/^[\x21-\x7e]{1,250}$/.test(gmailMessageId)) throw new ErrorHmacIntegracion(400, 'MESSAGE_ID_INVALIDO');
  if (!/^[0-9a-f]{64}$/.test(sha256Xml)) throw new ErrorHmacIntegracion(400, 'HASH_XML_INVALIDO');
  const sha256Pdf = sha256PdfTexto === '-' ? null : sha256PdfTexto;
  if (sha256Pdf !== null && !/^[0-9a-f]{64}$/.test(sha256Pdf)) throw new ErrorHmacIntegracion(400, 'HASH_PDF_INVALIDO');
  if (!/^v1=[0-9a-f]{64}$/.test(firma)) throw new ErrorHmacIntegracion(401, 'FIRMA_INVALIDA');

  const credencial = [config.actual, config.anterior].find((candidate) => candidate?.keyId === keyId);
  if (!credencial) throw new ErrorHmacIntegracion(401, 'KEY_ID_INVALIDO');
  const entrada: HeadersIntegracionFactura = {
    keyId, timestamp, timestampTexto, nonce, gmailMessageId, sha256Xml, sha256Pdf
  };
  const esperado = createHmac('sha256', credencial.secret).update(construirCanonicalFactura(entrada), 'utf8').digest();
  const recibido = Buffer.from(firma.slice(3), 'hex');
  if (recibido.length !== esperado.length || !timingSafeEqual(esperado, recibido))
    throw new ErrorHmacIntegracion(401, 'FIRMA_INVALIDA');
  return entrada;
}

export function autenticarYReservarIntegracion(fabrica: FabricaClienteIntegracion = crearClienteIntegracionSupabase): RequestHandler {
  return async (req, res, next) => {
    try {
      const headers = validarHeadersIntegracionFactura(req.headers as Record<string, string | string[] | undefined>);
      const db = fabrica();
      const { data, error } = await db.rpc('hu030_integracion_reservar_tecnico', {
        p_key_id: headers.keyId, p_nonce: headers.nonce, p_timestamp: headers.timestamp,
        p_gmail_message_id: headers.gmailMessageId, p_sha256_xml: headers.sha256Xml,
        p_sha256_pdf: headers.sha256Pdf
      });
      if (error || !data || typeof data !== 'object') return void res.status(503).json({ ok: false, code: 'INTEGRACION_NO_DISPONIBLE' });
      const reserva = data as ReservaRecepcionFactura;
      if (reserva.resultado === 'NONCE_REPETIDO') return void res.status(409).json({ ok: false, code: 'NONCE_REPETIDO' });
      if (reserva.resultado === 'PDF_EVIDENCIA_CONFLICTO') return void res.status(409).json({ ok: false, code: 'PDF_EVIDENCIA_CONFLICTO' });
      if (!reserva.codrec) return void res.status(503).json({ ok: false, code: 'INTEGRACION_NO_DISPONIBLE' });
      res.locals.dbIntegracion = db;
      res.locals.headersIntegracion = headers;
      res.locals.reservaIntegracion = reserva;
      next();
    } catch (error) {
      if (error instanceof ErrorHmacIntegracion) return void res.status(error.status).json({ ok: false, code: error.codigo });
      if (error instanceof ErrorConfiguracionIntegracion) return void res.status(503).json({ ok: false, code: 'INTEGRACION_NO_CONFIGURADA' });
      res.status(503).json({ ok: false, code: 'INTEGRACION_NO_DISPONIBLE' });
    }
  };
}
