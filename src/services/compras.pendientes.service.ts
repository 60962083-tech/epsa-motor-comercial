import type { SupabaseClient } from '@supabase/supabase-js';
import type { ComprasPendientesResultado, ConsultaComprasPendientesInput } from '../types/compras.pendientes.types';

export async function consultarComprasPendientes(
  db: SupabaseClient,
  filtros: ConsultaComprasPendientesInput
): Promise<ComprasPendientesResultado> {
  const { data, error } = await db.rpc('hu023_consultar_compras_pendientes', filtros);
  if (error) throw error;
  return data as ComprasPendientesResultado;
}
