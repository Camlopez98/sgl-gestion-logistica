import type { Rol } from './rol';

/** Usuario autenticado que el middleware autenticar deja en req.usuario. */
export interface UsuarioSesion {
  id: string;
  rol: Rol;
  nombreCompleto: string;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}
