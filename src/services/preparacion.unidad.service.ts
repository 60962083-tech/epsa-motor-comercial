import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActualizarPreparacionUnidadInput,
  ConsultaPreparacionUnidad,
  PreparacionUnidadActual
} from '../types/preparacion.unidad.types';

export async function consultarPreparacionUnidad(
  db: SupabaseClient,
  p_coduni: string
): Promise<ConsultaPreparacionUnidad> {
  const { data, error } = await db.rpc('hu033_consultar_preparacion_unidad', { p_coduni });
  if (error) throw error;
  return data as unknown as ConsultaPreparacionUnidad;
}

export async function actualizarPreparacionUnidad(
  db: SupabaseClient,
  datos: ActualizarPreparacionUnidadInput
): Promise<PreparacionUnidadActual> {
  const { p_coduni, ...parametros } = datos;
  const { data, error } = await db.rpc('hu033_actualizar_preparacion_unidad', { p_coduni, ...parametros });
  if (error) throw error;
  return data as unknown as PreparacionUnidadActual;
}
