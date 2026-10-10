import { Router } from 'express';
import { crearObtenerModeloPublicado, crearObtenerModelos } from '../controllers/modelo.controller';
import { crearObtenerModeloAdmin, crearActualizarModelo, crearCambiarEstadoModelo, crearListarModelosAdmin, crearAgregarImagenModelo, crearActualizarImagenModelo, crearCambiarEstadoImagenModelo } from '../controllers/modelo.admin.controller';
import { autenticar, exigirGestion } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';
import type { FabricaClientePublico } from '../types/modelo.types';

export function crearRutasModelo(fabricaPublica?: FabricaClientePublico, fabricaPrivada?: FabricaCliente) {
  const router = Router();
  router.get('/', crearObtenerModelos(fabricaPublica));
  // Esta ruta debe preceder a GET /:id para que "admin" no se interprete como un código.
  router.get('/admin', autenticar(fabricaPrivada), exigirGestion, crearListarModelosAdmin);
  router.post('/', autenticar(fabricaPrivada), exigirGestion, crearObtenerModeloAdmin);
  router.post('/:id/imagenes', autenticar(fabricaPrivada), exigirGestion, crearAgregarImagenModelo);
  router.put('/:id/imagenes/:codimo', autenticar(fabricaPrivada), exigirGestion, crearActualizarImagenModelo);
  router.patch('/:id/imagenes/:codimo/estado', autenticar(fabricaPrivada), exigirGestion, crearCambiarEstadoImagenModelo);
  router.put('/:id', autenticar(fabricaPrivada), exigirGestion, crearActualizarModelo);
  router.patch('/:id/estado', autenticar(fabricaPrivada), exigirGestion, crearCambiarEstadoModelo);
  router.get('/:id', crearObtenerModeloPublicado(fabricaPublica));
  return router;
}
