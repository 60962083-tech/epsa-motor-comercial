import { RequestHandler } from 'express';

import * as servicio from '../services/compra.service';
import { responderErrorCompra } from '../utils/compra.errores';
import {
  validarCompra,
  validarIdCompra,
  validarPaginacion
} from '../utils/compra.validacion';

export const registrarCompra: RequestHandler = async (req, res) => {
  try {
    const datos = validarCompra(
      req.body,
      req.get('Idempotency-Key')
    );

    const resultado = await servicio.registrarCompra(
      res.locals.db,
      datos
    );

    res.status(resultado.creada ? 201 : 200).json({
      ok: true,
      message: resultado.creada
        ? 'Compra pendiente registrada; no representa unidades disponibles para entrega'
        : 'Este intento ya fue registrado',
      data: resultado.compra
    });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};

export const listarPendientes: RequestHandler = async (req, res) => {
  try {
    const paginacion = validarPaginacion(req.query);

    const data = await servicio.listarComprasPendientes(
      res.locals.db,
      paginacion
    );

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};

export const obtenerCompra: RequestHandler = async (req, res) => {
  try {
    const codcom = validarIdCompra(
      req.params.id
    );

    const data = await servicio.obtenerCompra(
      res.locals.db,
      codcom
    );

    res.json({
      ok: true,
      data
    });
  } catch (error) {
    responderErrorCompra(res, error);
  }
};