import type { RequestHandler } from 'express';
import type { RespuestaError } from '../errors/app-error';

/** Respuesta común para rutas inexistentes. */
export const noEncontrado: RequestHandler = (req, res) => {
  const cuerpo: RespuestaError = {
    codigo: 'RECURSO_NO_ENCONTRADO',
    mensaje: `No existe la ruta ${req.method} ${req.originalUrl}.`,
  };
  res.status(404).json(cuerpo);
};
