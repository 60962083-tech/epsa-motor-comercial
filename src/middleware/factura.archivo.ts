import type { RequestHandler } from 'express';
import multer from 'multer';
import { ErrorHttp } from '../utils/errores';
import { responderErrorCompra } from '../utils/compra.errores';

export const MAXIMO_PDF = 10 * 1024 * 1024;

const recibir = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAXIMO_PDF, files: 1, fields: 0, parts: 2 },
  fileFilter: (_req, archivo, callback) => {
    if (archivo.mimetype !== 'application/pdf') {
      callback(new ErrorHttp(400, 'El archivo debe ser application/pdf'));
    } else {
      callback(null, true);
    }
  }
}).single('archivo');

export const recibirPdfFactura: RequestHandler = (req, res, next) => {
  recibir(req, res, error => {
    if (error) {
      const mensaje = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 'El archivo no debe superar 10 MB'
        : 'Envía un único PDF en el campo archivo mediante multipart/form-data';
      responderErrorCompra(res, error instanceof ErrorHttp ? error : new ErrorHttp(400, mensaje));
      return;
    }
    next();
  });
};
