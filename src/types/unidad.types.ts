export type EstadoIdentificacionCompra =
  | 'Pendiente de factura'
  | 'Pendiente de identificación'
  | 'Identificada';

export interface FacturaCompraRequest {
  emisor: string;
  numero: string;
  fecha_emision: string;
  cantidad_motos: number;
}

export interface FacturaCompraInput {
  p_codcom: string;
  p_emisor: string;
  p_numero: string;
  p_fecha_emision: string;
  p_cantidad_motos: number;
}

export interface FacturaCompra {
  codfac: string;
  emisor: string;
  numero: string;
  fecha_emision: string;
  cantidad_motos: number;
  archivo_adjuntado: boolean;
}

export interface FacturaCompraResultado {
  codcom: string;
  estcom: EstadoIdentificacionCompra;
  factura: FacturaCompra;
  requiere_revision: boolean;
}

export interface UnidadIdentificacionRequest {
  nummotuni: string;
  chauni: string;
  codmod: string | number;
  coluni: string;
}

export interface IdentificarCompraRequest {
  unidades: UnidadIdentificacionRequest[];
}

export interface UnidadIdentificacionInput {
  nummotuni: string;
  chauni: string;
  codmod: string;
  coluni: string;
}

export interface IdentificacionCompraInput {
  p_codcom: string;
  p_unidades: UnidadIdentificacionInput[];
}

export interface ConsultaUnidadesInput {
  p_codcom: string;
}

export interface UnidadIdentificada {
  coduni: string;
  codcom: string;
  codmod: string;
  nummotuni: string;
  chauni: string;
  coluni: string | null;
  fecreguni: string;
}

export interface IdentificacionCompraResultado {
  codcom: string;
  cantidad_comprada: number;
  cantidad_identificada: number;
  cantidad_pendiente: number;
  estcom: EstadoIdentificacionCompra;
  factura: FacturaCompra | null;
  unidades: UnidadIdentificada[];
}

export interface ConflictoIdentificacion {
  campo: 'nummotuni' | 'chauni';
  unidad: UnidadIdentificada;
}

export interface ErrorUnidadBD {
  code?: string;
  details?: string;
}

