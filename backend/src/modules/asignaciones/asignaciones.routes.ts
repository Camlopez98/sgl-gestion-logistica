import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/autenticar';
import { autorizar } from '../../shared/middlewares/autorizar';
import { idempotente } from '../../shared/middlewares/idempotente';
import { validar } from '../../shared/middlewares/validar';
import * as asignacionesController from './asignaciones.controller';
import {
  esquemaActivar,
  esquemaFiltrosAsignaciones,
  esquemaFinalizar,
  esquemaHabilitar,
} from './asignaciones.schemas';

/** HU-04: solo el Administrador gestiona asignaciones; el servidor valida el rol en cada petición (RS-04). */
export const asignacionesRoutes = Router();

asignacionesRoutes.use(autenticar, autorizar('ADMINISTRADOR'));

asignacionesRoutes.post('/', idempotente(), validar({ body: esquemaHabilitar }), asignacionesController.habilitar);
asignacionesRoutes.get('/', validar({ query: esquemaFiltrosAsignaciones }), asignacionesController.listar);
asignacionesRoutes.get('/conductores', asignacionesController.conductoresActivos);
asignacionesRoutes.patch('/:id/activar', validar({ body: esquemaActivar }), asignacionesController.activar);
asignacionesRoutes.patch('/:id/finalizar', validar({ body: esquemaFinalizar }), asignacionesController.finalizar);

/** GET /api/vehiculos/:id/asignaciones: historial del vehículo (CA 6). */
export const historialVehiculoRoutes = Router({ mergeParams: true });

historialVehiculoRoutes.get('/', autenticar, autorizar('ADMINISTRADOR'), asignacionesController.historialDeVehiculo);

/** GET /api/conductores/me/vehiculo-activo: selector del conductor (CA 13 y 14). */
export const vehiculoActivoRoutes = Router();

vehiculoActivoRoutes.get('/', autenticar, autorizar('CONDUCTOR'), asignacionesController.vehiculoActivoDelConductor);
