import type { RequestHandler } from 'express';
import multer from 'multer';
import { marcarErrorRecepcion } from '../services/integracion.facturas.service.js';

export const MAXIMO_XML_INTEGRACION = 5 * 1024 * 1024;
export const MAXIMO_PDF_INTEGRACION = 10 * 1024 * 1024;

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAXIMO_PDF_INTEGRACION, files: 2, fields: 0, parts: 2 },
  fileFilter: (_req, archivo, callback) => {
    const mimeValido = archivo.fieldname === 'xml'
      ? ['application/xml', 'text/xml'].includes(archivo.mimetype)
      : archivo.fieldname === 'pdf' && archivo.mimetype === 'application/pdf';
    if (!mimeValido) callback(new Error('MIME_INVALIDO'));
    else callback(null, true);
  }
}).fields([{ name: 'xml', maxCount: 1 }, { name: 'pdf', maxCount: 1 }]);

function statusError(error: unknown): { status: number; code: string } {
  const multerError = error instanceof multer.MulterError ? error : null;
  if (multerError?.code === 'LIMIT_FILE_SIZE') return { status: 413, code: 'ARCHIVO_DEMASIADO_GRANDE' };
  if (multerError) return { status: 400, code: 'MULTIPART_INVALIDO' };
  return { status: 400, code: 'MIME_INVALIDO' };
}

export const recibirArchivosIntegracion: RequestHandler = (req, res, next) => {
  recibir(req, res, (error) => {
    if (!error) return next();
    const { status, code } = statusError(error);
    void marcarErrorRecepcion(res.locals, code, status).then((ownership) => {
      const leaseLost = ownership === 'LEASE_PERDIDO';
      res.status(leaseLost ? 409 : status).json({ ok: false, code: leaseLost ? 'LEASE_PERDIDO' : code });
    });
  });
};
