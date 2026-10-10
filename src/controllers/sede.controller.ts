import type { RequestHandler } from 'express';
import { crearClientePublicoSupabase } from '../config/supabase';
import { listarSedesPublicas } from '../services/sede.service';
import type { FabricaClientePublicoSedes } from '../types/sede.types';

export function crearObtenerSedesPublicas(
  crearCliente: FabricaClientePublicoSedes = crearClientePublicoSupabase
): RequestHandler {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (Object.keys(req.query).length > 0) {
      res.status(400).json({ ok: false, message: 'La consulta pública de sedes no admite parámetros' });
      return;
    }
    try {
      const data = await listarSedesPublicas(crearCliente());
      res.json({ ok: true, data });
    } catch {
      // Nunca propagar message/details/hint ni el error crudo de Supabase.
      res.status(500).json({ ok: false, message: 'Error al consultar las sedes' });
    }
  };
}
