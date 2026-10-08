import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModeloPublico } from '../types/modelo.types';

export async function listarModelosPublicados(db: SupabaseClient): Promise<ModeloPublico[]> {
  // La RPC fija el estado y la proyección pública; no recibe filtros del cliente.
  const { data, error } = await db.rpc('hu012_modelos_publicados');
  if (error) throw error;
  return data ?? [];
}

export async function listarModeloPublicadoPorId(db: SupabaseClient, codmod: string): Promise<ModeloPublico | null> {
  const { data, error } = await db.rpc('hu009_modelo_publicado_por_id', { p_codmod: codmod });
  if (error) throw error;
  return data;
}
