import { Router } from 'express';
import { autenticar, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { consultarInventario } from '../controllers/inventario.controller';

export function crearRutasInventario(fabrica?: FabricaCliente) {
  const router = Router();
  router.get('/', autenticar(fabrica), exigirRoles('Gerente', 'Administradora', 'Vendedor'), consultarInventario);
  return router;
}
