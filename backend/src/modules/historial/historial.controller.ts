import type { Request, Response } from 'express';
import { usuarioDeSesion } from '../../shared/middlewares/autenticar';
import type { FiltrosHistorial } from './historial.schemas';
import * as historialService from './historial.service';

/** El conductor se toma siempre de la sesión, nunca de un dato enviado por el cliente. */
export async function misViajes(req: Request, res: Response): Promise<void> {
  res.json(await historialService.listar(usuarioDeSesion(req).id, req.query as unknown as FiltrosHistorial));
}

export async function miViaje(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await historialService.detalle(usuarioDeSesion(req).id, req.params.id));
}
