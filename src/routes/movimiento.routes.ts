import { Router } from 'express';
import { confirmarRecepcion, consultarMovimientos, iniciarMovimiento } from '../controllers/movimiento.controller';
import { autenticar, exigirGestion, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';

const ROLES_CONSULTA = ['Gerente', 'Administradora', 'Vendedor'] as const;

export function crearRutasMovimiento(fabrica?: FabricaCliente) {
  const router = Router();
  router.post('/:coduni/movimientos', autenticar(fabrica), exigirGestion, iniciarMovimiento);
  router.patch('/:coduni/movimientos/:codmub/recepcion', autenticar(fabrica), exigirGestion, confirmarRecepcion);
  router.get('/:coduni/movimientos', autenticar(fabrica), exigirRoles(...ROLES_CONSULTA), consultarMovimientos);
  return router;
}
