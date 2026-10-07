export const ROLES_USUARIO = ['Gerente', 'Administradora', 'Vendedor'] as const;
export type RolUsuario = typeof ROLES_USUARIO[number];

export interface UsuarioAutenticado {
  codusu: string;
  uuidusu: string;
  rol: RolUsuario;
}
