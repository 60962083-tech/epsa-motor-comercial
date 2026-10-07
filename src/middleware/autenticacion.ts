import type { RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearClienteSupabase } from '../config/supabase';
import { ROLES_USUARIO } from '../types/autenticacion.types';
import type { RolUsuario, UsuarioAutenticado } from '../types/autenticacion.types';

export type FabricaCliente = (token: string) => SupabaseClient;

function esUsuarioAutenticado(valor: unknown): valor is UsuarioAutenticado {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return false;
  const usuario = valor as Partial<UsuarioAutenticado>;
  return typeof usuario.codusu === 'string' && /^[1-9]\d*$/.test(usuario.codusu)
    && BigInt(usuario.codusu) <= 9223372036854775807n
    && typeof usuario.uuidusu === 'string' && usuario.uuidusu.length > 0
    && ROLES_USUARIO.includes(usuario.rol as RolUsuario);
}

export function autenticar(crearCliente: FabricaCliente = crearClienteSupabase): RequestHandler {
  return async (req, res, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? '');
    if (!match) return void res.status(401).json({ ok: false, message: 'Se requiere un token Bearer válido' });
    try {
      const db = crearCliente(match[1]);
      const { data, error } = await db.auth.getUser(match[1]);
      if (error || !data.user) return void res.status(401).json({ ok: false, message: 'Sesión inválida o vencida' });
      // Sin parámetros de identidad: la BD resuelve usuario y rol mediante auth.uid().
      const { data: usuario, error: errorUsuario } = await db.rpc('hu007_usuario_actual');
      if (errorUsuario) throw errorUsuario;
      if (!esUsuarioAutenticado(usuario) || usuario.uuidusu !== data.user.id)
        return void res.status(403).json({ ok: false, message: 'Usuario o rol no autorizado o inactivo' });
      res.locals.db = db;
      res.locals.usuario = { codusu: usuario.codusu, uuidusu: usuario.uuidusu, rol: usuario.rol } satisfies UsuarioAutenticado;
      res.locals.rol = usuario.rol; // Compatibilidad con rutas existentes.
      next();
    } catch {
      // Un fallo del servicio de identidad nunca concede acceso ni revela errores SQL/tokens.
      res.status(500).json({ ok: false, message: 'Error al verificar la identidad del usuario' });
    }
  };
}

function autorizarRoles(rolesPermitidos: readonly RolUsuario[], mensaje: string): RequestHandler {
  return (_req, res, next) => {
    const usuario: unknown = res.locals.usuario;
    if (!esUsuarioAutenticado(usuario) || !rolesPermitidos.includes(usuario.rol))
      return void res.status(403).json({ ok: false, message: mensaje });
    next();
  };
}

export function exigirRoles(...rolesPermitidos: RolUsuario[]): RequestHandler {
  return autorizarRoles(rolesPermitidos, 'No tienes permisos para realizar esta operación');
}

export const exigirGestion = autorizarRoles(
  ['Gerente', 'Administradora'],
  'Solo gerente y administradora pueden realizar esta operación de gestión'
);