import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes';
import { ENCABEZADO_TOKEN_RENOVADO } from './shared/middlewares/autenticar';
import { manejadorErrores } from './shared/middlewares/manejador-errores';
import { noEncontrado } from './shared/middlewares/no-encontrado';

export function crearApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((origen) => origen.trim()),
      // Permite que el frontend lea el token renovado de la sesión deslizante.
      exposedHeaders: [ENCABEZADO_TOKEN_RENOVADO],
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Las respuestas de la API no se guardan en caché del navegador (contenido protegido).
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', apiRouter);

  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}
