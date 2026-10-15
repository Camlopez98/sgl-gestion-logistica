import type { RequestHandler } from 'express';
import { AppError } from '../errors/app-error';
import type { Rol } from '../types/rol';

/**
 * Permite el acceso solo a los roles indicados (RBAC, RS-04). Debe ir después de autenticar.
 *
 *   router.post('/', autenticar, autorizar('ADMINISTRADOR'), controlador.crear);
 */
export function autorizar(...rolesPermitidos: Rol[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) {
      throw new AppError(401, 'TOKEN_AUSENTE', 'Debe iniciar sesión para acceder a este recurso.');
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      throw new AppError(403, 'ACCESO_DENEGADO', 'No tiene permisos para realizar esta acción.');
    }
    next();
  };
}
