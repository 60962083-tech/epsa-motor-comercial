import type { SupabaseClient } from '@supabase/supabase-js';

export type FabricaClientePublico = () => SupabaseClient;

export interface ImagenModeloPublica {
  urlimo: string;
  ordimo: number;
}

export interface ImagenModeloAdministrativa extends ImagenModeloPublica {
  codimo: string;
  codmod: string;
  estimo: boolean;
}

export interface ModeloPublico {
  codmod: string;
  nommod: string;
  marmod: string;
  desmod: string;
  carmod: string;
  premod: number | null;
  colores: string[];
  imagenes: ImagenModeloPublica[];
}

export type EstadoModelo = 'Borrador' | 'Publicado' | 'No publicado';

export interface ModeloAdministrativo extends Omit<ModeloPublico, 'imagenes'> {
  codtmo: string;
  estmod: EstadoModelo;
  imagenes: ImagenModeloAdministrativa[];
}
