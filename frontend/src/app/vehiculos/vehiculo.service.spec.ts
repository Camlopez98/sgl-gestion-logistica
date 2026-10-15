import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import type { DatosVehiculo, Vehiculo } from './vehiculo.model';
import { VehiculoService } from './vehiculo.service';

const URL = `${environment.apiUrl}/vehiculos`;
const datos: DatosVehiculo = { placa: 'TKM482', tipo: 'TRACTOCAMION', marca: 'Kenworth', modelo: 'T800', numeroEjes: 3, capacidadCargaKg: 34000 };
const vehiculo = { ...datos, id: 'v1', estado: 'ACTIVO', createdAt: '', updatedAt: '' } as Vehiculo;

describe('VehiculoService', () => {
  let servicio: VehiculoService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(VehiculoService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('lista con los filtros indicados', () => {
    servicio.listar({ estado: 'ACTIVO', tipo: 'REMOLQUE', q: '' }).subscribe();
    const peticion = backend.expectOne((req) => req.url === URL);
    expect(peticion.request.params.toString()).toBe('estado=ACTIVO&tipo=REMOLQUE');
    peticion.flush([]);
  });

  it('envía la clave de idempotencia al registrar', () => {
    servicio.registrar(datos, 'clave-1').subscribe();
    const peticion = backend.expectOne(URL);
    expect(peticion.request.method).toBe('POST');
    expect(peticion.request.headers.get('Idempotency-Key')).toBe('clave-1');
    peticion.flush(vehiculo, { status: 201, statusText: 'Created' });
  });

  it('CA 8: sin conexión no envía la solicitud', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let error: HttpErrorResponse | undefined;

    servicio.registrar(datos, 'clave-1').subscribe({ error: (e) => (error = e) });

    backend.expectNone(URL);
    expect(error?.status).toBe(0);
  });

  it('CA 10: si la conexión se corta, reenvía automáticamente con la misma clave', () => {
    vi.useFakeTimers();
    try {
      let resultado: Vehiculo | undefined;
      servicio.registrar(datos, 'clave-1').subscribe((v) => (resultado = v));

      backend.expectOne(URL).error(new ProgressEvent('error'), { status: 0 });
      vi.advanceTimersByTime(1000);
      const reenvio = backend.expectOne(URL);
      expect(reenvio.request.headers.get('Idempotency-Key')).toBe('clave-1');
      reenvio.flush(vehiculo, { status: 201, statusText: 'Created' });

      expect(resultado).toEqual(vehiculo);
    } finally {
      vi.useRealTimers();
    }
  });

  it('no reenvía ante errores de negocio', () => {
    let status = 0;
    servicio.registrar(datos, 'clave-1').subscribe({ error: (e) => (status = e.status) });

    backend.expectOne(URL).flush({ codigo: 'PLACA_DUPLICADA', mensaje: '' }, { status: 409, statusText: 'Conflict' });

    expect(status).toBe(409);
    backend.expectNone(URL);
  });

  it('edita y desactiva con los métodos del contrato', () => {
    servicio.editar('v1', datos).subscribe();
    servicio.desactivar('v1').subscribe();

    expect(backend.expectOne(`${URL}/v1`).request.method).toBe('PUT');
    expect(backend.expectOne(`${URL}/v1/desactivar`).request.method).toBe('PATCH');
  });
});
