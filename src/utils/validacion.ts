import { ErrorHttp } from './errores';
export function validarId(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || BigInt(valor) > 9223372036854775807n)
    throw new ErrorHttp(400, 'Código de ubicación no válido');
  return valor;
}

