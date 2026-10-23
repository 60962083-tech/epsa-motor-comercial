import type { RequestHandler } from 'express';
import { asignarResponsableLead as asignar, listarLeadsGestion as listar, listarResponsablesLead as responsables } from '../services/lead.asignacion.service';
import { responderErrorAsignacionLead } from '../utils/lead.asignacion.errores';
import { validarAsignacionLead, validarPaginacionLeads } from '../utils/lead.asignacion.validacion';

export const listarLeadsGestion: RequestHandler = async (req, res) => {
  try {
    const data = await listar(res.locals.db, validarPaginacionLeads(req.query));
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorAsignacionLead(res, error);
  }
};

export const listarResponsablesLead: RequestHandler = async (_req, res) => {
  try {
    const data = await responsables(res.locals.db);
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorAsignacionLead(res, error);
  }
};

export const asignarResponsableLead: RequestHandler = async (req, res) => {
  try {
    const data = await asignar(res.locals.db, validarAsignacionLead(req.params.codlea, req.body));
    res.json({ ok: true, data });
  } catch (error) {
    responderErrorAsignacionLead(res, error);
  }
};
