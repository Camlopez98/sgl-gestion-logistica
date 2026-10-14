import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { tokenDePrueba } from '../../testing/token-prueba';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const API = environment.apiUrl;

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: AuthService;
  let router: Router;
  let token: string;

  beforeEach(() => {
    sessionStorage.clear();
    token = tokenDePrueba();
    sessionStorage.setItem('sgl.token', token);
    sessionStorage.setItem('sgl.usuario', JSON.stringify({ id: 'u1', nombreCompleto: 'Laura', rol: 'CONTADOR' }));

    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => backend.verify());

  it('agrega el token a las peticiones a la API', () => {
    http.get(`${API}/vehiculos`).subscribe();
    expect(backend.expectOne(`${API}/vehiculos`).request.headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('no envía el token a otros dominios', () => {
    http.get('https://otro-sitio.com/datos').subscribe();
    expect(backend.expectOne('https://otro-sitio.com/datos').request.headers.has('Authorization')).toBe(false);
  });

  it('CA 11: guarda el token renovado que envía el servidor', () => {
    const renovado = tokenDePrueba(1800, 'CONTADOR');
    http.get(`${API}/auth/me`).subscribe();
    backend.expectOne(`${API}/auth/me`).flush({}, { headers: { 'X-Token-Renovado': renovado } });

    expect(auth.token()).toBe(renovado);
  });

  it.each([
    ['SESION_EXPIRADA', 'expirada'],
    ['CUENTA_INACTIVA', 'inactiva'],
    ['TOKEN_INVALIDO', 'invalida'],
  ])('CA 11: ante 401 %s cierra la sesión con motivo %s', (codigo, motivo) => {
    const navegar = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    http.get(`${API}/vehiculos`).subscribe({ error: () => undefined });
    backend.expectOne(`${API}/vehiculos`).flush({ codigo, mensaje: '' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.estaAutenticado()).toBe(false);
    expect(navegar).toHaveBeenCalledWith(['/login'], { queryParams: { motivo }, replaceUrl: true });
  });

  it('CA 9: ante 403 ACCESO_DENEGADO devuelve al usuario a su módulo', () => {
    const navegar = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    http.post(`${API}/vehiculos`, {}).subscribe({ error: () => undefined });
    backend
      .expectOne(`${API}/vehiculos`)
      .flush({ codigo: 'ACCESO_DENEGADO', mensaje: '' }, { status: 403, statusText: 'Forbidden' });

    expect(navegar).toHaveBeenCalledWith('/contador/reportes');
    expect(auth.estaAutenticado()).toBe(true);
  });

  it('no intercepta los errores del login (los muestra la pantalla de login)', () => {
    const navegar = vi.spyOn(router, 'navigate');
    let status = 0;

    http.post(`${API}/auth/login`, {}).subscribe({ error: (e) => (status = e.status) });
    backend
      .expectOne(`${API}/auth/login`)
      .flush({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: '' }, { status: 401, statusText: 'Unauthorized' });

    expect(status).toBe(401);
    expect(navegar).not.toHaveBeenCalled();
  });
});
