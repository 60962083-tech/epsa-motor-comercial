import { ErrorHttp } from './errores';
import { TIPOS_UBICACION } from '../types/ubicacion.types';
import type { DatosEscrituraUbicacion, TipoUbicacion } from '../types/ubicacion.types';

const CAMPOS = ['nomubi', 'tipubi', 'dirubi', 'telsed', 'horsed'] as const;

function objeto(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    throw new ErrorHttp(400, 'El cuerpo debe ser un objeto JSON');
  return body as Record<string, unknown>;
}

function validarCampos(datos: Record<string, unknown>) {
  const extra = Object.keys(datos).find(campo => !CAMPOS.includes(campo as typeof CAMPOS[number]));
  if (extra) throw new ErrorHttp(400, `Campo no permitido: ${extra}`);
}

function textoOpcional(datos: Record<string, unknown>, campo: 'dirubi' | 'telsed' | 'horsed', maximo: number): string | null | undefined {
  if (!Object.prototype.hasOwnProperty.call(datos, campo)) return undefined;
  const valor = datos[campo];
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new ErrorHttp(400, `${campo} debe ser texto o null`);
  const limpio = valor.trim();
  if ([...limpio].length > maximo) throw new ErrorHttp(400, `${campo} admite hasta ${maximo} caracteres`);
  return limpio || null;
}

export function validarUbicacion(body: unknown): DatosEscrituraUbicacion {
  const datos = objeto(body);
  validarCampos(datos);
  if (typeof datos.nomubi !== 'string' || !datos.nomubi.trim())
    throw new ErrorHttp(400, 'El nombre es obligatorio y debe ser texto');
  const nomubi = datos.nomubi.trim().replace(/\s+/g, ' ');
  if ([...nomubi].length > 120) throw new ErrorHttp(400, 'El nombre admite hasta 120 caracteres');
  if (!TIPOS_UBICACION.includes(datos.tipubi as TipoUbicacion))
    throw new ErrorHttp(400, 'Tipo no válido: Sede, Almacen o Proveedor');

  const dirubi = textoOpcional(datos, 'dirubi', 250) ?? null;
  const telsed = textoOpcional(datos, 'telsed', 20);
  const horsed = textoOpcional(datos, 'horsed', 150);
  if (datos.tipubi !== 'Sede' && (Object.prototype.hasOwnProperty.call(datos, 'telsed') || Object.prototype.hasOwnProperty.call(datos, 'horsed')))
    throw new ErrorHttp(400, 'telsed y horsed solo se aceptan cuando tipubi es Sede');

  return {
    nomubi,
    tipubi: datos.tipubi as TipoUbicacion,
    dirubi,
    ...(Object.prototype.hasOwnProperty.call(datos, 'telsed') ? { telsed: telsed ?? null } : {}),
    ...(Object.prototype.hasOwnProperty.call(datos, 'horsed') ? { horsed: horsed ?? null } : {})
  };
}
