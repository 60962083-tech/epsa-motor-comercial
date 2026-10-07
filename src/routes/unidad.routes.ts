import { Router } from 'express';
import { autenticar, exigirGestion } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import { consultarUnidades, identificarUnidades, registrarFactura } from '../controllers/unidad.controller';

export function crearRutasUnidad(fabrica?: FabricaCliente) {
  const router = Router();
  // Middleware por ruta: las otras rutas de compras conservan su autorización actual.
  router.get('/:id/unidades', autenticar(fabrica), exigirGestion, consultarUnidades);
  router.post('/:id/unidades', autenticar(fabrica), exigirGestion, identificarUnidades);
  router.put('/:id/factura', autenticar(fabrica), exigirGestion, registrarFactura);
  return router;
}

