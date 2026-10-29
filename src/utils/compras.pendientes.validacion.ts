import { ErrorHttp } from './errores';
import type { ConsultaComprasPendientesInput, OrigenCompraPendiente } from '../types/compras.pendientes.types';

const PARAMETROS = ['origen', 'limite', 'offset'];

function textoUnico(query: Record<string, unknown>, campo: string): string | undefined {
  const valor = query[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} debe enviarse una sola vez como texto`);
  return valor;
}

function entero(query: Record<string, unknown>, campo: 'limite' | 'offset', defecto: number): number {
  const valor = textoUnico(query, campo);
  if (valor === undefined) return defecto;
  if (!/^(0|[1-9]\d*)$/.test(valor)) throw new ErrorHttp(400, `${campo} debe ser un entero no negativo`);
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) throw new ErrorHttp(400, `${campo} excede el rango permitido`);
  if (campo === 'limite' && (numero < 1 || numero > 200))
    throw new ErrorHttp(400, 'limite debe estar entre 1 y 200');
  if (campo === 'offset' && numero > 2147483647)
    throw new ErrorHttp(400, 'offset excede el rango permitido');
  return numero;
}

export function validarConsultaComprasPendientes(queryDesconocido: unknown): ConsultaComprasPendientesInput {
  if (!queryDesconocido || typeof queryDesconocido !== 'object' || Array.isArray(queryDesconocido))
    throw new ErrorHttp(400, 'Parámetros de consulta no válidos');
  const query = queryDesconocido as Record<string, unknown>;
  const extra = Object.keys(query).find(campo => !PARAMETROS.includes(campo));
  if (extra) throw new ErrorHttp(400, `Parámetro no permitido: ${extra}`);

  const origen = textoUnico(query, 'origen');
  const origenesPermitidos: readonly string[] = ['Automatico', 'Automático', 'Manual', 'No determinado'];
  if (origen !== undefined && !origenesPermitidos.includes(origen))
    throw new ErrorHttp(400, 'origen no es válido');
  const origenCanonico: OrigenCompraPendiente | null = origen === 'Automático'
    ? 'Automatico'
    : (origen as OrigenCompraPendiente | undefined) ?? null;

  return {
    p_origen: origenCanonico,
    p_limite: entero(query, 'limite', 200),
    p_offset: entero(query, 'offset', 0)
  };
}
