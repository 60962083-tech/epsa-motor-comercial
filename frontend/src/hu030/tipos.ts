// HU-030 · Copia para el navegador del código de la API (Michelle). Mantener igual al original.
export interface PropiedadFacturaOriginal {
  codigo: string | null;
  nombre: string | null;
  valor: string;
}

export interface InformacionAdicionalFactura {
  codigo: string | null;
  valor: string;
  original: string;
}

export interface TotalesFacturaUbl {
  sumaLineas: string | null;
  sumaLineasOnerosas: string | null;
  sumaLineasGratuitas: string | null;
  totalLineasDeclarado: string | null;
  totalOperacionesGratuitasDeclarado: string | null;
  valorVentaDeclarado: string | null;
  totalAntesImpuestos: string | null;
  totalIncluidosImpuestos: string | null;
  totalPagar: string | null;
  impuestos: string | null;
}

export interface LineaFacturaUbl {
  numeroLinea: string | null;
  codigoExterno: string | null;
  descripcion: string | null;
  cantidad: string | null;
  unidadMedida: string | null;
  pedidoLinea: string | null;
  valorLinea: string | null;
  precioUnitario: string | null;
  precioReferencial: string | null;
  clasificacionUnspc: string | null;
  operacionGratuita: boolean;
  valorOperacionGratuita: string | null;
  priceTypeCode: string | null;
  taxExemptionReasonCode: string | null;
  taxScheme: string | null;
  propiedadesPorCodigo: Record<string, string[]>;
  propiedadesOriginales: PropiedadFacturaOriginal[];
  additionalInformation: InformacionAdicionalFactura[];
}

export interface FacturaUblParseada {
  ublVersion: string | null;
  tipoDocumento: string | null;
  idDocumento: string | null;
  serie: string | null;
  numero: string | null;
  fechaEmision: string | null;
  fechaVencimiento: string | null;
  moneda: string | null;
  rucEmisor: string | null;
  razonSocialEmisor: string | null;
  rucComprador: string | null;
  razonSocialComprador: string | null;
  pedidoCabecera: string | null;
  cantidadLineasDeclarada: string | null;
  firmaPresente: boolean;
  totales: TotalesFacturaUbl;
  advertencias: string[];
  lineas: LineaFacturaUbl[];
}

export interface ConfiguracionValidacionFactura {
  rucEmisoresPermitidos: readonly string[];
  rucCompradorEsperado: string;
  tiposDocumentalesPermitidos: readonly string[];
  monedasPermitidas: readonly string[];
  toleranciaMonetaria: string;
}

export interface ResultadoValidacionFactura {
  valido: boolean;
  errores: string[];
  advertencias: string[];
}

export type ClasificacionProductoExterno = 'Vehiculo' | 'Accesorio' | 'Desconocido';
export type EstadoClasificacionLinea = 'Candidato' | 'Procesada' | 'Revision';

export interface EquivalenciaProductoExterno {
  codigoExterno: string;
  clasificacion: 'Vehiculo' | 'Accesorio';
  codmod: string | null;
  activa?: boolean;
}

export interface VehiculoImportacionCandidato {
  codmod: string;
  modeloOrigen: string;
  motor: string;
  vin: string | null;
  chasis: string;
  color: string;
  anioFabricacion: string | null;
  anioModelo: string | null;
  pedido: string | null;
  linea: string | null;
  codigoExterno: string;
}

export interface LineaFacturaClasificada {
  numeroLinea: string | null;
  codigoExterno: string | null;
  clasificacion: ClasificacionProductoExterno;
  estado: EstadoClasificacionLinea;
  motivo: string | null;
  motivos: string[];
  equivalencia: EquivalenciaProductoExterno | null;
  vehiculos: VehiculoImportacionCandidato[];
}

export interface GrupoCompraImportada {
  codmod: string;
  color: string;
  cantidad: number;
  pedidos: string[];
  vehiculos: VehiculoImportacionCandidato[];
}

export interface LineaFacturaPreparadaImportacion extends LineaFacturaUbl, LineaFacturaClasificada {}

export interface PayloadImportacionDocumento {
  documento: FacturaUblParseada;
  lineas: LineaFacturaPreparadaImportacion[];
  advertencias: string[];
  checksumXml: string;
  origen: 'XML_Interno';
  /** Resumen informativo; la RPC vuelve a agrupar y resuelve siempre desde PostgreSQL. */
  gruposCalculados: GrupoCompraImportada[];
}

export interface ResultadoImportacionDocumento {
  coddoc: string;
  estadoDocumento: 'Importado' | 'Importado parcialmente' | 'Pendiente de revision' | 'Error';
  reintento: boolean;
  error: string | null;
  compras: Array<{ codcom: string; codmod: string; color: string; cantidad: number; tipoVinculo: 'Automatico' | 'Conciliado' }>;
  unidades: Array<{ coduni: string; motorEnmascarado: string; chasisEnmascarado: string; pedido: string | null }>;
  lineasRevision: Array<{ numeroLinea: string; codigo: string | null; motivo: string }>;
  conteos: { lineas: number; vehiculos: number; importados: number; revision: number };
  advertencias: string[];
}
