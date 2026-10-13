import { createHash } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { AppError } from '../errors/app-error';
import * as idempotenciaRepository from '../idempotencia/idempotencia.repository';

export const ENCABEZADO_IDEMPOTENCIA = 'Idempotency-Key';

/** Tiempo tras el cual una solicitud que quedó EN_PROCESO se considera abandonada. */
const SEGUNDOS_ABANDONO = 60;
const LONGITUD_MAXIMA_CLAVE = 100;

/**
 * Hace que un reintento de la misma solicitud devuelva el mismo resultado sin repetir la operación
 * (HU-03 escenarios 9 y 10; HU-04 escenario 17). El cliente envía una clave única por operación
 * en el encabezado Idempotency-Key y la reutiliza en cada reintento. Sin encabezado, no actúa.
 * Debe ir después de autenticar.
 *
 *   router.post('/', autenticar, autorizar('ADMINISTRADOR'), idempotente(), validar(...), controlador.crear);
 */
export function idempotente(): RequestHandler {
  return async (req, res, next) => {
    const clave = req.get(ENCABEZADO_IDEMPOTENCIA)?.trim();
    if (!clave) {
      next();
      return;
    }
    if (clave.length > LONGITUD_MAXIMA_CLAVE) {
      throw new AppError(422, 'DATOS_INVALIDOS', `${ENCABEZADO_IDEMPOTENCIA}: máximo ${LONGITUD_MAXIMA_CLAVE} caracteres.`);
    }
    if (!req.usuario) {
      throw new AppError(401, 'TOKEN_AUSENTE', 'Debe iniciar sesión para acceder a este recurso.');
    }

    const id = { usuarioId: req.usuario.id, clave };
    const solicitud = {
      ...id,
      metodo: req.method,
      ruta: req.originalUrl.split('?')[0],
      huellaCuerpo: createHash('sha256').update(JSON.stringify(req.body ?? null)).digest('hex'),
    };

    const reservada =
      (await idempotenciaRepository.reservar(solicitud)) ||
      (await resolverExistente(solicitud, res));
    if (!reservada) {
      return; // ya se respondió con el resultado guardado o con un error
    }

    capturarRespuesta(res, id);
    next();
  };
}

/**
 * La clave ya existía: repite la respuesta guardada, rechaza el uso con otros datos,
 * informa que sigue en proceso o retoma una solicitud abandonada.
 * Devuelve true solo si la solicitud debe procesarse.
 */
async function resolverExistente(
  solicitud: { usuarioId: string; clave: string; metodo: string; ruta: string; huellaCuerpo: string },
  res: Response,
): Promise<boolean> {
  const existente = await idempotenciaRepository.buscar(solicitud);
  if (!existente) {
    // Se liberó entre la reserva y la consulta: se intenta reservar de nuevo.
    return idempotenciaRepository.reservar(solicitud);
  }

  const mismaSolicitud =
    existente.metodo === solicitud.metodo &&
    existente.ruta === solicitud.ruta &&
    existente.huellaCuerpo === solicitud.huellaCuerpo;
  if (!mismaSolicitud) {
    throw new AppError(
      422,
      'CLAVE_IDEMPOTENCIA_REUTILIZADA',
      'La clave de la solicitud ya se usó con otros datos. Recargue el formulario e intente de nuevo.',
    );
  }

  if (existente.estado === 'COMPLETADA') {
    res.set('Idempotent-Replayed', 'true').status(existente.statusRespuesta ?? 200).json(existente.cuerpoRespuesta);
    return false;
  }

  if (existente.segundosDesdeInicio >= SEGUNDOS_ABANDONO && (await idempotenciaRepository.retomar(solicitud, SEGUNDOS_ABANDONO))) {
    return true;
  }

  throw new AppError(
    409,
    'SOLICITUD_EN_PROCESO',
    'La solicitud anterior todavía se está procesando. Intente de nuevo en unos segundos.',
  );
}

/**
 * Guarda la respuesta antes de enviarla. Las respuestas 5xx no se guardan:
 * se libera la clave para que el reintento se procese de nuevo.
 */
function capturarRespuesta(res: Response, id: { usuarioId: string; clave: string }): void {
  const jsonOriginal = res.json.bind(res);

  res.json = (cuerpo?: unknown) => {
    const status = res.statusCode;
    const guardar =
      status >= 500 ? idempotenciaRepository.liberar(id) : idempotenciaRepository.completar(id, status, cuerpo);

    guardar
      .catch((error) => console.error('No fue posible guardar la solicitud idempotente', error))
      .finally(() => jsonOriginal(cuerpo));
    return res;
  };
}
