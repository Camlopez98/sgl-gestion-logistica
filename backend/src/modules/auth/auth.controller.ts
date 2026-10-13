import type { Request, Response } from 'express';
import { usuarioDeSesion } from '../../shared/middlewares/autenticar';
import type { DatosLogin } from './auth.schemas';
import * as authService from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  const respuesta = await authService.iniciarSesion(req.body as DatosLogin, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(respuesta);
}

export function me(req: Request, res: Response): void {
  res.json(usuarioDeSesion(req));
}

/** El token es sin estado: el cliente lo descarta. Se mantiene el endpoint para el contrato de la API. */
export function logout(_req: Request, res: Response): void {
  res.status(204).end();
}
