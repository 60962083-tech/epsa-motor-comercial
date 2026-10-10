import { ErrorHttp } from './errores';
import type { ActualizarImagenModeloInput, CambiosModeloInput, CrearImagenModeloInput, CrearModeloInput, EstadoImagenModeloInput, EstadoModeloInput } from '../types/modelo.admin.types';
import type { EstadoModelo } from '../types/modelo.types';

const ESTADOS: readonly EstadoModelo[] = ['Borrador', 'Publicado', 'No publicado'];
const CAMPOS_CREAR = ['codtmo', 'nommod', 'marmod', 'desmod', 'carmod', 'premod', 'colores', 'estmod'];
const CAMPOS_EDITAR = ['codtmo', 'nommod', 'marmod', 'desmod', 'carmod', 'premod', 'colores'];
const MAX_BIGINT = 9223372036854775807n;
const MAX_PRECIO = 99999999.99;
const MAX_URL_IMAGEN = 2048;
const MAX_ORDEN_IMAGEN = 2147483647;

function objeto(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  return body as Record<string, unknown>;
}

function validarCampos(datos: Record<string, unknown>, permitidos: readonly string[]) {
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
}

function id(valor: unknown, campo: string): string {
  const texto = typeof valor === 'number' && Number.isSafeInteger(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !/^[1-9]\d*$/.test(texto) || BigInt(texto) > MAX_BIGINT)
    throw new ErrorHttp(400, `${campo} debe ser un identificador entero positivo válido`);
  return texto;
}

function texto(valor: unknown, campo: string, maximo?: number, colapsarEspacios = false): string {
  if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} es obligatorio y debe ser texto`);
  const limpio = colapsarEspacios ? valor.trim().replace(/\s+/g, ' ') : valor.trim();
  if (!limpio) throw new ErrorHttp(400, `${campo} es obligatorio`);
  if (maximo !== undefined && [...limpio].length > maximo)
    throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
  return limpio;
}

function precio(valor: unknown, campo = 'premod'): number | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > MAX_PRECIO ||
    Number(valor.toFixed(2)) !== valor)
    throw new ErrorHttp(400, `${campo} debe ser null o un número entre 0 y 99999999.99 con hasta dos decimales`);
  return valor;
}

function colores(valor: unknown): string[] {
  if (!Array.isArray(valor)) throw new ErrorHttp(400, 'colores debe ser un arreglo de nombres');
  const salida: string[] = [];
  const vistos = new Set<string>();
  for (const color of valor) {
    if (typeof color !== 'string') throw new ErrorHttp(400, 'Cada color debe ser texto');
    const normalizado = color.trim().replace(/\s+/g, ' ');
    if (!normalizado) throw new ErrorHttp(400, 'Los colores no pueden estar vacíos');
    if ([...normalizado].length > 50) throw new ErrorHttp(400, 'Cada color admite hasta 50 caracteres');
    const clave = normalizado.toLowerCase();
    if (!vistos.has(clave)) {
      vistos.add(clave);
      salida.push(normalizado);
    }
  }
  return salida;
}

function estado(valor: unknown): EstadoModelo {
  if (typeof valor !== 'string' || !ESTADOS.includes(valor as EstadoModelo))
    throw new ErrorHttp(400, 'estmod debe ser Borrador, Publicado o No publicado');
  return valor as EstadoModelo;
}

export function validarCrearModelo(body: unknown): CrearModeloInput {
  const datos = objeto(body);
  validarCampos(datos, CAMPOS_CREAR);
  return {
    codtmo: id(datos.codtmo, 'codtmo'),
    nommod: texto(datos.nommod, 'nommod', 100, true),
    marmod: datos.marmod === undefined ? 'Bajaj' : texto(datos.marmod, 'marmod', 100, true),
    desmod: texto(datos.desmod, 'desmod'),
    carmod: texto(datos.carmod, 'carmod'),
    premod: precio(datos.premod),
    colores: datos.colores === undefined ? [] : colores(datos.colores),
    estmod: datos.estmod === undefined ? 'Borrador' : estado(datos.estmod)
  };
}

export function validarCambiosModelo(body: unknown): CambiosModeloInput {
  const datos = objeto(body);
  validarCampos(datos, CAMPOS_EDITAR);
  if (Object.keys(datos).length === 0) throw new ErrorHttp(400, 'Debe indicar al menos un campo para actualizar');
  const cambios: CambiosModeloInput = {};
  if (Object.prototype.hasOwnProperty.call(datos, 'codtmo')) cambios.codtmo = id(datos.codtmo, 'codtmo');
  if (Object.prototype.hasOwnProperty.call(datos, 'nommod')) cambios.nommod = texto(datos.nommod, 'nommod', 100, true);
  if (Object.prototype.hasOwnProperty.call(datos, 'marmod')) cambios.marmod = texto(datos.marmod, 'marmod', 100, true);
  if (Object.prototype.hasOwnProperty.call(datos, 'desmod')) cambios.desmod = texto(datos.desmod, 'desmod');
  if (Object.prototype.hasOwnProperty.call(datos, 'carmod')) cambios.carmod = texto(datos.carmod, 'carmod');
  if (Object.prototype.hasOwnProperty.call(datos, 'premod')) cambios.premod = precio(datos.premod);
  if (Object.prototype.hasOwnProperty.call(datos, 'colores')) cambios.colores = colores(datos.colores);
  return cambios;
}

export function validarEstadoModelo(body: unknown): EstadoModeloInput {
  const datos = objeto(body);
  validarCampos(datos, ['estmod']);
  return { estmod: estado(datos.estmod) };
}

export function validarIdModeloAdmin(valor: unknown): string {
  if (typeof valor !== 'string') throw new ErrorHttp(400, 'Identificador de modelo inválido');
  return id(valor, 'codmod');
}

function validarIdImagen(valor: unknown): string {
  if (typeof valor !== 'string') throw new ErrorHttp(400, 'Identificador de imagen inválido');
  return id(valor, 'codimo');
}

function urlImagen(valor: unknown): string {
  const urlimo = texto(valor, 'urlimo', MAX_URL_IMAGEN);
  if (/[\s\u0000-\u001f\u007f]/u.test(urlimo)) throw new ErrorHttp(400, 'urlimo no es una ruta de imagen válida');

  if (urlimo.startsWith('/images/')) {
    const ruta = urlimo.slice('/images/'.length);
    let decodificada: string;
    try { decodificada = decodeURIComponent(ruta); }
    catch { throw new ErrorHttp(400, 'urlimo no es una ruta de imagen válida'); }
    if (!ruta || urlimo.includes('\\') || urlimo.includes('?') || urlimo.includes('#') ||
      /%(?:2e|2f|5c)/i.test(urlimo) || decodificada.split('/').some(segmento => !segmento || segmento === '.' || segmento === '..'))
      throw new ErrorHttp(400, 'urlimo no es una ruta de imagen válida');
    return urlimo;
  }

  if (urlimo.startsWith('https://')) {
    let parsed: URL;
    try { parsed = new URL(urlimo); }
    catch { throw new ErrorHttp(400, 'urlimo debe ser una ruta /images/ o una URL HTTPS válida'); }
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password)
      throw new ErrorHttp(400, 'urlimo debe ser una ruta /images/ o una URL HTTPS válida');
    return urlimo;
  }

  throw new ErrorHttp(400, 'urlimo debe ser una ruta /images/ o una URL HTTPS válida');
}

function ordenImagen(valor: unknown): number {
  if (typeof valor !== 'number' || !Number.isSafeInteger(valor) || valor < 1 || valor > MAX_ORDEN_IMAGEN)
    throw new ErrorHttp(400, 'ordimo debe ser un entero positivo válido');
  return valor;
}

function bodyImagen(body: unknown): Record<string, unknown> {
  const datos = objeto(body);
  validarCampos(datos, ['urlimo', 'ordimo']);
  return datos;
}

export function validarCrearImagenModelo(body: unknown): CrearImagenModeloInput {
  const datos = bodyImagen(body);
  return { urlimo: urlImagen(datos.urlimo), ordimo: ordenImagen(datos.ordimo) };
}

export function validarActualizarImagenModelo(body: unknown): ActualizarImagenModeloInput {
  return validarCrearImagenModelo(body);
}

export function validarEstadoImagenModelo(body: unknown): EstadoImagenModeloInput {
  const datos = objeto(body);
  validarCampos(datos, ['estimo']);
  if (typeof datos.estimo !== 'boolean') throw new ErrorHttp(400, 'estimo debe ser booleano');
  return { estimo: datos.estimo };
}

export function validarIdImagenModelo(valor: unknown): string {
  return validarIdImagen(valor);
}
