import { Router } from 'express';
import { validar } from '../../shared/middlewares/validar';
import * as authController from './auth.controller';
import { esquemaLogin } from './auth.schemas';

export const authRoutes = Router();

authRoutes.post('/login', validar({ body: esquemaLogin }), authController.login);
