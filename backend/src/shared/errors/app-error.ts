/**
 * Error de aplicación con el formato común de la API: { "codigo", "mensaje" }.
 * Los servicios lanzan AppError cuando una regla de negocio no se cumple;
 * el manejador central de errores lo convierte en la respuesta HTTP.
 *
 *   throw new AppError(409, 'PLACA_DUPLICADA', 'La placa TKM482 ya está registrada.');
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
    this.name = 'AppError';
  }
}

/** Cuerpo de toda respuesta de error de la API. */
export interface RespuestaError {
  codigo: string;
  mensaje: string;
}
