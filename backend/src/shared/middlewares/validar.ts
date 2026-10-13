import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

interface Esquemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Valida y normaliza body, query o params con zod antes de llegar al controlador.
 * Si los datos no cumplen el esquema, el manejador de errores responde 422 DATOS_INVALIDOS.
 *
 *   router.post('/', validar({ body: esquemaCrearVehiculo }), controlador.crear);
 */
export function validar(esquemas: Esquemas): RequestHandler {
  return (req, _res, next) => {
    if (esquemas.body) {
      req.body = esquemas.body.parse(req.body ?? {});
    }
    if (esquemas.params) {
      req.params = esquemas.params.parse(req.params) as typeof req.params;
    }
    if (esquemas.query) {
      // En Express 5 req.query es de solo lectura; se redefine con el valor validado.
      Object.defineProperty(req, 'query', { value: esquemas.query.parse(req.query), writable: true });
    }
    next();
  };
}
