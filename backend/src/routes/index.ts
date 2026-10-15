import { Router } from 'express';
import { asignacionesRoutes, historialVehiculoRoutes, vehiculoActivoRoutes } from '../modules/asignaciones/asignaciones.routes';
import { authRoutes } from '../modules/auth/auth.routes';
import { vehiculosRoutes } from '../modules/vehiculos/vehiculos.routes';

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
apiRouter.use('/auth', authRoutes);
apiRouter.use('/vehiculos', vehiculosRoutes);
apiRouter.use('/asignaciones', asignacionesRoutes);
apiRouter.use('/vehiculos/:id/asignaciones', historialVehiculoRoutes);
apiRouter.use('/conductores/me/vehiculo-activo', vehiculoActivoRoutes);
