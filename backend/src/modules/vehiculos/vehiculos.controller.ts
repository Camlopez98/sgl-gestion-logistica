import type { Request, Response } from 'express';
import type { DatosVehiculo, FiltrosVehiculos } from './vehiculos.schemas';
import * as vehiculosService from './vehiculos.service';

export async function registrar(req: Request, res: Response): Promise<void> {
  const vehiculo = await vehiculosService.registrar(req.body as DatosVehiculo);
  res.status(201).json(vehiculo);
}

export async function listar(req: Request, res: Response): Promise<void> {
  res.json(await vehiculosService.listar(req.query as FiltrosVehiculos));
}

export async function obtener(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.json(await vehiculosService.obtener(req.params.id));
}
