import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService, type MotivoCierre } from './auth.service';

export const ENCABEZADO_TOKEN_RENOVADO = 'X-Token-Renovado';

const MOTIVO_POR_CODIGO: Record<string, MotivoCierre> = {
  SESION_EXPIRADA: 'expirada',
  CUENTA_INACTIVA: 'inactiva',
};

/**
 * Para toda petición a la API:
 * - agrega el token en Authorization;
 * - guarda el token renovado que envía el servidor;
 * - 401: cierra la sesión y lleva al inicio de sesión con el motivo (expirada, inactiva, inválida);
 * - 403 ACCESO_DENEGADO: devuelve al usuario al módulo de su rol.
 * Las respuestas de /auth/login no se interceptan: sus errores los muestra la pantalla de login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.estaAutenticado() ? auth.token() : null;
  const peticion = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  const esPeticionDeSesion = /\/auth\/(login|logout)$/.test(req.url);

  return next(peticion).pipe(
    tap((evento) => {
      const renovado = evento instanceof HttpResponse ? evento.headers.get(ENCABEZADO_TOKEN_RENOVADO) : null;
      if (renovado) {
        auth.actualizarToken(renovado);
      }
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !esPeticionDeSesion) {
        const codigo = (error.error as { codigo?: string } | null)?.codigo ?? '';
        if (error.status === 401) {
          auth.cerrarSesion(MOTIVO_POR_CODIGO[codigo] ?? 'invalida');
        } else if (error.status === 403 && codigo === 'ACCESO_DENEGADO') {
          void router.navigateByUrl(auth.rutaInicio());
        }
      }
      return throwError(() => error);
    }),
  );
};
