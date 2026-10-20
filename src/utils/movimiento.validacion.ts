import { ErrorHttp } from './errores';
import type { IniciarMovimientoInput } from '../types/movimiento.types';

const MAX_BIGINT = 9223372036854775807n;

function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || BigInt(valor) > MAX_BIGINT)
    throw new ErrorHttp(400, `${campo} no es válido`);
  return valor;
}

export function validarIdUnidadMovimiento(valor: unknown): string {
  return validarId(valor, 'El código de unidad');
}

export function validarIdMovimiento(valor: unknown): string {
  return validarId(valor, 'El código de movimiento');
}

function objeto(valor: unknown): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  return valor as Record<string, unknown>;
}

export function validarInicioMovimiento(coduni: unknown, body: unknown): IniciarMovimientoInput {
  const datos = objeto(body);
  const permitidos = ['codubiori', 'codubides', 'obsmub'];
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);

  const p_codubiori = validarId(datos.codubiori, 'codubiori');
  const p_codubides = validarId(datos.codubides, 'codubides');
  if (p_codubiori === p_codubides)
    throw new ErrorHttp(400, 'El origen debe ser distinto del destino');

  if (datos.obsmub !== undefined && datos.obsmub !== null && typeof datos.obsmub !== 'string')
    throw new ErrorHttp(400, 'obsmub debe ser texto o null');

  const observacion = typeof datos.obsmub === 'string' ? datos.obsmub.trim() || null : null;
  return {
    p_coduni: validarIdUnidadMovimiento(coduni),
    p_codubiori,
    p_codubides,
    p_obsmub: observacion
  };
}

export function validarConsultaMovimientos(coduni: unknown): { p_coduni: string } {
  return { p_coduni: validarIdUnidadMovimiento(coduni) };
}

export function validarRecepcionMovimiento(coduni: unknown, codmub: unknown): {
  p_coduni: string;
  p_codmub: string;
} {
  return {
    p_coduni: validarIdUnidadMovimiento(coduni),
    p_codmub: validarIdMovimiento(codmub)
  };
}

export function validarCuerpoRecepcion(body: unknown): void {
  if (body === undefined || body === null) return;
  const datos = objeto(body);
  if (Object.keys(datos).length > 0)
    throw new ErrorHttp(400, 'La recepción no acepta campos enviados por el cliente');
}
