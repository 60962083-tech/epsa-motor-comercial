import type { RequestHandler } from 'express';
import { registrarLeadManual as registrar } from '../services/lead.service';
import { validarLeadManual } from '../utils/lead.validacion';
import { responderErrorLead } from '../utils/lead.errores';

export const registrarLeadManual: RequestHandler = async (req, res) => {
  try {
    // res.locals.usuario lo establece autenticar. La RPC resuelve el creador mediante auth.uid().
    // codusu del DTO es exclusivamente el responsable asignado, nunca el creador.
    const data = await registrar(res.locals.db, validarLeadManual(req.body));
    res.status(201).json({ ok: true, data, message: 'Lead registrado correctamente' });
  } catch (error) {
    responderErrorLead(res, error);
  }
};
