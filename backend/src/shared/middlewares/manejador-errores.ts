import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { env } from '../../config/env';
import { AppError, type RespuestaError } from '../errors/app-error';

const VIOLACION_UNIQUE_POSTGRES = '23505';

/** Traduce cualquier error lanzado en la API al formato común { codigo, mensaje }. */
export const manejadorErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  const { status, cuerpo } = traducir(error);

  if (status >= 500 && env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.status(status).json(cuerpo);
};

function traducir(error: unknown): { status: number; cuerpo: RespuestaError } {
  if (error instanceof AppError) {
    return { status: error.status, cuerpo: { codigo: error.codigo, mensaje: error.message } };
  }

  if (error instanceof ZodError) {
    const primero = error.issues[0];
    const campo = primero?.path.join('.');
    const mensaje = campo ? `${campo}: ${primero.message}` : (primero?.message ?? 'Datos inválidos.');
    return { status: 422, cuerpo: { codigo: 'DATOS_INVALIDOS', mensaje } };
  }

  if (esErrorDeJson(error)) {
    return { status: 400, cuerpo: { codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido.' } };
  }

  if (esErrorPostgres(error) && error.code === VIOLACION_UNIQUE_POSTGRES) {
    return { status: 409, cuerpo: { codigo: 'REGISTRO_DUPLICADO', mensaje: 'El registro ya existe.' } };
  }

  return { status: 500, cuerpo: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado. Intente de nuevo más tarde.' } };
}

function esErrorDeJson(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { type?: string }).type === 'entity.parse.failed';
}

function esErrorPostgres(error: unknown): error is { code: string } {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';
}
