import { Router } from 'express';

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

  router.get('/', listarPendientes);
  router.get('/:id', obtenerCompra);
  router.post('/', exigirGestion, registrarCompra);

  return router;
}