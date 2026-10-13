import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render the trips page', async () => {
    const harness = await RouterTestingHarness.create('/admin/viajes');
    const compiled = harness.routeNativeElement!.closest('app-shell') as HTMLElement;

    expect(compiled.querySelector('h1')?.textContent).toContain('Gestión de Viajes');
    expect(compiled.querySelectorAll('app-card').length).toBe(4);
    expect(compiled.querySelectorAll('.trip-row').length).toBe(5);
    expect(compiled.querySelector('.breadcrumb')?.textContent).toContain('Viajes');
  });

  it.each([
    ['/admin/dashboard', 'app-dashboard-page', 'Ingresos Mensuales'],
    ['/conductor/historial', 'app-history-page', 'Historial de Viajes'],
    ['/admin/flota', 'app-fleet-page', 'Gestión de Flota'],
    ['/admin/usuarios', 'app-users-page', 'Gestión de Conductores'],
    ['/conductor/viajes-en-curso', 'app-driver-trips-page', 'Mis viajes en curso'],
    ['/contador/reportes', 'app-reports-page', 'Visor de reportes'],
  ])('should open %s', async (url, selector, texto) => {
    const harness = await RouterTestingHarness.create(url);
    const compiled = harness.routeNativeElement!.closest('app-shell') as HTMLElement;

    expect(compiled.querySelector(selector)).toBeTruthy();
    expect(compiled.textContent).toContain(texto);
  });
});
