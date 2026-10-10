import type { SupabaseClient } from '@supabase/supabase-js';
import type { SedePublica } from '../types/sede.types';

export async function listarSedesPublicas(db: SupabaseClient): Promise<SedePublica[]> {
  const { data, error } = await db.rpc('hu010_sedes_publicas');
  if (error) throw error;

  // Mantiene explícita la lista blanca pública también en el límite Express.
  return ((data ?? []) as SedePublica[]).map(sede => ({
    codsed: String(sede.codsed),
    nomsed: sede.nomsed,
    dirsed: sede.dirsed,
    telsed: sede.telsed,
    horsed: sede.horsed
  }));
}
