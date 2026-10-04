import { SupabaseClient } from '@supabase/supabase-js';
import { ErrorHttp } from '../utils/errores';
type Datos = { nomubi: string; tipubi: string; dirubi: string | null };
export async function listarUbicaciones(db: SupabaseClient, activo?: boolean) {
  let consulta = db.from('ubicacion').select('*').order('nomubi', { ascending: true });
  if (activo !== undefined) consulta = consulta.eq('estubi', activo);
  const { data, error } = await consulta;
  if (error) throw error;
  return data;
}
export async function crearUbicacion(db: SupabaseClient, datos: Datos) {
  const { data, error } = await db.from('ubicacion').insert({ ...datos, estubi: true }).select().single();
  if (error) throw error;
  return data;
}
async function actualizar(db: SupabaseClient, id: string, cambios: Datos | { estubi: boolean }) {
  const { data, error } = await db.from('ubicacion').update(cambios).eq('codubi', id).select().maybeSingle();
  if (error) throw error;
  if (!data) throw new ErrorHttp(404, 'La ubicación no existe');
  return data;
}
export const actualizarUbicacion = (db: SupabaseClient, id: string, datos: Datos) => actualizar(db, id, datos);
// Las restricciones se comprueban en la transacción de la BD, no con una consulta previa vulnerable a carreras.
export const cambiarEstadoUbicacion = (db: SupabaseClient, id: string, estubi: boolean) => actualizar(db, id, { estubi });

