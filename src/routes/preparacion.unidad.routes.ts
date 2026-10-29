import { Router } from 'express';
import { autenticar, exigirGestion, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { actualizarPreparacionUnidad, consultarPreparacionUnidad } from '../controllers/preparacion.unidad.controller';

const ROLES_CONSULTA_PREPARACION = ['Gerente', 'Administradora', 'Vendedor'] as const;

export function crearRutasPreparacionUnidad(fabrica?: FabricaCliente) {
  const router = Router();
  router.get('/:coduni/preparacion', autenticar(fabrica), exigirRoles(...ROLES_CONSULTA_PREPARACION), consultarPreparacionUnidad);
  router.patch('/:coduni/preparacion', autenticar(fabrica), exigirGestion, actualizarPreparacionUnidad);
  return router;
}
