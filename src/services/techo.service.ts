import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ActualizarConfiguracionTechoInput, ConfiguracionTecho,
  ProveedorTechoCatalogo, TipoTechoCatalogo
} from '../types/techo.types';

async function consultar<T>(db: SupabaseClient, funcion: string, parametros?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(funcion, parametros);
  if (error) throw error;
  return data as T;
}

export const listarTiposTecho = (db: SupabaseClient) =>
  consultar<TipoTechoCatalogo[]>(db, 'hu004_listar_tipos_techo');

export const listarProveedoresTecho = (db: SupabaseClient) =>
  consultar<ProveedorTechoCatalogo[]>(db, 'hu004_listar_proveedores_techo');

export const obtenerConfiguracionTecho = (db: SupabaseClient, coduni: string) =>
  consultar<ConfiguracionTecho>(db, 'hu004_obtener_configuracion_techo', { p_coduni: coduni });

export const actualizarConfiguracionTecho = (db: SupabaseClient, datos: ActualizarConfiguracionTechoInput) =>
  consultar<ConfiguracionTecho>(db, 'hu004_actualizar_configuracion_techo', { ...datos });
