import type { RequestHandler } from 'express';
import { crearClientePublicoSupabase } from '../config/supabase';
import { listarModelosPublicados } from '../services/modelo.service';
import type { FabricaClientePublico } from '../types/modelo.types';

export function crearObtenerModelos(crearCliente: FabricaClientePublico = crearClientePublicoSupabase): RequestHandler {
  return async (req, res) => {
    // No hay filtros públicos en EMT-72, incluidos estado, select y expansiones.
    if (Object.keys(req.query).length > 0) {
      res.status(400).json({ ok: false, message: 'La consulta pública de modelos no admite parámetros' });
      return;
    }
    try {
      const data = await listarModelosPublicados(crearCliente());
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, data });
    } catch {
      res.status(500).json({ ok: false, message: 'Error al consultar el catálogo de modelos' });
    }
  };
}
