import { Router } from 'express';

/**
 * Punto único de registro de los módulos de la API.
 * Cada módulo expone su propio Router desde src/modules/<modulo>/<modulo>.routes.ts
 * y se registra aquí con una sola línea, sin modificar los demás módulos.
 */
export const apiRouter = Router();

apiRouter.get('/salud', (_req, res) => {
  res.json({ estado: 'ok' });
});

// Registro de módulos (una línea por módulo):
// apiRouter.use('/auth', authRoutes);
