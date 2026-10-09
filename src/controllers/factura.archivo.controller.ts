import type { RequestHandler } from 'express';
import * as servicio from '../services/factura.archivo.service';
import { validarIdCompra } from '../utils/compra.validacion';
import { responderErrorCompra } from '../utils/compra.errores';
import { ErrorHttp } from '../utils/errores';

export const adjuntarPdfFactura: RequestHandler = async (req, res) => {
  try {
    const codcom = validarIdCompra(req.params.id);
    if (!req.file) throw new ErrorHttp(400, 'Envía un archivo PDF en el campo archivo');
    const data = await servicio.adjuntarPdfFactura(res.locals.db, codcom, req.file.buffer);
    res.status(201).json({ ok: true, data, message: 'PDF de factura adjuntado correctamente' });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};

export const consultarPdfFactura: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.consultarPdfFactura(res.locals.db, validarIdCompra(req.params.id));
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};

export const obtenerUrlPdfFactura: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.obtenerUrlPdfFactura(res.locals.db, validarIdCompra(req.params.id));
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};
