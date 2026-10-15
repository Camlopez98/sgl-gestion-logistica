import { Router } from 'express';
import { autenticar } from '../../shared/middlewares/autenticar';
import { autorizar } from '../../shared/middlewares/autorizar';
import { idempotente } from '../../shared/middlewares/idempotente';
import { validar } from '../../shared/middlewares/validar';
import * as vehiculosController from './vehiculos.controller';
import { esquemaFiltrosVehiculos, esquemaVehiculo } from './vehiculos.schemas';

/** HU-03: solo el Administrador gestiona vehículos; el servidor valida el rol en cada petición (RS-04). */
export const vehiculosRoutes = Router();

vehiculosRoutes.use(autenticar, autorizar('ADMINISTRADOR'));

vehiculosRoutes.post('/', idempotente(), validar({ body: esquemaVehiculo }), vehiculosController.registrar);
vehiculosRoutes.get('/', validar({ query: esquemaFiltrosVehiculos }), vehiculosController.listar);
vehiculosRoutes.get('/:id', vehiculosController.obtener);
vehiculosRoutes.put('/:id', validar({ body: esquemaVehiculo }), vehiculosController.editar);
vehiculosRoutes.patch('/:id/desactivar', vehiculosController.desactivar);
