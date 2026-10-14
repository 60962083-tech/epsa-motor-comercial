export const TIPOS_UBICACION = ['Sede', 'Almacen', 'Proveedor'] as const;
export type TipoUbicacion = typeof TIPOS_UBICACION[number];

export interface Ubicacion {
  codubi: string;
  nomubi: string;
  tipubi: TipoUbicacion;
  dirubi: string | null;
  estubi: boolean;
  telsed?: string | null;
  horsed?: string | null;
}

export interface DatosEscrituraUbicacion {
  nomubi: string;
  tipubi: TipoUbicacion;
  dirubi: string | null;
  telsed?: string | null;
  horsed?: string | null;
}
