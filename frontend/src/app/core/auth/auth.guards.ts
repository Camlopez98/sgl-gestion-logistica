import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import type { DatosRuta } from './auth.models';
import { AuthService } from './auth.service';

/**
 * Exige una sesión activa (HU-18, escenarios 10, 11 y 12).
 * Sin sesión lleva al inicio de sesión; si el token expiró, indica que la sesión expiró.
 */
export const authGuard: CanActivateFn & CanActivateChildFn = () => {
  const auth = inject(AuthService);
  if (auth.estaAutenticado()) {
    return true;
  }

  const expirada = auth.sesionExpirada();
  auth.descartarSesion();
  return inject(Router).createUrlTree(['/login'], expirada ? { queryParams: { motivo: 'expirada' } } : {});
};

/**
 * Permite abrir la ruta solo a los roles de `data.roles`; si no, devuelve al módulo del rol (HU-18, escenario 8).
 * Es una ayuda de navegación: la autorización real la valida el servidor en cada petición.
 */
export const rolGuard: CanActivateChildFn = (ruta) => {
  const auth = inject(AuthService);
  const roles = (ruta.data as Partial<DatosRuta>).roles;
  const rol = auth.rol();

  if (!roles || (rol && roles.includes(rol))) {
    return true;
  }
  return inject(Router).parseUrl(auth.rutaInicio());
};

/** La pantalla de inicio de sesión solo es para quien no tiene sesión; si ya la tiene, va a su módulo. */
export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.estaAutenticado() ? inject(Router).parseUrl(auth.rutaInicio()) : true;
};
