import { Router } from 'express';
import { actualizarCanalWhatsapp } from '../controllers/canal-whatsapp.controller';
import { autenticar, exigirGestion } from '../middleware/autenticacion';
import type { FabricaCliente } from '../middleware/autenticacion';

export function crearRutasCanalWhatsapp(fabrica?: FabricaCliente) {
  const router = Router();
  router.put('/:id', autenticar(fabrica), exigirGestion, actualizarCanalWhatsapp);
  return router;
}
