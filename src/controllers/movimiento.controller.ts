import type { RequestHandler } from 'express';
import * as servicio from '../services/movimiento.service';
import {
  validarCuerpoRecepcion, validarConsultaMovimientos, validarInicioMovimiento,
  validarRecepcionMovimiento
} from '../utils/movimiento.validacion';
import { responderErrorMovimiento } from '../utils/movimiento.errores';

export const iniciarMovimiento: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.iniciarMovimiento(
      res.locals.db,
      validarInicioMovimiento(req.params.coduni, req.body)
    );
    res.status(201).json({ ok: true, message: 'Movimiento iniciado; la unidad conserva su ubicación confirmada', data });
  } catch (error) { responderErrorMovimiento(res, error); }
};

export const confirmarRecepcion: RequestHandler = async (req, res) => {
  try {
    validarCuerpoRecepcion(req.body);
    const { p_coduni, p_codmub } = validarRecepcionMovimiento(req.params.coduni, req.params.codmub);
    const data = await servicio.confirmarRecepcion(res.locals.db, p_coduni, p_codmub);
    res.json({ ok: true, message: 'Recepción confirmada; la ubicación de la unidad fue actualizada', data });
  } catch (error) { responderErrorMovimiento(res, error); }
};

export const consultarMovimientos: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.consultarMovimientos(
      res.locals.db,
      validarConsultaMovimientos(req.params.coduni).p_coduni
    );
    res.json({ ok: true, data });
  } catch (error) { responderErrorMovimiento(res, error); }
};
