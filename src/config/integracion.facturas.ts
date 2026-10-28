import type { CredencialesHmac, ConfiguracionIntegracionFacturas } from '../types/integracion.facturas.types.js';

export class ErrorConfiguracionIntegracion extends Error {
  constructor() {
    super('Integración técnica no configurada');
    this.name = 'ErrorConfiguracionIntegracion';
  }
}

function leerCredencial(prefix: 'CURRENT' | 'PREVIOUS'): CredencialesHmac | null {
  const keyId = process.env[`HU030_HMAC_${prefix}_KEY_ID`];
  const secret = process.env[`HU030_HMAC_${prefix}_SECRET`];
  if (!keyId && !secret) return null;
  if (!keyId || !secret || !/^[A-Za-z0-9._-]{1,64}$/.test(keyId)
    || Buffer.byteLength(secret, 'utf8') < 32 || /[\r\n\u0000-\u001f\u007f]/.test(secret)) {
    throw new ErrorConfiguracionIntegracion();
  }
  return { keyId, secret };
}

export function leerConfiguracionIntegracionFacturas(): ConfiguracionIntegracionFacturas {
  const actual = leerCredencial('CURRENT');
  const anterior = leerCredencial('PREVIOUS');
  if (!actual || (anterior && anterior.keyId === actual.keyId)) throw new ErrorConfiguracionIntegracion();
  const tolerancia = process.env.HU030_HMAC_TOLERANCIA_SEGUNDOS ?? '300';
  if (!/^[1-9]\d{0,2}$/.test(tolerancia) || Number(tolerancia) > 300) throw new ErrorConfiguracionIntegracion();
  const bucket = process.env.HU030_FACTURAS_BUCKET ?? 'facturas-compra';
  if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(bucket)) throw new ErrorConfiguracionIntegracion();
  return { actual, anterior, toleranciaSegundos: Number(tolerancia), bucket };
}
