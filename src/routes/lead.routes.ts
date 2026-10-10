import { Router } from 'express';
import { autenticar, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { registrarLeadManual } from '../controllers/lead.controller';

export function crearRutasLead(fabrica?: FabricaCliente) {
  const router = Router();
  router.post('/', autenticar(fabrica), exigirRoles('Gerente', 'Administradora', 'Vendedor'), registrarLeadManual);
  return router;
}
