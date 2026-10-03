import express, { ErrorRequestHandler } from 'express';
import cors from 'cors';
import { crearRutasUbicacion } from './routes/ubicacion.routes';
import { FabricaCliente } from './middleware/autenticacion';
export function crearApp(fabrica?: FabricaCliente) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '32kb' }));
  app.get('/', (_req, res) => { res.json({ message: 'API EPSA Motor funcionando' }); });
  app.use('/api/ubicaciones', crearRutasUbicacion(fabrica));
  const errores: ErrorRequestHandler = (err, _req, res, _next) => {
    const status = err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({ ok: false, message: status === 400 ? 'JSON no válido' : status === 413 ? 'Solicitud demasiado grande' : 'Error interno' });
  };
  app.use(errores);
  return app;
}

