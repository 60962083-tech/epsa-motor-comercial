import { ErrorHttp } from './errores';
export const tiposUbicacion = ['Sede', 'Almacen', 'Proveedor'] as const;
export function validarId(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || BigInt(valor) > 9223372036854775807n)
    throw new ErrorHttp(400, 'Código de ubicación no válido');
  return valor;
}
export function validarUbicacion(body: unknown) {
  const datos = body as Record<string, unknown> | null;
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  if (typeof datos.nomubi !== 'string' || !datos.nomubi.trim()) throw new ErrorHttp(400, 'El nombre es obligatorio y debe ser texto');
  const nomubi = datos.nomubi.trim().replace(/\s+/g, ' ');
  if ([...nomubi].length > 120) throw new ErrorHttp(400, 'El nombre admite hasta 120 caracteres');
  if (!tiposUbicacion.includes(datos.tipubi as typeof tiposUbicacion[number]))
    throw new ErrorHttp(400, 'Tipo no válido: Sede, Almacen o Proveedor (fibrera)');
  if (datos.dirubi != null && typeof datos.dirubi !== 'string') throw new ErrorHttp(400, 'La dirección debe ser texto o null');
  const dirubi = (datos.dirubi as string | undefined | null)?.trim() || null;
  if (dirubi && [...dirubi].length > 250) throw new ErrorHttp(400, 'La dirección admite hasta 250 caracteres');
  return { nomubi, tipubi: datos.tipubi as string, dirubi };
}

