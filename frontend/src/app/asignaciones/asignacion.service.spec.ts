import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import type { Asignacion } from './asignacion.model';
import { AsignacionService } from './asignacion.service';

const URL = `${environment.apiUrl}/asignaciones`;
const asignacion = { id: 'a1', estado: 'HABILITADA', version: 1 } as Asignacion;

describe('AsignacionService', () => {
  let servicio: AsignacionService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(AsignacionService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('lista con los filtros indicados', () => {
    servicio.listar({ conductorId: 'c1', estado: 'ACTIVA' }).subscribe();
    const peticion = backend.expectOne((req) => req.url === URL);
    expect(peticion.request.params.toString()).toBe('conductorId=c1&estado=ACTIVA');
    peticion.flush([]);
  });

  it('consulta los conductores habilitables y el historial de un vehículo con las rutas del contrato', () => {
    servicio.conductores().subscribe();
    servicio.historialDeVehiculo('v1').subscribe();

    expect(backend.expectOne(`${URL}/conductores`).request.method).toBe('GET');
    expect(backend.expectOne(`${environment.apiUrl}/vehiculos/v1/asignaciones`).request.method).toBe('GET');
  });

  it('CA 17: envía la clave de idempotencia al habilitar', () => {
    servicio.habilitar({ conductorId: 'c1', vehiculoId: 'v1' }, 'clave-1').subscribe();
    const peticion = backend.expectOne(URL);

    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.body).toEqual({ conductorId: 'c1', vehiculoId: 'v1' });
    expect(peticion.request.headers.get('Idempotency-Key')).toBe('clave-1');
    peticion.flush(asignacion, { status: 201, statusText: 'Created' });
  });

  it('activa con el remolque y la versión cargada (CA 10 y 19)', () => {
    servicio.activar('a1', { idRemolque: 'r1', version: 3 }).subscribe();
    const peticion = backend.expectOne(`${URL}/a1/activar`);

    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ idRemolque: 'r1', version: 3 });
    peticion.flush(asignacion);
  });

  it('finaliza con la versión cargada (CA 4 y 19)', () => {
    servicio.finalizar('a1', 2).subscribe();
    const peticion = backend.expectOne(`${URL}/a1/finalizar`);

    expect(peticion.request.method).toBe('PATCH');
    expect(peticion.request.body).toEqual({ version: 2 });
    peticion.flush(asignacion);
  });

  it('consulta el vehículo activo del conductor', () => {
    servicio.vehiculoActivo().subscribe();
    expect(backend.expectOne(`${environment.apiUrl}/conductores/me/vehiculo-activo`).request.method).toBe('GET');
  });

  it('CA 16: sin conexión no envía la solicitud, así no queda una asignación parcial', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let error: HttpErrorResponse | undefined;

    servicio.habilitar({ conductorId: 'c1', vehiculoId: 'v1' }, 'clave-1').subscribe({ error: (e) => (error = e) });

    backend.expectNone(URL);
    expect(error?.status).toBe(0);
  });

  it('CA 16: tampoco envía activar ni finalizar sin conexión', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const errores: number[] = [];

    servicio.activar('a1', { idRemolque: null, version: 1 }).subscribe({ error: (e) => errores.push(e.status) });
    servicio.finalizar('a1', 1).subscribe({ error: (e) => errores.push(e.status) });

    backend.expectNone(`${URL}/a1/activar`);
    backend.expectNone(`${URL}/a1/finalizar`);
    expect(errores).toEqual([0, 0]);
  });

  it('CA 17: si la conexión se corta al habilitar, reenvía con la misma clave', () => {
    vi.useFakeTimers();
    try {
      let resultado: Asignacion | undefined;
      servicio.habilitar({ conductorId: 'c1', vehiculoId: 'v1' }, 'clave-1').subscribe((a) => (resultado = a));

      backend.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
      vi.advanceTimersByTime(1000);
      const reenvio = backend.expectOne(URL);
      expect(reenvio.request.headers.get('Idempotency-Key')).toBe('clave-1');
      reenvio.flush(asignacion, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual(asignacion);
    } finally {
      vi.useRealTimers();
    }
  });

  it('activar y finalizar no se reenvían solos tras un corte: su versión pudo haber cambiado', () => {
    vi.useFakeTimers();
    try {
      let status: number | undefined;
      servicio.activar('a1', { idRemolque: null, version: 1 }).subscribe({ error: (e) => (status = e.status) });

      backend.expectOne(`${URL}/a1/activar`).error(new ProgressEvent('error'), { status: 0 });
      vi.advanceTimersByTime(5000);

      backend.expectNone(`${URL}/a1/activar`);
      expect(status).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no reenvía ante errores de negocio', () => {
    let status = 0;
    servicio.habilitar({ conductorId: 'c1', vehiculoId: 'v1' }, 'clave-1').subscribe({ error: (e) => (status = e.status) });

    backend.expectOne(URL).flush({ codigo: 'ASIGNACION_DUPLICADA', mensaje: '' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
    backend.expectNone(URL);
  });
});
