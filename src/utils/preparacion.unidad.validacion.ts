import { ErrorHttp } from './errores';
import { validarIdCompra } from './compra.validacion';
import type {
  ActualizarPreparacionUnidadInput,
  ActualizarPreparacionUnidadInputBase,
  ActualizarPreparacionUnidadRequest,
  EtapaPreparacion
} from '../types/preparacion.unidad.types';

const CAMPOS_PERMITIDOS = ['etapa', 'estado', 'version', 'observacion', 'fuente'] as const;
function validarClaveIdempotencia(valor: unknown): string {
  if (typeof valor !== 'string')
    throw new ErrorHttp(400, 'El header Idempotency-Key es obligatorio y debe ser una única cadena');
  const clave = valor.trim();
  if (!clave || clave.length > 128)
    throw new ErrorHttp(400, 'El header Idempotency-Key debe tener entre 1 y 128 caracteres');
  return clave;
}

export function validarActualizarPreparacionUnidad(
  coduni: unknown,
  body: unknown,
  claveIdempotencia: unknown
): ActualizarPreparacionUnidadInput {
  const p_coduni = validarIdCompra(coduni, 'coduni');
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');

  const datos = body as Record<string, unknown>;
  const campoExtra = Object.keys(datos).find(campo => !CAMPOS_PERMITIDOS.includes(campo as typeof CAMPOS_PERMITIDOS[number]));
  if (campoExtra) throw new ErrorHttp(400, `Campo no permitido: ${campoExtra}`);

  if (datos.etapa !== 'Armado' && datos.etapa !== 'Techo')
    throw new ErrorHttp(400, 'etapa debe ser Armado o Techo');
  const etapa: EtapaPreparacion = datos.etapa;

  if (typeof datos.version !== 'number' || !Number.isSafeInteger(datos.version) || datos.version < 1)
    throw new ErrorHttp(400, 'version debe ser un entero positivo');

  let observacion: string | null = null;
  if (datos.observacion !== undefined && datos.observacion !== null) {
    if (typeof datos.observacion !== 'string')
      throw new ErrorHttp(400, 'observacion debe ser texto o null');
    const normalizada = datos.observacion.trim();
    if ([...normalizada].length > 500)
      throw new ErrorHttp(400, 'observacion admite hasta 500 caracteres');
    observacion = normalizada || null;
  }

  const fuente = datos.fuente;
  if (fuente !== 'Interno' && fuente !== 'Aviso proveedor')
    throw new ErrorHttp(400, 'fuente debe ser Interno o Aviso proveedor');

  const common: ActualizarPreparacionUnidadInputBase = {
    p_coduni,
    p_version_esperada: datos.version,
    p_observacion: observacion,
    p_fuente: fuente,
    p_idempotencia: validarClaveIdempotencia(claveIdempotencia)
  };

  if (etapa === 'Armado') {
    if (datos.estado !== 'Pendiente' && datos.estado !== 'Terminado')
      throw new ErrorHttp(400, 'estado no es válido para la etapa Armado');
    return { ...common, p_etapa: 'Armado', p_estado: datos.estado };
  }

  if (datos.estado !== 'Pendiente' && datos.estado !== 'En proceso' && datos.estado !== 'Instalado')
    throw new ErrorHttp(400, 'estado no es válido para la etapa Techo');
  return { ...common, p_etapa: 'Techo', p_estado: datos.estado };
}

export function obtenerClaveIdempotencia(rawHeaders: readonly string[]): string {
  const valores: string[] = [];
  for (let indice = 0; indice < rawHeaders.length; indice += 2) {
    if (rawHeaders[indice]?.toLowerCase() === 'idempotency-key') {
      valores.push(rawHeaders[indice + 1] ?? '');
    }
  }
  if (valores.length !== 1)
    throw new ErrorHttp(400, 'El header Idempotency-Key es obligatorio y debe enviarse una sola vez');
  return validarClaveIdempotencia(valores[0]);
}

export function validarIdPreparacionUnidad(coduni: unknown): string {
  return validarIdCompra(coduni, 'coduni');
}

export type { ActualizarPreparacionUnidadRequest };
