export interface CompraPendienteInput {
  p_codmod: string;
  p_colcom: string;
  p_cancom: number;
  p_idempotencia: string;
}

export interface CompraPendienteResultado {
  creada: boolean;
  compra: unknown;
}

export interface PaginacionCompra {
  p_limite: number;
  p_offset: number;
}