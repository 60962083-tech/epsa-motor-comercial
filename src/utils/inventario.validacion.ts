import { ErrorHttp } from './errores';
import type { ConsultaInventarioInput } from '../types/inventario.types';

const PARAMETROS = ['codubi', 'codmod', 'estado', 'color', 'codtte', 'codepr', 'limite', 'offset'];
const MAX_BIGINT = 9223372036854775807n;

function valorTexto(query: Record<string, unknown>, campo: string): string | undefined {
  const valor = query[campo];
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} debe enviarse una sola vez como texto`);
  return valor;
}

function idOpcional(query: Record<string, unknown>, campo: string): string | null {
  const valor = valorTexto(query, campo);
  if (valor === undefined) return null;
  if (!/^[1-9]\d*$/.test(valor) || BigInt(valor) > MAX_BIGINT)
    throw new ErrorHttp(400, `${campo} debe ser un ID bigint positivo`);
  return valor;
}

function textoOpcional(query: Record<string, unknown>, campo: string, maximo: number): string | null {
  const valor = valorTexto(query, campo);
  if (valor === undefined) return null;
  const normalizado = valor.trim().replace(/\s+/g, ' ');
  if (!normalizado) throw new ErrorHttp(400, `${campo} no puede estar vacío`);
  if ([...normalizado].length > maximo) throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
  return normalizado;
}

function entero(query: Record<string, unknown>, campo: 'limite' | 'offset', defecto: number): number {
  const valor = valorTexto(query, campo);
  if (valor === undefined) return defecto;
  if (!/^(0|[1-9]\d*)$/.test(valor)) throw new ErrorHttp(400, `${campo} debe ser un entero no negativo`);
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) throw new ErrorHttp(400, `${campo} excede el rango permitido`);
  if (campo === 'limite' && (numero < 1 || numero > 100))
    throw new ErrorHttp(400, 'limite debe estar entre 1 y 100');
  if (campo === 'offset' && numero > 2147483647)
    throw new ErrorHttp(400, 'offset excede el rango permitido');
  return numero;
}

export function validarConsultaInventario(queryDesconocido: unknown): ConsultaInventarioInput {
  if (!queryDesconocido || typeof queryDesconocido !== 'object' || Array.isArray(queryDesconocido))
    throw new ErrorHttp(400, 'Filtros no válidos');
  const query = queryDesconocido as Record<string, unknown>;
  const extra = Object.keys(query).find(campo => !PARAMETROS.includes(campo));
  if (extra) throw new ErrorHttp(400, `Filtro no permitido: ${extra}`);

  return {
    p_codubi: idOpcional(query, 'codubi'),
    p_codmod: idOpcional(query, 'codmod'),
    p_estado: textoOpcional(query, 'estado', 50),
    p_color: textoOpcional(query, 'color', 50),
    p_codtte: idOpcional(query, 'codtte'),
    p_codepr: idOpcional(query, 'codepr'),
    p_limite: entero(query, 'limite', 50),
    p_offset: entero(query, 'offset', 0)
  };
}
