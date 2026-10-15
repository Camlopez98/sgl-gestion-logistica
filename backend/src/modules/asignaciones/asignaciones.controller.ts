import type { Request, Response } from 'express';
import { usuarioDeSesion } from '../../shared/middlewares/autenticar';
import * as asignacionesService from './asignaciones.service';
import type { DatosActivar, DatosFinalizar, DatosHabilitar, FiltrosAsignaciones } from './asignaciones.schemas';

export async function habilitar(req: Request, res: Response): Promise<void> {
  const asignacion = await asignacionesService.habilitar(req.body as DatosHabilitar);
  res.status(201).json(asignacion);
}

export async function activar(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await asignacionesService.activar(req.params.id, req.body as DatosActivar));
}

export async function finalizar(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await asignacionesService.finalizar(req.params.id, req.body as DatosFinalizar));
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await asignacionesService.listar(req.query as FiltrosAsignaciones));
}

export async function conductoresActivos(_req: Request, res: Response): Promise<void> {
  res.json(await asignacionesService.conductoresActivos());
}

export async function historialDeVehiculo(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await asignacionesService.historialDeVehiculo(req.params.id));
}

/** El conductor se toma siempre de la sesión, nunca de un dato enviado por el cliente. */
export async function vehiculoActivoDelConductor(req: Request, res: Response): Promise<void> {
  res.json(await asignacionesService.vehiculoActivoDelConductor(usuarioDeSesion(req).id));
}
