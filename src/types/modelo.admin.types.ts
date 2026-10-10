import type { EstadoModelo, ImagenModeloAdministrativa, ModeloAdministrativo } from './modelo.types';

export interface CrearModeloInput {
  codtmo: string;
  nommod: string;
  marmod: string;
  desmod: string;
  carmod: string;
  premod: number | null;
  colores: string[];
  estmod: EstadoModelo;
}

export type CambiosModeloInput = Partial<Pick<CrearModeloInput,
  'codtmo' | 'nommod' | 'marmod' | 'desmod' | 'carmod' | 'premod' | 'colores'>>;

export interface EstadoModeloInput {
  estmod: EstadoModelo;
}

export interface CrearImagenModeloInput {
  urlimo: string;
  ordimo: number;
}

export interface ActualizarImagenModeloInput extends CrearImagenModeloInput {}

export interface EstadoImagenModeloInput {
  estimo: boolean;
}

export type ModeloAdminResult = ModeloAdministrativo;
export type ImagenModeloAdminResult = ImagenModeloAdministrativa;
