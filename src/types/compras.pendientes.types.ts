export type OrigenCompraPendiente = 'Automatico' | 'Manual' | 'No determinado';
export type TipoVinculoDocumento = 'Automatico' | 'Conciliado';

export type EstadoRecepcionCompra =
  | 'Sin unidades identificadas'
  | 'Recibida en EPSA'
  | 'En otra ubicación confirmada'
  | 'En Crosland'
  | 'En tránsito'
  | 'Movimiento pendiente'
  | 'Recepción pendiente'
  | 'Recepción mixta'
  | 'Ubicación confirmada mixta';

export interface ConteosRecepcionCompra {
  enCrossland: number;
  enTransito: number;
  recibidasEnEpsa: number;
  sinUbicacion: number;
  movimientoPendiente: number;
  otraUbicacion: number;
}

export interface DocumentoCompraVinculado {
  coddoc: string;
  numeroDocumento: string | null;
  tipoVinculo: TipoVinculoDocumento;
  estadoDocumento: string;
  codigoIncidencia: string | null;
  motivoIncidencia: string | null;
  advertencias: string[];
}

export interface FacturaCompraPendiente {
  coddoc?: string;
  codfac?: string;
  numero: string | null;
  tipo: 'Importada' | 'Registrada';
  fecha_importacion?: string | null;
  fecha_emision?: string | null;
  estado?: string | null;
  motivo?: string | null;
  codigoIncidencia?: string | null;
}

export interface ReferenciaCompraPendiente {
  tipo: string;
  valor: string;
}

export interface CompraPendienteConsolidada {
  codcom: string;
  feccom: string;
  horcom: string;
  refcom: string | null;
  referencias: ReferenciaCompraPendiente[];
  origen: OrigenCompraPendiente;
  nommod: string;
  colcom: string;
  cantidad_comprada: number;
  cantidad_identificada: number;
  cantidad_pendiente_identificacion: number;
  estadoIdentificacion: 'Pendiente de factura' | 'Pendiente de identificación' | 'Identificada';
  bloqueadaPorDiscrepancia: boolean;
  estadoRecepcion: EstadoRecepcionCompra;
  recepcion: ConteosRecepcionCompra;
  cantidad_pendiente_recepcion: number;
  cantidad_sin_ubicacion: number;
  cantidad_en_traslado: number;
  cantidad_recibida: number;
  documentos: DocumentoCompraVinculado[];
  factura: FacturaCompraPendiente | null;
  situaciones: string[];
}

export interface DocumentoPendienteSinCompra {
  coddoc: string;
  numero: string | null;
  numeroDocumento: string | null;
  fecha_emision: string | null;
  razon_emisor: string | null;
  recibido: string | null;
  fecha_registro: string;
  estado: string;
  motivo: string | null;
  codigoIncidencia: string | null;
  advertencias: string[];
}

export interface ConteoComprasPendientes {
  'Pendiente de factura': number;
  'Pendiente de identificación': number;
  'Pendiente de recepción': number;
  'Incidencia documental': number;
}

export interface ComprasPendientesResultado {
  compras: CompraPendienteConsolidada[];
  documentos_sin_compra: DocumentoPendienteSinCompra[];
  conteo: ConteoComprasPendientes;
  total: number;
  limite: number;
  offset: number;
}

export interface ConsultaComprasPendientesInput {
  p_origen: OrigenCompraPendiente | null;
  p_limite: number;
  p_offset: number;
}
