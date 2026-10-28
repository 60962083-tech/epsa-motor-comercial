import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { importarFacturaXml, ErrorServicioImportacionFactura } from './factura.importacion.service.js';
import type { HeadersIntegracionFactura, ReservaRecepcionFactura, ResumenRecepcionFactura } from '../types/integracion.facturas.types.js';

export class ErrorIntegracionHttp extends Error {
  constructor(public readonly status: number, public readonly codigo: string) {
    super(codigo);
    this.name = 'ErrorIntegracionHttp';
  }
}

interface ContextoIntegracion {
  dbIntegracion?: SupabaseClient;
  headersIntegracion?: HeadersIntegracionFactura;
  reservaIntegracion?: ReservaRecepcionFactura;
}

interface ArchivoIntegracion {
  buffer: Buffer;
  mimetype: string;
}

export interface ArchivosRecibidos {
  xml?: ArchivoIntegracion[];
  pdf?: ArchivoIntegracion[];
}

const hash = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');
const pathEvidencia = (codrec: string, tipo: 'xml' | 'pdf') => `documentos/${codrec}/original.${tipo}`;

type OperacionFinalizacion = 'Procesar' | 'CompletarPdf' | 'SoloIntento';

async function finalizarIntento(
  db: SupabaseClient, headers: HeadersIntegracionFactura, reserva: ReservaRecepcionFactura,
  operation: OperacionFinalizacion, estado: 'Completada' | 'Error', status: number,
  options: { coddoc?: string | null; rutaXml?: string | null; rutaPdf?: string | null;
    pdfPendiente?: boolean | null; sha256PdfVerificado?: string | null;
    error?: string | null; resumen?: ResumenRecepcionFactura | null } = {}
): Promise<Record<string, unknown>> {
  const { data, error } = await db.rpc('hu030_integracion_finalizar_tecnico', {
    p_codrec: reserva.codrec, p_key_id: headers.keyId, p_nonce: headers.nonce,
    p_operacion: operation, p_estado: estado, p_coddoc: options.coddoc ?? null,
    p_rutaxml: options.rutaXml ?? null, p_rutapdf: options.rutaPdf ?? null,
    p_pdfpendiente: options.pdfPendiente ?? null,
    p_sha256_pdf_verificado: options.sha256PdfVerificado ?? null, p_error: options.error ?? null,
    p_resumen: options.resumen ?? null, p_http_status: status
  });
  if (error || !data || typeof data !== 'object' || Array.isArray(data))
    throw new ErrorIntegracionHttp(503, 'RECEPCION_NO_FINALIZADA');
  const result = data as Record<string, unknown>;
  if (result.resultado === 'LEASE_PERDIDO') throw new ErrorIntegracionHttp(409, 'LEASE_PERDIDO');
  if (result.resultado === 'PDF_EVIDENCIA_CONFLICTO') throw new ErrorIntegracionHttp(409, 'PDF_EVIDENCIA_CONFLICTO');
  if (result.resultado === 'INVARIANTE_RECEPCION') throw new ErrorIntegracionHttp(409, 'INVARIANTE_RECEPCION');
  if (result.resultado === 'INTENTO_CERRADO') throw new ErrorIntegracionHttp(409, 'INTENTO_CERRADO');
  return result;
}

export async function marcarErrorRecepcion(
  contexto: ContextoIntegracion, codigo: string, status: number
): Promise<'LEASE_PERDIDO' | null> {
  const { dbIntegracion: db, headersIntegracion: headers, reservaIntegracion: reserva } = contexto;
  if (!db || !headers || !reserva?.codrec) return null;
  if (['Procesando', 'PdfProcesando', 'NONCE_REPETIDO', 'PDF_EVIDENCIA_CONFLICTO'].includes(reserva.resultado)) return null;
  const operation: OperacionFinalizacion = reserva.resultado === 'CompletarPdf' ? 'CompletarPdf'
    : ['Nueva', 'Reintentar'].includes(reserva.resultado) ? 'Procesar' : 'SoloIntento';
  const errorDurable = operation === 'CompletarPdf' && codigo === 'PDF_STORAGE_ERROR'
    && reserva.sha256PdfVerificado ? 'PDF_STORAGE_PENDING' : codigo;
  const verifiedHash = errorDurable === 'PDF_STORAGE_PENDING' ? reserva.sha256PdfVerificado : null;
  try {
    await finalizarIntento(db, headers, reserva, operation, 'Error', status, {
      coddoc: reserva.coddoc, rutaXml: reserva.rutaXml, rutaPdf: reserva.rutaPdf,
      pdfPendiente: operation === 'CompletarPdf' ? true : reserva.pdfPendiente,
      sha256PdfVerificado: verifiedHash, error: errorDurable, resumen: reserva.resumen
    });
  } catch (error) {
    // El error externo conserva únicamente el código controlado.
    if (error instanceof ErrorIntegracionHttp && error.codigo === 'LEASE_PERDIDO') return 'LEASE_PERDIDO';
    return null;
  }
  return null;
}

function dataResumen(value: unknown, codrec: string): ResumenRecepcionFactura | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const counts = input.conteos as Record<string, unknown> | undefined;
  if (typeof input.coddoc !== 'string' || typeof input.estadoDocumento !== 'string'
    || !counts || typeof counts.lineas !== 'number' || typeof counts.vehiculos !== 'number'
    || typeof counts.importados !== 'number' || typeof counts.revision !== 'number') return null;
  const warnings = Array.isArray(input.advertencias)
    ? input.advertencias.filter((item): item is string => typeof item === 'string' && /^[A-Z0-9_]{1,80}$/.test(item))
    : [];
  return {
    requestId: undefined, codrec, coddoc: input.coddoc, estadoDocumento: input.estadoDocumento,
    reintento: input.reintento === true, pdfPendiente: input.pdfPendiente === true,
    conteos: { lineas: counts.lineas, vehiculos: counts.vehiculos, importados: counts.importados, revision: counts.revision },
    advertencias: warnings
  };
}

function responderResumen(summary: ResumenRecepcionFactura, requestId: string) {
  return { requestId, codrec: summary.codrec, coddoc: summary.coddoc,
    estadoDocumento: summary.estadoDocumento, reintento: summary.reintento,
    pdfPendiente: summary.pdfPendiente, conteos: summary.conteos, advertencias: summary.advertencias };
}

async function guardarSinSobrescribir(
  db: SupabaseClient, bucket: string, path: string, content: Buffer, mime: string, expectedHash: string
): Promise<void> {
  const separator = path.lastIndexOf('/');
  const folder = path.slice(0, separator);
  const filename = path.slice(separator + 1);
  const storage = db.storage.from(bucket);
  const listed = await storage.list(folder, { search: filename, limit: 5 });
  if (listed.error) throw new Error('STORAGE_UNAVAILABLE');
  const exists = (listed.data ?? []).some((item) => item.name === filename);
  if (exists) {
    const downloaded = await storage.download(path);
    if (downloaded.error || !downloaded.data) throw new Error('STORAGE_UNAVAILABLE');
    const prior = Buffer.from(await downloaded.data.arrayBuffer());
    if (hash(prior) !== expectedHash) throw new Error('STORAGE_EVIDENCE_CONFLICT');
    return;
  }
  const uploaded = await storage.upload(path, content, {
    contentType: mime, upsert: false, metadata: { sha256: expectedHash }
  });
  if (uploaded.error) {
    // Una carrera de Storage solo se acepta si el objeto ganador contiene los mismos bytes.
    const retry = await storage.download(path);
    if (retry.error || !retry.data) throw new Error('STORAGE_UNAVAILABLE');
    const prior = Buffer.from(await retry.data.arrayBuffer());
    if (hash(prior) !== expectedHash) throw new Error('STORAGE_EVIDENCE_CONFLICT');
  }
}

async function verificarEvidenciaExistente(
  db: SupabaseClient, bucket: string, path: string | null | undefined, expectedHash: string | null | undefined
): Promise<void> {
  if (!path || !expectedHash || !/^documentos\/[0-9a-f-]{36}\/original\.(xml|pdf)$/.test(path))
    throw new Error('STORAGE_EVIDENCE_MISSING');
  const separator = path.lastIndexOf('/');
  const filename = path.slice(separator + 1);
  const storage = db.storage.from(bucket);
  const listed = await storage.list(path.slice(0, separator), { search: filename, limit: 5 });
  if (listed.error) throw new Error('STORAGE_UNAVAILABLE');
  if (!(listed.data ?? []).some((item) => item.name === filename)) throw new Error('STORAGE_EVIDENCE_MISSING');
  const downloaded = await storage.download(path);
  if (downloaded.error || !downloaded.data) throw new Error('STORAGE_UNAVAILABLE');
  const bytes = Buffer.from(await downloaded.data.arrayBuffer());
  if (hash(bytes) !== expectedHash) throw new Error('STORAGE_EVIDENCE_CONFLICT');
}

export async function procesarRecepcionFactura(
  db: SupabaseClient,
  bucket: string,
  headers: HeadersIntegracionFactura,
  reserva: ReservaRecepcionFactura,
  archivos: ArchivosRecibidos,
  requestId: string
): Promise<{ status: number; data: Record<string, unknown> }> {
  if (!reserva.codrec) throw new ErrorIntegracionHttp(503, 'INTEGRACION_NO_DISPONIBLE');
  const xmls = archivos.xml ?? [];
  const pdfs = archivos.pdf ?? [];
  if (xmls.length !== 1 || pdfs.length > 1) throw new ErrorIntegracionHttp(400, 'MULTIPART_INVALIDO');
  const xml = xmls[0]!;
  const pdf = pdfs[0];
  if (xml.buffer.length > 5 * 1024 * 1024) throw new ErrorIntegracionHttp(413, 'ARCHIVO_DEMASIADO_GRANDE');
  if (!['application/xml', 'text/xml'].includes(xml.mimetype)) throw new ErrorIntegracionHttp(400, 'MIME_XML_INVALIDO');
  if ((headers.sha256Pdf === null) !== (pdf === undefined)) throw new ErrorIntegracionHttp(400, 'PRESENCIA_PDF_NO_COINCIDE');
  if (pdf && pdf.mimetype !== 'application/pdf') throw new ErrorIntegracionHttp(400, 'MIME_PDF_INVALIDO');
  if (pdf && !pdf.buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new ErrorIntegracionHttp(400, 'PDF_INVALIDO');

  const xmlHash = hash(xml.buffer);
  if (xmlHash !== headers.sha256Xml) throw new ErrorIntegracionHttp(400, 'HASH_XML_NO_COINCIDE');
  const pdfHash = pdf ? hash(pdf.buffer) : null;
  if (pdfHash !== headers.sha256Pdf) throw new ErrorIntegracionHttp(400, 'HASH_PDF_NO_COINCIDE');
  reserva.sha256PdfVerificado = pdfHash;

  if (['Procesando', 'PdfProcesando'].includes(reserva.resultado)) {
    return { status: 202, data: { requestId, codrec: reserva.codrec, estado: 'Procesando', retryAfter: 2 } };
  }
  const priorSummary = dataResumen(reserva.resumen, reserva.codrec);
  if (['Completada', 'ConflictoDocumental', 'CompletarPdf'].includes(reserva.resultado)) {
    if (reserva.sha256Xml && reserva.sha256Xml !== xmlHash)
      throw new ErrorIntegracionHttp(409, 'EVIDENCIA_CONFLICTO');
    try {
      await verificarEvidenciaExistente(db, bucket, reserva.rutaXml, reserva.sha256Xml ?? headers.sha256Xml);
    } catch (error) {
      const conflict = error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT';
      const missing = error instanceof Error && error.message === 'STORAGE_EVIDENCE_MISSING';
      throw new ErrorIntegracionHttp(conflict ? 409 : 503, conflict ? 'EVIDENCIA_CONFLICTO'
        : missing ? 'EVIDENCIA_XML_NO_DISPONIBLE' : 'XML_STORAGE_ERROR');
    }

    if (!reserva.pdfPendiente) {
      try { await verificarEvidenciaExistente(db, bucket, reserva.rutaPdf, reserva.sha256Pdf); }
      catch (error) {
        const conflict = error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT';
        const missing = error instanceof Error && error.message === 'STORAGE_EVIDENCE_MISSING';
        throw new ErrorIntegracionHttp(conflict ? 409 : 503, conflict ? 'PDF_EVIDENCIA_CONFLICTO'
          : missing ? 'EVIDENCIA_PDF_NO_DISPONIBLE' : 'PDF_STORAGE_ERROR');
      }
    }

    if (reserva.resultado === 'ConflictoDocumental') {
      if (!priorSummary) throw new ErrorIntegracionHttp(503, 'RESUMEN_NO_DISPONIBLE');
      await finalizarIntento(db, headers, reserva, 'SoloIntento', 'Error', 409, { error: 'CONFLICTO_DOCUMENTAL' });
      return { status: 409, data: { ...responderResumen(priorSummary, requestId),
        estadoDocumento: 'Pendiente de revision', code: 'CONFLICTO_DOCUMENTAL' } };
    }

    if (reserva.resultado === 'CompletarPdf') {
      if (!pdf || !reserva.pdfPendiente) throw new ErrorIntegracionHttp(400, 'PDF_REQUERIDO');
      if (reserva.sha256Pdf && reserva.sha256Pdf !== pdfHash)
        throw new ErrorIntegracionHttp(409, 'PDF_EVIDENCIA_CONFLICTO');
      if (reserva.rutaPdf) {
        try { await verificarEvidenciaExistente(db, bucket, reserva.rutaPdf, reserva.sha256Pdf ?? pdfHash); }
        catch (error) {
          const conflict = error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT';
          throw new ErrorIntegracionHttp(conflict ? 409 : 503, conflict ? 'PDF_EVIDENCIA_CONFLICTO' : 'PDF_STORAGE_ERROR');
        }
      }
      const pdfPath = reserva.rutaPdf ?? pathEvidencia(reserva.codrec, 'pdf');
      try {
        await guardarSinSobrescribir(db, bucket, pdfPath, pdf.buffer, 'application/pdf', pdfHash!);
      } catch (error) {
        const conflict = error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT';
        throw new ErrorIntegracionHttp(conflict ? 409 : 503, conflict ? 'PDF_EVIDENCIA_CONFLICTO' : 'PDF_STORAGE_ERROR');
      }
      const summary: ResumenRecepcionFactura = { ...(priorSummary ?? {
        codrec: reserva.codrec, coddoc: reserva.coddoc ?? '', estadoDocumento: 'Importado', reintento: true,
        pdfPendiente: true, conteos: { lineas: 0, vehiculos: 0, importados: 0, revision: 0 }, advertencias: []
      }), coddoc: reserva.coddoc ?? priorSummary?.coddoc ?? '', pdfPendiente: false, reintento: true };
      const documentaryConflict = reserva.coderror === 'CONFLICTO_DOCUMENTAL';
      if (documentaryConflict) summary.estadoDocumento = 'Pendiente de revision';
      await finalizarIntento(db, headers, reserva, 'CompletarPdf', 'Completada', documentaryConflict ? 409 : 200, {
        coddoc: reserva.coddoc, rutaXml: reserva.rutaXml, rutaPdf: pdfPath, pdfPendiente: false,
        sha256PdfVerificado: pdfHash, error: documentaryConflict ? 'CONFLICTO_DOCUMENTAL' : null, resumen: summary
      });
      if (documentaryConflict) return { status: 409, data: { ...responderResumen(summary, requestId), code: 'CONFLICTO_DOCUMENTAL' } };
      return { status: 200, data: responderResumen(summary, requestId) };
    }

    if (pdf && reserva.pdfPendiente) throw new ErrorIntegracionHttp(503, 'LEASE_PDF_NO_ADQUIRIDO');
    if (!priorSummary) throw new ErrorIntegracionHttp(503, 'RESUMEN_NO_DISPONIBLE');
    await finalizarIntento(db, headers, reserva, 'SoloIntento', 'Completada', 200);
    return { status: 200, data: responderResumen(priorSummary, requestId) };
  }
  if (!['Nueva', 'Reintentar'].includes(reserva.resultado)) throw new ErrorIntegracionHttp(503, 'INTEGRACION_NO_DISPONIBLE');

  const xmlPath = pathEvidencia(reserva.codrec, 'xml');
  try {
    await guardarSinSobrescribir(db, bucket, xmlPath, xml.buffer, 'application/xml', xmlHash);
  } catch (error) {
    const conflict = error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT';
    throw new ErrorIntegracionHttp(conflict ? 409 : 503, conflict ? 'EVIDENCIA_CONFLICTO' : 'XML_STORAGE_ERROR');
  }

  let pdfPath: string | null = reserva.rutaPdf ?? null;
  let pdfPending = !pdfPath;
  let errorPdf: string | null = null;
  if (pdf) {
    try {
      await guardarSinSobrescribir(db, bucket, pathEvidencia(reserva.codrec, 'pdf'), pdf.buffer, 'application/pdf', pdfHash!);
      pdfPath = pathEvidencia(reserva.codrec, 'pdf');
      pdfPending = false;
    } catch (error) {
      if (error instanceof Error && error.message === 'STORAGE_EVIDENCE_CONFLICT')
        throw new ErrorIntegracionHttp(409, 'PDF_EVIDENCIA_CONFLICTO');
      pdfPending = true;
      errorPdf = 'PDF_STORAGE_PENDING';
    }
  }

  let result;
  try {
    result = await importarFacturaXml(db, xml.buffer, undefined, {
      equivalencias: 'hu030_listar_equivalencias_tecnicas', importar: 'hu030_importar_documento_tecnico'
    });
  } catch (error) {
    if (error instanceof ErrorServicioImportacionFactura) {
      const status = ['VALIDACION_DOCUMENTAL_FALLIDA','PROVEEDOR_NO_AUTORIZADO','DOCUMENTO_RECHAZADO'].includes(error.codigo) ? 422
        : error.codigo === 'XML_INVALIDO' ? 400 : 503;
      throw new ErrorIntegracionHttp(status, error.codigo === 'VALIDACION_DOCUMENTAL_FALLIDA'
        ? (error.erroresValidacion[0] ?? 'CONFLICTO_DOCUMENTAL') : error.codigo);
    }
    throw new ErrorIntegracionHttp(503, 'ERROR_IMPORTACION');
  }

  const summary: ResumenRecepcionFactura = {
    codrec: reserva.codrec, coddoc: result.coddoc, estadoDocumento: result.estadoDocumento,
    reintento: result.reintento, pdfPendiente: pdfPending,
    conteos: { ...result.conteos },
    advertencias: result.advertencias.filter((item) => /^[A-Z0-9_]{1,80}$/.test(item))
  };
  if (result.error === 'ERROR_TECNICO_IMPORTACION') throw new ErrorIntegracionHttp(503, 'ERROR_IMPORTACION');
  if (result.error === 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO') {
    const conflicto = { ...summary, estadoDocumento: 'Pendiente de revision' };
    await finalizarIntento(db, headers, reserva, 'Procesar', 'Completada', 409, {
      coddoc: result.coddoc, rutaXml: xmlPath, rutaPdf: pdfPath, pdfPendiente: pdfPending,
      sha256PdfVerificado: pdfHash, error: 'CONFLICTO_DOCUMENTAL', resumen: conflicto
    });
    return { status: 409, data: { ...responderResumen(conflicto, requestId), code: 'CONFLICTO_DOCUMENTAL' } };
  }
  await finalizarIntento(db, headers, reserva, 'Procesar', 'Completada', 201, {
    coddoc: result.coddoc, rutaXml: xmlPath, rutaPdf: pdfPath, pdfPendiente: pdfPending,
    sha256PdfVerificado: pdfHash, error: errorPdf, resumen: summary
  });
  return { status: 201, data: responderResumen(summary, requestId) };
}
