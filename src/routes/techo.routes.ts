import { Router } from 'express';
import { actualizarConfiguracionTecho, consultarConfiguracionTecho, consultarProveedoresTecho, consultarTiposTecho } from '../controllers/techo.controller';
import { autenticar, exigirGestion, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';

const ROLES_CONSULTA = ['Gerente', 'Administradora', 'Vendedor'] as const;

export function crearRutasTecho(fabrica?: FabricaCliente) {
  const router = Router();
  router.get('/catalogos/tipos-techo', autenticar(fabrica), exigirRoles(...ROLES_CONSULTA), consultarTiposTecho);
  router.get('/catalogos/proveedores-techo', autenticar(fabrica), exigirRoles(...ROLES_CONSULTA), consultarProveedoresTecho);
  router.get('/:id/techo', autenticar(fabrica), exigirRoles(...ROLES_CONSULTA), consultarConfiguracionTecho);
  router.put('/:id/techo', autenticar(fabrica), exigirGestion, actualizarConfiguracionTecho);
  return router;
}
