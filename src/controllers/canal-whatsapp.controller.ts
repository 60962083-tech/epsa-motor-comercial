import type { RequestHandler } from 'express';
import * as servicio from '../services/canal-whatsapp.service';
import { responderError } from '../utils/errores';
import { validarCambiosCanalWhatsapp, validarIdCanalWhatsapp } from '../utils/canal-whatsapp.validacion';

export const actualizarCanalWhatsapp: RequestHandler = async (req, res) => {
  try {
    const codcwa = validarIdCanalWhatsapp(req.params.id);
    const cambios = validarCambiosCanalWhatsapp(req.body);
    const data = await servicio.actualizarCanalWhatsapp(res.locals.db, codcwa, cambios);
    res.json({ ok: true, message: 'Canal WhatsApp actualizado correctamente', data });
  } catch (error) {
    responderError(res, error, {
      '23505': [409, 'Ya existe un canal WhatsApp con ese número'],
      PT404: [404, 'El canal WhatsApp no existe']
    }, 'Error interno al procesar el canal WhatsApp');
  }
};
