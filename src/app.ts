import express from 'express';
import cors from 'cors';

import type { ErrorRequestHandler } from 'express';
import type { FabricaCliente } from './middleware/autenticacion';

import { crearRutasUbicacion } from './routes/ubicacion.routes';
import { crearRutasCompra } from './routes/compra.routes';
import { crearRutasUnidad } from './routes/unidad.routes';

export function crearApp(fabrica?: FabricaCliente) {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/', (_req, res) => {
    res.json({
      message: 'API EPSA Motor funcionando'
    });
  });

  app.use(
    '/api/ubicaciones',
    crearRutasUbicacion(fabrica)
  );

  app.use(
    '/api/compras',
    crearRutasUnidad(fabrica)
  );

  app.use(
    '/api/compras',
    crearRutasCompra(fabrica)
  );

  const errores: ErrorRequestHandler = (
    err,
    _req,
    res,
    _next
  ) => {
    let status = 500;
    let message = 'Error interno';

    if (err.type === 'entity.parse.failed') {
      status = 400;
      message = 'JSON no válido';
    } else if (err.type === 'entity.too.large') {
      status = 413;
      message = 'Solicitud demasiado grande';
    }

    res.status(status).json({
      ok: false,
      message
    });
  };

  app.use(errores);

  return app;
}
