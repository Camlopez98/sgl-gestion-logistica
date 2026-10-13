import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { tokenDePrueba } from '../../testing/token-prueba';
import { authInterceptor } from './auth.interceptor';
import type { UsuarioSesion } from './auth.models';
import { AuthService } from './auth.service';

const API = environment.apiUrl;
const conductor: UsuarioSesion = { id: 'u1', nombreCompleto: 'Carlos Méndez', rol: 'CONDUCTOR' };

function configurar() {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  return {
    auth: TestBed.inject(AuthService),
    http: TestBed.inject(HttpTestingController),
    router: TestBed.inject(Router),
  };
}

describe('AuthService', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('inicia sesión y guarda token y usuario en sessionStorage', () => {
    const { auth, http } = configurar();
    const token = tokenDePrueba();
    let recibido: UsuarioSesion | undefined;

    auth.login('conductor@sgl.test', 'Sgl2026*').subscribe((usuario) => (recibido = usuario));
    const peticion = http.expectOne(`${API}/auth/login`);
    expect(peticion.request.body).toEqual({ email: 'conductor@sgl.test', password: 'Sgl2026*' });
    peticion.flush({ token, expiraEn: 1800, usuario: conductor });

    expect(recibido).toEqual(conductor);
    expect(auth.estaAutenticado()).toBe(true);
    expect(auth.rol()).toBe('CONDUCTOR');
    expect(sessionStorage.getItem('sgl.token')).toBe(token);
  });

  it.each([
    ['CONDUCTOR', '/conductor/viajes-en-curso'],
    ['ADMINISTRADOR', '/admin/dashboard'],
    ['CONTADOR', '/contador/reportes'],
  ] as const)('CA 1-3: la ruta de inicio del rol %s es %s', (rol, ruta) => {
    sessionStorage.setItem('sgl.token', tokenDePrueba());
    sessionStorage.setItem('sgl.usuario', JSON.stringify({ ...conductor, rol }));
    const { auth } = configurar();

    expect(auth.rutaInicio()).toBe(ruta);
  });

  it('recupera la sesión guardada al recargar la página', () => {
    sessionStorage.setItem('sgl.token', tokenDePrueba());
    sessionStorage.setItem('sgl.usuario', JSON.stringify(conductor));
    const { auth } = configurar();

    expect(auth.estaAutenticado()).toBe(true);
    expect(auth.usuario()).toEqual(conductor);
  });

  it('reconoce una sesión guardada cuyo token ya expiró y permite descartarla', () => {
    sessionStorage.setItem('sgl.token', tokenDePrueba(-10));
    sessionStorage.setItem('sgl.usuario', JSON.stringify(conductor));
    const { auth } = configurar();

    expect(auth.estaAutenticado()).toBe(false);
    expect(auth.sesionExpirada()).toBe(true);

    auth.descartarSesion();
    expect(auth.sesionExpirada()).toBe(false);
    expect(sessionStorage.getItem('sgl.token')).toBeNull();
  });

  it('descarta datos de sesión incompletos', () => {
    sessionStorage.setItem('sgl.token', 'no-es-un-jwt');
    const { auth } = configurar();

    expect(auth.estaAutenticado()).toBe(false);
    expect(sessionStorage.getItem('sgl.token')).toBeNull();
  });

  it('CA 12: al cerrar sesión borra los datos, avisa al servidor y reemplaza la URL', () => {
    sessionStorage.setItem('sgl.token', tokenDePrueba());
    sessionStorage.setItem('sgl.usuario', JSON.stringify(conductor));
    const { auth, http, router } = configurar();
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    auth.cerrarSesion();

    http.expectOne(`${API}/auth/logout`).flush(null, { status: 204, statusText: 'No Content' });
    expect(auth.estaAutenticado()).toBe(false);
    expect(sessionStorage.length).toBe(0);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'cerrada' }, replaceUrl: true });
  });

  it('CA 11: cierra la sesión automáticamente cuando el token expira', () => {
    vi.useFakeTimers();
    try {
      sessionStorage.setItem('sgl.token', tokenDePrueba(60));
      sessionStorage.setItem('sgl.usuario', JSON.stringify(conductor));
      const { auth, router } = configurar();
      const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      vi.advanceTimersByTime(61_000);

      expect(auth.estaAutenticado()).toBe(false);
      expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { motivo: 'expirada' }, replaceUrl: true });
    } finally {
      vi.useRealTimers();
    }
  });
});
