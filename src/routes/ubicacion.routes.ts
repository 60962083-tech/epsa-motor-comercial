import { Router } from 'express';
import { actualizarEstadoUbicacion, editarUbicacion, obtenerUbicaciones, registrarUbicacion } from '../controllers/ubicacion.controller';
import { autenticar, exigirGestion, FabricaCliente } from '../middleware/autenticacion';
export function crearRutasUbicacion(fabrica?: FabricaCliente) {
  const router = Router();
  router.use(autenticar(fabrica));
  router.get('/', obtenerUbicaciones);
  router.post('/', exigirGestion, registrarUbicacion);
  router.put('/:id', exigirGestion, editarUbicacion);
  router.patch('/:id/estado', exigirGestion, actualizarEstadoUbicacion);
  return router;
}

