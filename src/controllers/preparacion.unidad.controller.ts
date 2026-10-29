import type { RequestHandler } from 'express';
import * as servicio from '../services/preparacion.unidad.service';
import {
  obtenerClaveIdempotencia,
  validarActualizarPreparacionUnidad,
  validarIdPreparacionUnidad
} from '../utils/preparacion.unidad.validacion';
import { responderErrorPreparacionUnidad } from '../utils/preparacion.unidad.errores';

export const consultarPreparacionUnidad: RequestHandler = async (req, res) => {
  try {
    const coduni = validarIdPreparacionUnidad(req.params.coduni);
    const data = await servicio.consultarPreparacionUnidad(res.locals.db, coduni);
    res.json({ ok: true, data });
  } catch (error) { responderErrorPreparacionUnidad(res, error); }
};

export const actualizarPreparacionUnidad: RequestHandler = async (req, res) => {
  try {
    const claveIdempotencia = obtenerClaveIdempotencia(req.rawHeaders);
    const datos = validarActualizarPreparacionUnidad(req.params.coduni, req.body, claveIdempotencia);
    const data = await servicio.actualizarPreparacionUnidad(res.locals.db, datos);
    res.json({ ok: true, data });
  } catch (error) { responderErrorPreparacionUnidad(res, error); }
};
