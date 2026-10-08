import type { RequestHandler } from 'express';
import * as servicio from '../services/techo.service';
import { validarActualizacionTecho, validarIdUnidad } from '../utils/techo.validacion';
import { responderErrorTecho } from '../utils/techo.errores';

export const consultarTiposTecho: RequestHandler = async (_req, res) => {
  try {
    res.json({ ok: true, data: await servicio.listarTiposTecho(res.locals.db) });
  } catch (error) { responderErrorTecho(res, error); }
};

export const consultarProveedoresTecho: RequestHandler = async (_req, res) => {
  try {
    res.json({ ok: true, data: await servicio.listarProveedoresTecho(res.locals.db) });
  } catch (error) { responderErrorTecho(res, error); }
};

export const consultarConfiguracionTecho: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.obtenerConfiguracionTecho(res.locals.db, validarIdUnidad(req.params.id));
    res.json({ ok: true, data });
  } catch (error) { responderErrorTecho(res, error); }
};

export const actualizarConfiguracionTecho: RequestHandler = async (req, res) => {
  try {
    const datos = validarActualizacionTecho(req.params.id, req.body);
    const data = await servicio.actualizarConfiguracionTecho(res.locals.db, datos);
    res.json({ ok: true, message: 'Configuración de techo actualizada; no indica instalación física', data });
  } catch (error) { responderErrorTecho(res, error); }
};
