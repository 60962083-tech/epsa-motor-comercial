import { Router } from 'express';
import { crearObtenerModeloPublicado, crearObtenerModelos } from '../controllers/modelo.controller';
import type { FabricaClientePublico } from '../types/modelo.types';

export function crearRutasModelo(fabrica?: FabricaClientePublico) {
  const router = Router();
  router.get('/', crearObtenerModelos(fabrica));
  router.get('/:id', crearObtenerModeloPublicado(fabrica));
  return router;
}
