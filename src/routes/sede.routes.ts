import { Router } from 'express';
import { crearObtenerSedesPublicas } from '../controllers/sede.controller';
import type { FabricaClientePublicoSedes } from '../types/sede.types';

export function crearRutasSede(fabrica?: FabricaClientePublicoSedes) {
  const router = Router();
  // Es una proyección pública. No requiere autenticar ni admite rutas de escritura.
  router.get('/', crearObtenerSedesPublicas(fabrica));
  return router;
}
