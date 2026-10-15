import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../../core/auth/auth.interceptor';
import { tokenDePrueba } from '../../testing/token-prueba';
import { AppLoginPage } from './login-page';

const URL_LOGIN = `${environment.apiUrl}/auth/login`;

describe('AppLoginPage', () => {
  let harness: RouterTestingHarness;
  let backend: HttpTestingController;
  let pagina: HTMLElement;

  async function abrir(url = '/login') {
    harness = await RouterTestingHarness.create(url);
    pagina = harness.routeNativeElement!;
  }

  function escribir(campo: 'email' | 'password', valor: string) {
    const input = pagina.querySelector<HTMLInputElement>(`input[formControlName="${campo}"]`)!;
    input.value = valor;
    input.dispatchEvent(new Event('input'));
  }

  function enviar() {
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
    harness.detectChanges();
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: AppLoginPage },
          { path: '**', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('CA 6: con campos vacíos no envía la solicitud y señala los campos', async () => {
    await abrir();
    enviar();

    backend.expectNone(URL_LOGIN);
    expect(pagina.querySelectorAll('.field.invalid').length).toBe(2);
    expect(pagina.textContent).toContain('El correo es obligatorio.');
    expect(pagina.textContent).toContain('La contraseña es obligatoria.');
  });

  it('CA 6: con un correo de formato inválido no envía la solicitud', async () => {
    await abrir();
    escribir('email', 'correo-sin-arroba');
    escribir('password', 'algo');
    enviar();

    backend.expectNone(URL_LOGIN);
    expect(pagina.textContent).toContain('Ingrese un correo con formato válido.');
  });

  it.each([
    ['CONDUCTOR', '/conductor/viajes-en-curso'],
    ['ADMINISTRADOR', '/admin/dashboard'],
    ['CONTADOR', '/contador/reportes'],
  ])('CA 1-3: con credenciales válidas lleva al %s a %s', async (rol, destino) => {
    await abrir();
    escribir('email', 'usuario@sgl.test');
    escribir('password', 'Sgl2026*');
    enviar();

    backend.expectOne(URL_LOGIN).flush({
      token: tokenDePrueba(1800, rol),
      expiraEn: 1800,
      usuario: { id: 'u1', nombreCompleto: 'Usuario', rol },
    });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toBe(destino);
  });

  it('CA 4 y 5: muestra en rojo el mensaje de credenciales incorrectas y borra la contraseña', async () => {
    await abrir();
    escribir('email', 'conductor@sgl.test');
    escribir('password', 'equivocada');
    enviar();

    backend.expectOne(URL_LOGIN).flush(
      { codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales incorrectas, inténtelo de nuevo.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    harness.detectChanges();

    const alerta = pagina.querySelector('.login-alert.error');
    expect(alerta?.textContent).toContain('Credenciales incorrectas, inténtelo de nuevo.');
    expect(pagina.querySelector<HTMLInputElement>('input[formControlName="password"]')!.value).toBe('');
    expect(pagina.querySelector('.login-button')?.textContent).toContain('Iniciar sesión');
  });

  it('CA 7: indica que la cuenta está inactiva', async () => {
    await abrir();
    escribir('email', 'inactivo@sgl.test');
    escribir('password', 'Sgl2026*');
    enviar();

    backend.expectOne(URL_LOGIN).flush(
      { codigo: 'CUENTA_INACTIVA', mensaje: 'Su cuenta está inactiva. Comuníquese con el administrador.' },
      { status: 403, statusText: 'Forbidden' },
    );
    harness.detectChanges();

    expect(pagina.querySelector('.login-alert.error')?.textContent).toContain('inactiva');
  });

  it('CA 14: sin conexión informa que no hay internet y permite reintentar', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await abrir();
    escribir('email', 'conductor@sgl.test');
    escribir('password', 'Sgl2026*');
    enviar();

    backend.expectOne(URL_LOGIN).error(new ProgressEvent('error'), { status: 0 });
    harness.detectChanges();

    expect(pagina.querySelector('.login-alert.error')?.textContent).toContain('No hay conexión a internet');
    expect(pagina.querySelector('.login-button')?.textContent).toContain('Reintentar');
    vi.restoreAllMocks();
  });

  it('CA 15: si el servidor falla muestra un mensaje claro y permite reintentar', async () => {
    await abrir();
    escribir('email', 'conductor@sgl.test');
    escribir('password', 'Sgl2026*');
    enviar();

    backend.expectOne(URL_LOGIN).flush({ codigo: 'ERROR_INTERNO', mensaje: 'x' }, { status: 500, statusText: 'Error' });
    harness.detectChanges();

    expect(pagina.querySelector('.login-alert.error')?.textContent).toContain('El servidor presentó un error');
    expect(pagina.querySelector<HTMLButtonElement>('.login-button')!.disabled).toBe(false);

    enviar();
    backend.expectOne(URL_LOGIN);
  });

  it('CA 11: avisa que la sesión expiró cuando llega desde un cierre por expiración', async () => {
    await abrir('/login?motivo=expirada');
    expect(pagina.querySelector('.login-alert.info')?.textContent).toContain('Su sesión expiró');
  });
});
