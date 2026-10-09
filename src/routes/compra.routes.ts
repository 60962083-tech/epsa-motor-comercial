import { Router } from 'express';
import { recibirPdfFactura } from '../middleware/factura.archivo';
import { adjuntarPdfFactura, consultarPdfFactura, obtenerUrlPdfFactura } from '../controllers/factura.archivo.controller';

import {
  autenticar,
  exigirGestion,
  FabricaCliente
} from '../middleware/autenticacion';

import {
  listarPendientes,
  obtenerCompra,
  registrarCompra
} from '../controllers/compra.controller';

export function crearRutasCompra(fabrica?: FabricaCliente) {
  const router = Router();

  router.use(autenticar(fabrica));

  router.post('/:id/factura/archivo', exigirGestion, recibirPdfFactura, adjuntarPdfFactura);
  router.get('/:id/factura/archivo', exigirGestion, consultarPdfFactura);
  router.get('/:id/factura/archivo/url', exigirGestion, obtenerUrlPdfFactura);

  router.get('/', listarPendientes);
  router.get('/:id', obtenerCompra);
  router.post('/', exigirGestion, registrarCompra);

  return router;
}
