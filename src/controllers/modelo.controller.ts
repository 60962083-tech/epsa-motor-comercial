import type { RequestHandler } from 'express';
import { crearClientePublicoSupabase } from '../config/supabase';
import { listarModeloPublicadoPorId, listarModelosPublicados } from '../services/modelo.service';
import { ErrorHttp } from '../utils/errores';
import type { FabricaClientePublico } from '../types/modelo.types';

const MAX_BIGINT = 9223372036854775807n;

function validarIdModelo(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor) || BigInt(valor) > MAX_BIGINT)
    throw new ErrorHttp(400, 'Identificador de modelo inválido');
  return valor;
}

function rechazarFiltros(req: import('express').Request, res: import('express').Response): boolean {
  if (Object.keys(req.query).length === 0) return false;
  res.status(400).json({ ok: false, message: 'La consulta pública de modelos no admite parámetros' });
  return true;
}

export function crearObtenerModelos(crearCliente: FabricaClientePublico = crearClientePublicoSupabase): RequestHandler {
  return async (req, res) => {
    if (rechazarFiltros(req, res)) return;
    try {
      const data = await listarModelosPublicados(crearCliente());
      res.set('Cache-Control', 'no-store');
      res.json({ ok: true, data });
    } catch {
      res.status(500).json({ ok: false, message: 'Error al consultar el catálogo de modelos' });
    }
  };
}

export function crearObtenerModeloPublicado(crearCliente: FabricaClientePublico = crearClientePublicoSupabase): RequestHandler {
  return async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      if (rechazarFiltros(req, res)) return;
      const codmod = validarIdModelo(req.params.id);
      const data = await listarModeloPublicadoPorId(crearCliente(), codmod);
      if (!data) {
        res.status(404).json({ ok: false, message: 'Modelo no disponible' });
        return;
      }
      res.json({ ok: true, data });
    } catch (error) {
      if (error instanceof ErrorHttp) {
        res.status(error.status).json({ ok: false, message: error.message });
        return;
      }
      res.status(500).json({ ok: false, message: 'Error interno al consultar el modelo' });
    }
  };
}
