import { Router } from 'express';
import { autenticar, exigirRoles } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { registrarLeadManual } from '../controllers/lead.controller';
import { asignarResponsableLead, listarLeadsGestion, listarResponsablesLead } from '../controllers/lead.asignacion.controller';

export function crearRutasLead(fabrica?: FabricaCliente) {
  const router = Router();
  // Las rutas estáticas se registran antes que cualquier ruta con parámetros.
  router.get('/', autenticar(fabrica), exigirRoles('Gerente', 'Administradora', 'Vendedor'), listarLeadsGestion);
  router.get('/responsables', autenticar(fabrica), exigirRoles('Gerente', 'Administradora'), listarResponsablesLead);
  router.patch('/:codlea/responsable', autenticar(fabrica), exigirRoles('Gerente', 'Administradora'), asignarResponsableLead);
  router.post('/', autenticar(fabrica), exigirRoles('Gerente', 'Administradora', 'Vendedor'), registrarLeadManual);
  return router;
}
