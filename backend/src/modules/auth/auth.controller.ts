import type { Request, Response } from 'express';
import type { DatosLogin } from './auth.schemas';
import * as authService from './auth.service';

export async function login(req: Request, res: Response): Promise<void> {
  const respuesta = await authService.iniciarSesion(req.body as DatosLogin, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
  res.json(respuesta);
}
