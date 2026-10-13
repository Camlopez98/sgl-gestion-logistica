import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, Observable, catchError, map, tap, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RUTA_INICIO_POR_ROL, type RespuestaLogin, type UsuarioSesion } from './auth.models';

/** Motivo por el que se cerró la sesión; la pantalla de login muestra el aviso correspondiente. */
export type MotivoCierre = 'cerrada' | 'expirada' | 'inactiva' | 'invalida';

const CLAVE_TOKEN = 'sgl.token';
const CLAVE_USUARIO = 'sgl.usuario';
const TIEMPO_MAXIMO_LOGIN_MS = 15000;

/**
 * Sesión del usuario: inicio y cierre de sesión, token y rol.
 * La sesión se guarda en sessionStorage: se borra al cerrar el navegador y no queda
 * disponible para el siguiente usuario de un dispositivo compartido.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly tokenActual = signal<string | null>(leer(CLAVE_TOKEN));
  private readonly usuarioActual = signal<UsuarioSesion | null>(leerJson<UsuarioSesion>(CLAVE_USUARIO));
  private temporizadorExpiracion: ReturnType<typeof setTimeout> | undefined;

  readonly usuario = this.usuarioActual.asReadonly();
  readonly rol = computed(() => this.usuarioActual()?.rol ?? null);

  constructor() {
    if (this.estaAutenticado()) {
      this.programarExpiracion();
    } else if (!this.sesionExpirada()) {
      // Datos incompletos o corruptos. Una sesión expirada se conserva hasta que
      // authGuard la descarte, para poder avisar al usuario que su sesión expiró.
      this.descartarSesion();
    }
  }

  token(): string | null {
    return this.tokenActual();
  }

  /** Hay sesión y el token aún no ha expirado. */
  estaAutenticado(): boolean {
    const token = this.tokenActual();
    return !!token && !!this.usuarioActual() && !tokenExpirado(token);
  }

  /** Ruta del módulo que corresponde al rol del usuario actual. */
  rutaInicio(): string {
    const rol = this.rol();
    return rol ? RUTA_INICIO_POR_ROL[rol] : '/login';
  }

  login(email: string, password: string): Observable<UsuarioSesion> {
    return this.http.post<RespuestaLogin>(`${environment.apiUrl}/auth/login`, { email, password }).pipe(
      timeout(TIEMPO_MAXIMO_LOGIN_MS),
      tap((respuesta) => this.guardarSesion(respuesta.token, respuesta.usuario)),
      map((respuesta) => respuesta.usuario),
    );
  }

  /** Reemplaza el token por el renovado que envía el servidor (sesión por inactividad). */
  actualizarToken(token: string): void {
    if (!this.usuarioActual()) return;
    escribir(CLAVE_TOKEN, token);
    this.tokenActual.set(token);
    this.programarExpiracion();
  }

  /**
   * Cierra la sesión: avisa al servidor, borra los datos guardados y lleva al inicio de sesión.
   * Se navega con replaceUrl para que el botón "atrás" no regrese a la pantalla protegida.
   */
  cerrarSesion(motivo: MotivoCierre = 'cerrada'): void {
    const token = this.tokenActual();
    if (token && motivo === 'cerrada') {
      this.http
        .post<void>(`${environment.apiUrl}/auth/logout`, {})
        .pipe(catchError(() => EMPTY))
        .subscribe();
    }
    this.descartarSesion();
    void this.router.navigate(['/login'], { queryParams: { motivo }, replaceUrl: true });
  }

  /** Hay datos de una sesión anterior cuyo token ya expiró. */
  sesionExpirada(): boolean {
    const token = this.tokenActual();
    return !!token && !!this.usuarioActual() && tokenExpirado(token);
  }

  private guardarSesion(token: string, usuario: UsuarioSesion): void {
    escribir(CLAVE_TOKEN, token);
    escribir(CLAVE_USUARIO, JSON.stringify(usuario));
    this.tokenActual.set(token);
    this.usuarioActual.set(usuario);
    this.programarExpiracion();
  }

  /** Borra los datos de la sesión sin navegar (los guards deciden a dónde ir). */
  descartarSesion(): void {
    clearTimeout(this.temporizadorExpiracion);
    borrar(CLAVE_TOKEN);
    borrar(CLAVE_USUARIO);
    this.tokenActual.set(null);
    this.usuarioActual.set(null);
  }

  /** Cierra la sesión automáticamente cuando el token expira (HU-18, escenario 11). */
  private programarExpiracion(): void {
    clearTimeout(this.temporizadorExpiracion);
    const token = this.tokenActual();
    const expira = token ? expiracionMs(token) : null;
    if (expira === null) return;
    this.temporizadorExpiracion = setTimeout(() => this.cerrarSesion('expirada'), Math.max(expira - Date.now(), 0));
  }
}

/** Momento de expiración del JWT en milisegundos, o null si no se puede leer. */
function expiracionMs(token: string): number | null {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}

function tokenExpirado(token: string): boolean {
  const expira = expiracionMs(token);
  return expira === null || expira <= Date.now();
}

function leer(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function leerJson<T>(clave: string): T | null {
  try {
    const valor = leer(clave);
    return valor ? (JSON.parse(valor) as T) : null;
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    sessionStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento disponible la sesión dura mientras la pestaña esté abierta.
  }
}

function borrar(clave: string): void {
  try {
    sessionStorage.removeItem(clave);
  } catch {
    // Nada que borrar.
  }
}
