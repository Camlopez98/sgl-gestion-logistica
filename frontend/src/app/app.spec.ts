import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Gestión de Viajes');
    expect(compiled.querySelectorAll('app-card').length).toBe(4);
    expect(compiled.querySelectorAll('.trip-row').length).toBe(5);
  });

  it('should open the dashboard and history tabs', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    compiled.querySelectorAll<HTMLButtonElement>('.nav-link')[0].click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-dashboard-page')).toBeTruthy();
    expect(compiled.textContent).toContain('Ingresos Mensuales');

    compiled.querySelectorAll<HTMLButtonElement>('.nav-link')[2].click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-history-page')).toBeTruthy();
    expect(compiled.textContent).toContain('Historial de Viajes');

    compiled.querySelectorAll<HTMLButtonElement>('.nav-link')[3].click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-fleet-page')).toBeTruthy();
    expect(compiled.textContent).toContain('Gestión de Flota');

    compiled.querySelectorAll<HTMLButtonElement>('.nav-link')[4].click();
    fixture.detectChanges();
    expect(compiled.querySelector('app-users-page')).toBeTruthy();
    expect(compiled.textContent).toContain('Gestión de Conductores');
  });
});
