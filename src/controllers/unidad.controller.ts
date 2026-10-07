import type { RequestHandler } from 'express';
import * as servicio from '../services/unidad.service';
import { validarConsultaUnidades, validarFactura, validarIdentificacion } from '../utils/unidad.validacion';
import { responderErrorUnidad } from '../utils/unidad.errores';

export const registrarFactura: RequestHandler = async (req, res) => {
  try {
    const datos = validarFactura(
      req.params.id,
      req.body
    );

    const data = await servicio.registrarFactura(
      res.locals.db,
      datos
    );

    res.json({
      ok: true,
      message: data.requiere_revision
        ? 'Factura registrada con discrepancia de cantidad; requiere revisión antes de identificar'
        : 'Metadatos de factura registrados; la carga del archivo está pendiente',
      data
    });
  } catch (error) {
    responderErrorUnidad(res, error);
  }
};

export const identificarUnidades: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.identificarUnidades(res.locals.db, validarIdentificacion(req.params.id, req.body));
    res.status(201).json({ ok: true, message: 'Lote identificado; no implica recepción ni disponibilidad', data });
  } catch (error) { responderErrorUnidad(res, error); }
};

export const consultarUnidades: RequestHandler = async (req, res) => {
  try {
    const data = await servicio.consultarUnidades(res.locals.db, validarConsultaUnidades(req.params.id));
    res.json({ ok: true, data });
  } catch (error) { responderErrorUnidad(res, error); }
};

