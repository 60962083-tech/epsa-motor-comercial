import { Router } from 'express';
import { autenticar, exigirGestion } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { consultarComprasPendientes } from '../controllers/compras.pendientes.controller';

export function crearRutasComprasPendientes(fabrica?: FabricaCliente) {
  const router = Router();
  router.get('/', autenticar(fabrica), exigirGestion, consultarComprasPendientes);
  return router;
}
