import { RequestHandler } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteSupabase } from '../config/supabase';
import { responderError } from '../utils/errores';
export type FabricaCliente = (token: string) => SupabaseClient;
export function autenticar(crearCliente: FabricaCliente = crearClienteSupabase): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) return void res.status(401).json({ ok: false, message: 'Se requiere un token Bearer válido' });
    try {
      const db = crearCliente(match[1]);
      const { data, error } = await db.auth.getUser(match[1]);
      if (error || !data.user) return void res.status(401).json({ ok: false, message: 'Sesión inválida o vencida' });
      const { data: rol, error: errorRol } = await db.rpc('hu026_rol_actual');
      if (errorRol) throw errorRol;
      if (!['Gerente', 'Administradora', 'Vendedor'].includes(rol))
        return void res.status(403).json({ ok: false, message: 'Usuario o rol no autorizado o inactivo' });
      res.locals.db = db;
      res.locals.rol = rol;
      next();
    } catch (error) { responderError(res, error); }
  };
}
export const exigirGestion: RequestHandler = (_req, res, next) => {
  if (!['Gerente', 'Administradora'].includes(res.locals.rol))
    return void res.status(403).json({ ok: false, message: 'Solo gerente y administradora pueden realizar esta operación de gestión' });
  next();
};

