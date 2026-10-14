import { ErrorHttp } from './errores';
import type { CambiosCanalWhatsapp } from '../types/canal-whatsapp.types';

const CAMPOS = ['nomcwa', 'numcwa', 'enlcwa', 'estcwa'] as const;
const MAX_BIGINT = 9223372036854775807n;

function objeto(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  return body as Record<string, unknown>;
}

function texto(valor: unknown, campo: 'nomcwa' | 'enlcwa', maximo: number): string {
  if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} debe ser texto`);
  const limpio = valor.trim();
  if (!limpio) throw new ErrorHttp(400, `${campo} no puede estar vacío`);
  if ([...limpio].length > maximo) throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
  return limpio;
}

function numeroWhatsapp(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\+?[0-9\s().-]+$/.test(valor.trim()))
    throw new ErrorHttp(400, 'numcwa debe tener formato de número WhatsApp válido');
  const numero = valor.replace(/\D/g, '');
  if (!/^\d{7,15}$/.test(numero)) throw new ErrorHttp(400, 'numcwa debe tener entre 7 y 15 dígitos');
  return numero;
}

function enlaceWhatsapp(valor: unknown): string {
  const enlace = texto(valor, 'enlcwa', 2048);
  if (!enlace.startsWith('https://')) throw new ErrorHttp(400, 'enlcwa debe ser una URL HTTPS válida');
  let url: URL;
  try { url = new URL(enlace); }
  catch { throw new ErrorHttp(400, 'enlcwa debe ser una URL HTTPS válida'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || /\s/.test(enlace))
    throw new ErrorHttp(400, 'enlcwa debe ser una URL HTTPS válida');
  return enlace;
}

export function validarIdCanalWhatsapp(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || BigInt(valor) > MAX_BIGINT)
    throw new ErrorHttp(400, 'codcwa debe ser un identificador entero positivo válido');
  return valor;
}

export function validarCambiosCanalWhatsapp(body: unknown): CambiosCanalWhatsapp {
  const datos = objeto(body);
  const extra = Object.keys(datos).find(campo => !CAMPOS.includes(campo as typeof CAMPOS[number]));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
  if (Object.keys(datos).length === 0) throw new ErrorHttp(400, 'Debe indicar al menos un campo para actualizar');

  const cambios: CambiosCanalWhatsapp = {};
  if (Object.prototype.hasOwnProperty.call(datos, 'nomcwa')) cambios.nomcwa = texto(datos.nomcwa, 'nomcwa', 100);
  const enviaNumero = Object.prototype.hasOwnProperty.call(datos, 'numcwa');
  const enviaEnlace = Object.prototype.hasOwnProperty.call(datos, 'enlcwa');
  if (enviaNumero) cambios.numcwa = numeroWhatsapp(datos.numcwa);
  if (enviaEnlace) cambios.enlcwa = enlaceWhatsapp(datos.enlcwa);
  if (enviaNumero && !enviaEnlace) {
    cambios.enlcwa = `https://wa.me/${cambios.numcwa}`;
  } else if (enviaNumero && enviaEnlace) {
    const enlace = new URL(cambios.enlcwa!);
    if (enlace.hostname.toLowerCase() === 'wa.me') {
      const coincidencia = /^\/(\d+)\/?$/.exec(enlace.pathname);
      if (!coincidencia || coincidencia[1] !== cambios.numcwa)
        throw new ErrorHttp(400, 'enlcwa debe corresponder al número numcwa');
    }
  }
  if (Object.prototype.hasOwnProperty.call(datos, 'estcwa')) {
    if (typeof datos.estcwa !== 'boolean') throw new ErrorHttp(400, 'estcwa debe ser booleano');
    cambios.estcwa = datos.estcwa;
  }
  return cambios;
}
