import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { ROLES, type Rol } from '../types/rol';

/** Información de la sesión que viaja dentro del token. */
export interface DatosToken {
  id: string;
  rol: Rol;
}

export interface TokenVerificado extends DatosToken {
  /** Momento de expiración (segundos desde epoch). */
  exp: number;
}

const ALGORITMO = 'HS256';

export function firmarToken(datos: DatosToken): string {
  return jwt.sign({ rol: datos.rol }, env.JWT_SECRET, {
    subject: datos.id,
    expiresIn: env.JWT_EXPIRA_EN,
    algorithm: ALGORITMO,
  });
}

export type ResultadoVerificacion =
  | { valido: true; token: TokenVerificado }
  | { valido: false; motivo: 'EXPIRADO' | 'INVALIDO' };

export function verificarToken(token: string): ResultadoVerificacion {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITMO] });
    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      typeof payload.exp !== 'number' ||
      !ROLES.includes(payload.rol)
    ) {
      return { valido: false, motivo: 'INVALIDO' };
    }
    return { valido: true, token: { id: payload.sub, rol: payload.rol, exp: payload.exp } };
  } catch (error) {
    return { valido: false, motivo: error instanceof jwt.TokenExpiredError ? 'EXPIRADO' : 'INVALIDO' };
  }
}
