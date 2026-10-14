import type { Rol } from '../core/auth/auth.models';
import { tokenDePrueba } from './token-prueba';

const NOMBRES: Record<Rol, string> = {
  ADMINISTRADOR: 'Admin Ramírez',
  CONDUCTOR: 'Carlos Méndez',
  CONTADOR: 'Laura Contreras',
};

/** Deja guardada una sesión de prueba, como si el usuario hubiera iniciado sesión. */
export function iniciarSesionDePrueba(rol: Rol, segundos = 1800): void {
  sessionStorage.setItem('sgl.token', tokenDePrueba(segundos, rol));
  sessionStorage.setItem('sgl.usuario', JSON.stringify({ id: 'u1', nombreCompleto: NOMBRES[rol], rol }));
}
