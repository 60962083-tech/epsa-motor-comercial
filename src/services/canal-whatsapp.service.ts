import type { SupabaseClient } from '@supabase/supabase-js';
import type { CambiosCanalWhatsapp, CanalWhatsapp } from '../types/canal-whatsapp.types';

export async function actualizarCanalWhatsapp(
  db: SupabaseClient,
  codcwa: string,
  cambios: CambiosCanalWhatsapp
): Promise<CanalWhatsapp> {
  const { data, error } = await db.rpc('hu013_actualizar_canal_whatsapp', {
    p_codcwa: codcwa,
    p_cambios: cambios
  });
  if (error) throw error;
  return data as CanalWhatsapp;
}
