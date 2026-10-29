import { Router } from 'express';
import { recibirFacturaIntegracion } from '../controllers/integracion.facturas.controller.js';
import { autenticarYReservarIntegracion } from '../middleware/integracion.hmac.js';
import type { FabricaClienteIntegracion } from '../middleware/integracion.hmac.js';
import { recibirArchivosIntegracion } from '../middleware/integracion.archivos.js';

export function crearRutasIntegracionFacturas(fabrica?: FabricaClienteIntegracion) {
  const router = Router();
  router.post('/', autenticarYReservarIntegracion(fabrica), recibirArchivosIntegracion, recibirFacturaIntegracion);
  return router;
}
