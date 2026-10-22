import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsultaInventarioInput, InventarioResultado } from '../types/inventario.types';

export async function consultarInventario(
  db: SupabaseClient,
  filtros: ConsultaInventarioInput
): Promise<InventarioResultado> {
  const { data, error } = await db.rpc('hu001_consultar_inventario', filtros);
  if (error) throw error;
  return data as InventarioResultado;
}
