import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
export function crearClienteSupabase(token: string) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Faltan variables de entorno de Supabase');
  // Cliente por petición: nunca compartir sesiones entre usuarios.
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
}

