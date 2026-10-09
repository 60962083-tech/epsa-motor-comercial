import { ErrorHttp } from './errores';
import { validarIdCompra } from './compra.validacion';
import type { ActualizarConfiguracionTechoInput } from '../types/techo.types';

function objeto(valor: unknown, permitidos: readonly string[]): Record<string, unknown> {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  const datos = valor as Record<string, unknown>;
  const extra = Object.keys(datos).find(campo => !permitidos.includes(campo));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
  return datos;
}

export function validarIdUnidad(valor: unknown): string {
  return validarIdCompra(valor, 'coduni');
}

export function validarActualizacionTecho(id: unknown, body: unknown): ActualizarConfiguracionTechoInput {
  const datos = objeto(body, ['codtte', 'codpro', 'detalle']);
  if (typeof datos.codtte !== 'string')
    throw new ErrorHttp(400, 'codtte es obligatorio y debe ser texto');

  const codtte = validarIdCompra(datos.codtte, 'codtte');
  let codpro: string | null = null;
  if (datos.codpro !== undefined && datos.codpro !== null) {
    if (typeof datos.codpro !== 'string') throw new ErrorHttp(400, 'codpro debe ser texto o null');
    codpro = validarIdCompra(datos.codpro, 'codpro');
  }

  let detalle: string | null = null;
  if (datos.detalle !== undefined && datos.detalle !== null) {
    if (typeof datos.detalle !== 'string') throw new ErrorHttp(400, 'detalle debe ser texto o null');
    const normalizado = datos.detalle.trim().replace(/\s+/g, ' ');
    if ([...normalizado].length > 250) throw new ErrorHttp(400, 'detalle admite hasta 250 caracteres');
    detalle = normalizado || null;
  }

  return {
    p_coduni: validarIdUnidad(id),
    p_codtte: codtte,
    p_codpro: codpro,
    p_detalle: detalle
  };
}
