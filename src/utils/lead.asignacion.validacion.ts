import { ErrorHttp } from './errores';
import type { AsignarResponsableLeadInput, PaginacionLeads } from '../types/lead.asignacion.types';

const BIGINT_MAXIMO = 9223372036854775807n;

function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor))
    throw new ErrorHttp(400, `${campo} debe ser un identificador bigint positivo`);
  if (BigInt(valor) > BIGINT_MAXIMO)
    throw new ErrorHttp(400, `${campo} excede el máximo permitido`);
  return valor;
}

export function validarPaginacionLeads(query: unknown): PaginacionLeads {
  if (!query || typeof query !== 'object' || Array.isArray(query))
    throw new ErrorHttp(400, 'Parámetros de consulta inválidos');
  const datos = query as Record<string, unknown>;
  const extra = Object.keys(datos).find(campo => !['limite', 'offset'].includes(campo));
  if (extra) throw new ErrorHttp(400, `Parámetro no permitido: ${extra}`);

  function entero(campo: 'limite' | 'offset', defecto: number): number {
    const valor = datos[campo];
    if (valor === undefined) return defecto;
    if (typeof valor !== 'string' || !/^(0|[1-9]\d*)$/.test(valor))
      throw new ErrorHttp(400, `${campo} debe ser un entero no negativo`);
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero)) throw new ErrorHttp(400, `${campo} está fuera de rango`);
    return numero;
  }

  const limite = entero('limite', 50);
  const offset = entero('offset', 0);
  if (limite < 1 || limite > 100) throw new ErrorHttp(400, 'limite debe estar entre 1 y 100');
  if (offset > 2147483647) throw new ErrorHttp(400, 'offset está fuera de rango');
  return { p_limite: limite, p_offset: offset };
}

export function validarAsignacionLead(id: unknown, body: unknown): AsignarResponsableLeadInput {
  const p_codlea = validarId(id, 'codlea');
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  const datos = body as Record<string, unknown>;
  const permitidos = ['codusuNuevo', 'codusuEsperado', 'motivo'];
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
  if (!Object.prototype.hasOwnProperty.call(datos, 'codusuEsperado'))
    throw new ErrorHttp(400, 'codusuEsperado es obligatorio; usa null para la asignación inicial');

  const p_codusunuevo = validarId(datos.codusuNuevo, 'codusuNuevo');
  const p_codusuesperado = datos.codusuEsperado === null
    ? null
    : validarId(datos.codusuEsperado, 'codusuEsperado');
  let p_motivo: string | null = null;
  if (datos.motivo !== undefined && datos.motivo !== null) {
    if (typeof datos.motivo !== 'string') throw new ErrorHttp(400, 'motivo debe ser texto o null');
    p_motivo = datos.motivo.trim() || null;
    if (p_motivo && [...p_motivo].length > 250)
      throw new ErrorHttp(400, 'motivo admite hasta 250 caracteres');
  }
  if (p_codusuesperado !== null && p_codusuesperado !== p_codusunuevo && p_motivo === null)
    throw new ErrorHttp(400, 'motivo es obligatorio para transferir un lead');

  return { p_codlea, p_codusunuevo, p_codusuesperado, p_motivo };
}
