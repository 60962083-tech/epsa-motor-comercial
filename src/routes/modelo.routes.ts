import { Router } from 'express';
import { crearObtenerModelos } from '../controllers/modelo.controller';
import type { FabricaClientePublico } from '../types/modelo.types';

export function crearRutasModelo(fabrica?: FabricaClientePublico) {
  const router = Router();
  router.get('/', crearObtenerModelos(fabrica));
  return router;
}
