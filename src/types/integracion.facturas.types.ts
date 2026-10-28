export interface CredencialesHmac {
  keyId: string;
  secret: string;
}

export interface ConfiguracionIntegracionFacturas {
  actual: CredencialesHmac;
  anterior: CredencialesHmac | null;
  toleranciaSegundos: number;
  bucket: string;
}

export interface HeadersIntegracionFactura {
  keyId: string;
  timestamp: number;
  timestampTexto: string;
  nonce: string;
  gmailMessageId: string;
  sha256Xml: string;
  sha256Pdf: string | null;
}

export interface ReservaRecepcionFactura {
  resultado: 'Nueva' | 'Reintentar' | 'Procesando' | 'PdfProcesando' | 'CompletarPdf'
    | 'Completada' | 'ConflictoDocumental' | 'NONCE_REPETIDO' | 'PDF_EVIDENCIA_CONFLICTO';
  codrec?: string;
  coditi?: string;
  estado?: string;
  coddoc?: string | null;
  coderror?: string | null;
  pdfPendiente?: boolean;
  rutaXml?: string | null;
  rutaPdf?: string | null;
  resumen?: ResumenRecepcionFactura | null;
  sha256Xml?: string | null;
  sha256Pdf?: string | null;
  /** Solo se asigna en memoria, después de recalcular los bytes del PDF recibido. */
  sha256PdfVerificado?: string | null;
}

export interface ResumenRecepcionFactura {
  requestId?: string;
  codrec?: string;
  coddoc: string;
  estadoDocumento: string;
  reintento: boolean;
  pdfPendiente: boolean;
  conteos: { lineas: number; vehiculos: number; importados: number; revision: number };
  advertencias: string[];
}

export interface RequestIntegracionFactura {
  keyId: string;
  nonce: string;
  timestamp: number;
  gmailMessageId: string;
  sha256Xml: string;
  sha256Pdf: string | null;
  secreto: string;
}
