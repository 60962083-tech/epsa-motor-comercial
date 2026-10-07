import type { SupabaseClient } from '@supabase/supabase-js';
import type { ModeloPublico } from '../types/modelo.types';

export async function listarModelosPublicados(db: SupabaseClient): Promise<ModeloPublico[]> {
  // La RPC fija el estado y la proyección pública; no recibe filtros del cliente.
  const { data, error } = await db.rpc('hu012_modelos_publicados');
  if (error) throw error;
  return data ?? [];
}
