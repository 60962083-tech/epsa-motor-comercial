import type { SupabaseClient } from '@supabase/supabase-js';

export type FabricaClientePublicoSedes = () => SupabaseClient;

export interface SedePublica {
  codsed: string;
  nomsed: string;
  dirsed: string | null;
  telsed: string | null;
  horsed: string | null;
}
