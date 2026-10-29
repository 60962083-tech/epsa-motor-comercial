import type { RequestHandler } from 'express';
import * as servicio from '../services/compras.pendientes.service';
import { validarConsultaComprasPendientes } from '../utils/compras.pendientes.validacion';
import { responderErrorComprasPendientes } from '../utils/compras.pendientes.errores';

export const consultarComprasPendientes: RequestHandler = async (req, res) => {
  try {
    const filtros = validarConsultaComprasPendientes(req.query);
    const data = await servicio.consultarComprasPendientes(res.locals.db, filtros);
    res.status(200).json({ ok: true, data });
  } catch (error) {
    responderErrorComprasPendientes(res, error);
  }
};
