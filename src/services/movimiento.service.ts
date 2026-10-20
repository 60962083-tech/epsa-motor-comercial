import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  EstadoMovimientosUnidad, IniciarMovimientoInput, MovimientoUbicacion
} from '../types/movimiento.types';

async function consultar<T>(db: SupabaseClient, funcion: string, parametros: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(funcion, parametros);
  if (error) throw error;
  return data as T;
}

export const iniciarMovimiento = (db: SupabaseClient, datos: IniciarMovimientoInput) =>
  consultar<MovimientoUbicacion>(db, 'hu003_iniciar_movimiento', { ...datos });

export const confirmarRecepcion = (db: SupabaseClient, p_coduni: string, p_codmub: string) =>
  consultar<MovimientoUbicacion>(db, 'hu003_confirmar_recepcion', { p_coduni, p_codmub });

export const consultarMovimientos = (db: SupabaseClient, p_coduni: string) =>
  consultar<EstadoMovimientosUnidad>(db, 'hu003_consultar_movimientos', { p_coduni });
