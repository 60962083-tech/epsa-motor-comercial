import type { RequestHandler } from 'express';
import * as servicio from '../services/inventario.service';
import { validarConsultaInventario } from '../utils/inventario.validacion';
import { responderErrorInventario } from '../utils/inventario.errores';

export const consultarInventario: RequestHandler = async (req, res) => {
  try {
    const filtros = validarConsultaInventario(req.query);
    const data = await servicio.consultarInventario(res.locals.db, filtros);
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorInventario(res, error);
  }
};
