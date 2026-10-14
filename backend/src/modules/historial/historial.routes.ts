import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/autenticar';
import { autorizar } from '../../shared/middlewares/autorizar';
import { validar } from '../../shared/middlewares/validar';
import * as historialController from './historial.controller';
import { esquemaFiltrosHistorial } from './historial.schemas';

/**
 * HU-05: historial de solo lectura del conductor, montado en /api/conductores/me/viajes.
 * No hay rutas de escritura. Las respuestas son personales: ningún intermediario ni el navegador deben guardarlas.
 */
export const historialRoutes = Router();

historialRoutes.use((_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});
historialRoutes.use(autenticar, autorizar('CONDUCTOR'));

historialRoutes.get('/', validar({ query: esquemaFiltrosHistorial }), historialController.misViajes);
historialRoutes.get('/:id', historialController.miViaje);
