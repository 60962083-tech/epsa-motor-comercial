import type { SupabaseClient } from '@supabase/supabase-js';

export type FabricaClientePublico = () => SupabaseClient;

export interface ImagenModeloPublica {
  urlimo: string;
  ordimo: number;
}

export interface ModeloPublico {
  codmod: string;
  nommod: string;
  marmod: string;
  desmod: string;
  carmod: string;
  imagenes: ImagenModeloPublica[];
}
