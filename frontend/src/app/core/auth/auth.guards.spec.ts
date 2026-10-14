import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../../app.routes';
import { iniciarSesionDePrueba } from '../../testing/sesion-prueba';

describe('Guards y navegación por rol', () => {
  let router: Router;

  async function navegar(url: string): Promise<RouterTestingHarness> {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    return harness;
  }

  function menu(harness: RouterTestingHarness): string[] {
    const enlaces = harness.fixture.nativeElement.querySelectorAll('.nav-link') as NodeListOf<HTMLElement>;
    return [...enlaces].map((enlace) => enlace.textContent!.trim());
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    });
    router = TestBed.inject(Router);
  });

  it('CA 10: sin sesión, cualquier pantalla interna redirige al inicio de sesión', async () => {
    await navegar('/admin/flota');
    expect(router.url).toBe('/login');
  });

  it('CA 11: con el token expirado, redirige al inicio de sesión indicando que expiró', async () => {
    iniciarSesionDePrueba('ADMINISTRADOR', -10);
    await navegar('/admin/flota');

    expect(router.url).toBe('/login?motivo=expirada');
    expect(sessionStorage.getItem('sgl.token')).toBeNull();
  });

  it('CA 8: el conductor que abre el dashboard administrativo vuelve a su módulo', async () => {
    iniciarSesionDePrueba('CONDUCTOR');
    await navegar('/admin/dashboard');
    expect(router.url).toBe('/conductor/viajes-en-curso');
  });

  it('el contador no puede abrir pantallas del conductor', async () => {
    iniciarSesionDePrueba('CONTADOR');
    await navegar('/conductor/historial');
    expect(router.url).toBe('/contador/reportes');
  });

  it.each([
    ['ADMINISTRADOR', '/admin/dashboard'],
    ['CONDUCTOR', '/conductor/viajes-en-curso'],
    ['CONTADOR', '/contador/reportes'],
  ] as const)('la raíz y /login llevan al %s a su módulo', async (rol, destino) => {
    iniciarSesionDePrueba(rol);
    const harness = await navegar('/');
    expect(router.url).toBe(destino);

    await harness.navigateByUrl('/login');
    expect(router.url).toBe(destino);
  });

  it.each([
    ['ADMINISTRADOR', ['Dashboard', 'Viajes', 'Flota', 'Usuarios']],
    ['CONDUCTOR', ['Mis viajes', 'Historial']],
    ['CONTADOR', ['Reportes']],
  ] as const)('el menú del %s muestra solo sus módulos', async (rol, esperado) => {
    iniciarSesionDePrueba(rol);
    const harness = await navegar('/');
    expect(menu(harness)).toEqual(esperado);
  });

  it('muestra el nombre del usuario de la sesión', async () => {
    iniciarSesionDePrueba('CONTADOR');
    const harness = await navegar('/');
    expect(harness.fixture.nativeElement.querySelector('.profile-name').textContent).toContain('Laura Contreras');
    expect(harness.fixture.nativeElement.querySelector('.profile-button').textContent).toContain('LC');
  });

  it('CA 12: tras cerrar sesión, volver atrás no muestra contenido protegido', async () => {
    iniciarSesionDePrueba('ADMINISTRADOR');
    const harness = await navegar('/admin/flota');

    harness.fixture.nativeElement.querySelector('.logout-button').click();
    TestBed.inject(HttpTestingController).expectOne((req) => req.url.endsWith('/auth/logout')).flush(null);
    await harness.fixture.whenStable();
    expect(router.url).toBe('/login?motivo=cerrada');
    expect(sessionStorage.getItem('sgl.token')).toBeNull();

    // Equivale a presionar "atrás": se intenta abrir de nuevo la pantalla protegida.
    await harness.navigateByUrl('/admin/flota');
    expect(router.url).toBe('/login');
    expect(harness.fixture.nativeElement.querySelector('app-fleet-page')).toBeNull();
  });
});
