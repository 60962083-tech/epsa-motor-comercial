import { RequestHandler } from 'express';
import * as servicio from '../services/ubicacion.service';
import { ErrorHttp, responderError } from '../utils/errores';
import { validarId, validarUbicacion } from '../utils/validacion';
export const obtenerUbicacion: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.obtenerUbicacion(res.locals.db, validarId(req.params.id));
    res.json({ ok: true, data });
  } catch (error) { responderError(res, error); }
};
export const obtenerUbicaciones: RequestHandler = async (req, res) => {
  try {
    const estado = req.query.activo;
    if (estado !== undefined && estado !== 'true' && estado !== 'false') throw new ErrorHttp(400, 'El filtro activo debe ser true o false');
    const data = await servicio.listarUbicaciones(res.locals.db, estado === undefined ? undefined : estado === 'true');
    res.json({ ok: true, data });
  } catch (error) { responderError(res, error); }
};
export const registrarUbicacion: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.crearUbicacion(res.locals.db, validarUbicacion(req.body));
    res.status(201).json({ ok: true, message: 'Ubicación registrada correctamente', data });
  } catch (error) { responderError(res, error); }
};
export const editarUbicacion: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.actualizarUbicacion(res.locals.db, validarId(req.params.id), validarUbicacion(req.body));
    res.json({ ok: true, message: 'Ubicación actualizada correctamente', data });
  } catch (error) { responderError(res, error); }
};
export const actualizarEstadoUbicacion: RequestHandler = async (req, res) => {
  try {
    const id = validarId(req.params.id);
    if (typeof req.body?.estubi !== 'boolean') throw new ErrorHttp(400, 'El estado debe ser true o false');
    const data = await servicio.cambiarEstadoUbicacion(res.locals.db, id, req.body.estubi);
    res.json({ ok: true, message: req.body.estubi ? 'Ubicación activada correctamente' : 'Ubicación desactivada correctamente', data });
  } catch (error) { responderError(res, error); }
};

