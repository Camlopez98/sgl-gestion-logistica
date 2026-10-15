import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import type { Rol } from './core/auth/auth.models';
import { iniciarSesionDePrueba } from './testing/sesion-prueba';

describe('App', () => {
  beforeEach(async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the trips page', async () => {
    iniciarSesionDePrueba('ADMINISTRADOR');
    const harness = await RouterTestingHarness.create('/admin/viajes');
    const compiled = harness.routeNativeElement!.closest('app-shell') as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Gestión de Viajes');
    expect(compiled.querySelectorAll('app-card').length).toBe(4);
    expect(compiled.querySelectorAll('.trip-row').length).toBe(5);
    expect(compiled.querySelector('.breadcrumb')?.textContent).toContain('Viajes');
  });

  it.each<[string, Rol, string, string]>([
    ['/admin/dashboard', 'ADMINISTRADOR', 'app-dashboard-page', 'Ingresos Mensuales'],
    ['/admin/flota', 'ADMINISTRADOR', 'app-fleet-page', 'Gestión de Flota'],
    ['/admin/usuarios', 'ADMINISTRADOR', 'app-users-page', 'Gestión de Conductores'],
    ['/conductor/historial', 'CONDUCTOR', 'app-history-page', 'Historial de Viajes'],
    ['/conductor/viajes-en-curso', 'CONDUCTOR', 'app-driver-trips-page', 'Mis viajes en curso'],
    ['/contador/reportes', 'CONTADOR', 'app-reports-page', 'Visor de reportes'],
  ])('should open %s for %s', async (url, rol, selector, texto) => {
    iniciarSesionDePrueba(rol);
    const harness = await RouterTestingHarness.create(url);
    const compiled = harness.routeNativeElement!.closest('app-shell') as HTMLElement;

    expect(compiled.querySelector(selector)).toBeTruthy();
    expect(compiled.textContent).toContain(texto);
  });
});
