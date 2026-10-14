import type { SupabaseClient } from '@supabase/supabase-js';
import type { DatosEscrituraUbicacion, Ubicacion } from '../types/ubicacion.types';
import { ErrorHttp } from '../utils/errores';

export async function listarUbicaciones(db: SupabaseClient, activo?: boolean): Promise<Ubicacion[]> {
  const { data, error } = await db.rpc('hu026_listar_ubicaciones', { p_activo: activo ?? null });
  if (error) throw error;
  return (data ?? []) as Ubicacion[];
}

export async function crearUbicacion(db: SupabaseClient, datos: DatosEscrituraUbicacion): Promise<Ubicacion> {
  const { data, error } = await db.rpc('hu026_crear_ubicacion', {
    p_nomubi: datos.nomubi,
    p_tipubi: datos.tipubi,
    p_dirubi: datos.dirubi,
    p_telsed: datos.telsed ?? null,
    p_horsed: datos.horsed ?? null
  });
  if (error) throw error;
  return data as Ubicacion;
}

export async function actualizarUbicacion(db: SupabaseClient, id: string, datos: DatosEscrituraUbicacion): Promise<Ubicacion> {
  const { data, error } = await db.rpc('hu026_actualizar_ubicacion', {
    p_codubi: id,
    p_nomubi: datos.nomubi,
    p_tipubi: datos.tipubi,
    p_dirubi: datos.dirubi,
    p_telsed: datos.telsed ?? null,
    p_horsed: datos.horsed ?? null,
    p_actualizar_telsed: Object.prototype.hasOwnProperty.call(datos, 'telsed'),
    p_actualizar_horsed: Object.prototype.hasOwnProperty.call(datos, 'horsed')
  });
  if (error) throw error;
  return data as Ubicacion;
}

export async function cambiarEstadoUbicacion(db: SupabaseClient, id: string, estubi: boolean): Promise<Ubicacion> {
  const { data, error } = await db.rpc('hu026_cambiar_estado_ubicacion', { p_codubi: id, p_estubi: estubi });
  if (error) throw error;
  if (!data) throw new ErrorHttp(404, 'La ubicación no existe');
  return data as Ubicacion;
}
