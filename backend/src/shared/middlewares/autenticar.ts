import type { Request, RequestHandler } from 'express';
import { env } from '../../config/env';
import * as usuarioRepository from '../../modules/usuarios/usuario.repository';
import { AppError } from '../errors/app-error';
import { firmarToken, verificarToken } from '../seguridad/token';
import type { UsuarioSesion } from '../types/express';

export const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado';

/**
 * Exige un JWT válido en "Authorization: Bearer <token>" y deja el usuario en req.usuario.
 * - Rechaza tokens ausentes, inválidos o expirados (401).
 * - Rechaza usuarios que fueron desactivados después de iniciar sesión (401).
 * - Renueva el token cuando le queda menos de la mitad de su vida (sesión por inactividad),
 *   enviando el nuevo en el encabezado X-Token-Renovado.
 *
 *   router.get('/', autenticar, autorizar('ADMINISTRADOR'), controlador.listar);
 */
export const autenticar: RequestHandler = async (req, res, next) => {
  const token = extraerToken(req);
  if (!token) {
    throw new AppError(401, 'TOKEN_AUSENTE', 'Debe iniciar sesión para acceder a este recurso.');
  }

  const verificacion = verificarToken(token);
  if (!verificacion.valido) {
    throw verificacion.motivo === 'EXPIRADO'
      ? new AppError(401, 'SESION_EXPIRADA', 'Su sesión expiró. Inicie sesión nuevamente.')
      : new AppError(401, 'TOKEN_INVALIDO', 'La sesión no es válida. Inicie sesión nuevamente.');
  }

  const usuario = await usuarioRepository.buscarPorId(verificacion.token.id);
  if (!usuario || !usuario.estadoActivo) {
    throw new AppError(401, 'CUENTA_INACTIVA', 'Su cuenta está inactiva. Comuníquese con el administrador.');
  }

  req.usuario = { id: usuario.id, rol: usuario.rol, nombreCompleto: usuario.nombreCompleto, email: usuario.email };

  const segundosRestantes = verificacion.token.exp - Math.floor(Date.now() / 1000);
  if (segundosRestantes < env.JWT_EXPIRA_EN / 2) {
    res.set(ENCABEZADO_TOKEN_RENOVADO, firmarToken({ id: usuario.id, rol: usuario.rol }));
  }

  next();
};

function extraerToken(req: Request): string | null {
  const [esquema, token] = (req.get('authorization') ?? '').split(' ');
  return esquema?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Devuelve el usuario autenticado. Usar solo en rutas protegidas con autenticar. */
export function usuarioDeSesion(req: Request): UsuarioSesion {
  if (!req.usuario) {
    throw new AppError(401, 'TOKEN_AUSENTE', 'Debe iniciar sesión para acceder a este recurso.');
  }
  return req.usuario;
}
