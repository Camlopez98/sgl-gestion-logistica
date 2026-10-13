import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';

export const MENSAJE_SIN_INTERNET = 'No hay conexión a internet. Verifique su conexión e inténtelo de nuevo.';
export const MENSAJE_SERVIDOR_NO_RESPONDE = 'El servidor no responde. Inténtelo de nuevo en unos momentos.';
export const MENSAJE_ERROR_SERVIDOR = 'El servidor presentó un error. Inténtelo de nuevo en unos momentos.';
const MENSAJE_INESPERADO = 'Ocurrió un error inesperado. Inténtelo de nuevo.';

/**
 * Convierte un error de una petición en un mensaje para el usuario:
 * sin internet, servidor que no responde, error del servidor (5xx)
 * o el mensaje del formato común del backend { codigo, mensaje }.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof TimeoutError) {
    return MENSAJE_SERVIDOR_NO_RESPONDE;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return MENSAJE_INESPERADO;
  }
  if (error.status === 0) {
    return navigator.onLine === false ? MENSAJE_SIN_INTERNET : MENSAJE_SERVIDOR_NO_RESPONDE;
  }
  if (error.status >= 500) {
    return MENSAJE_ERROR_SERVIDOR;
  }
  const mensaje = (error.error as { mensaje?: unknown } | null)?.mensaje;
  return typeof mensaje === 'string' ? mensaje : MENSAJE_INESPERADO;
}

/** Código del formato común del backend, si la respuesta lo trae. */
export function codigoDeError(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const codigo = (error.error as { codigo?: unknown } | null)?.codigo;
  return typeof codigo === 'string' ? codigo : null;
}
