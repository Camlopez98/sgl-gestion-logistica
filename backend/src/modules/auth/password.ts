import bcrypt from 'bcryptjs';
import { env } from '../../config/env';

/** Genera el hash bcrypt (con salt aleatorio) de una contraseña. */
export function generarHash(password: string): Promise<string> {
  return bcrypt.hash(password, env.BCRYPT_COSTO);
}

/** Compara una contraseña con su hash en tiempo constante. */
export function verificarPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
