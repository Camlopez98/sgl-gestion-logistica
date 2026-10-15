import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { HistorialService } from './historial.service';

const URL = `${environment.apiUrl}/conductores/me/viajes`;

describe('HistorialService', () => {
  let servicio: HistorialService;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    servicio = TestBed.inject(HistorialService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  it('pide los 5 viajes más recientes por defecto, sin cursor ni filtros', () => {
    servicio.listar().subscribe();
    const peticion = backend.expectOne((req) => req.url === URL);

    expect(peticion.request.method).toBe('GET');
    expect(peticion.request.params.toString()).toBe('limite=5');
    peticion.flush({ items: [], siguienteCursor: null, total: 0 });
  });

  it('envía el cursor y los filtros indicados', () => {
    servicio.listar({ estado: 'FINALIZADO', desde: '2026-10-01', hasta: '2026-10-31' }, 'abc').subscribe();
    const peticion = backend.expectOne((req) => req.url === URL);

    expect(peticion.request.params.get('cursor')).toBe('abc');
    expect(peticion.request.params.get('estado')).toBe('FINALIZADO');
    expect(peticion.request.params.get('desde')).toBe('2026-10-01');
    expect(peticion.request.params.get('hasta')).toBe('2026-10-31');
    expect(peticion.request.params.get('limite')).toBe('5');
    peticion.flush({ items: [], siguienteCursor: null, total: 0 });
  });

  it('no envía filtros vacíos ni identificadores de conductor: el servidor usa la sesión', () => {
    servicio.listar({ estado: undefined, desde: '', hasta: undefined }).subscribe();
    const peticion = backend.expectOne((req) => req.url === URL);

    expect([...peticion.request.params.keys()]).toEqual(['limite']);
    peticion.flush({ items: [], siguienteCursor: null, total: 0 });
  });

  it('consulta el detalle de un viaje propio', () => {
    servicio.detalle('v1').subscribe();
    const peticion = backend.expectOne(`${URL}/v1`);

    expect(peticion.request.method).toBe('GET');
    peticion.flush({});
  });

  it('sin conexión a internet no envía la solicitud y falla con status 0', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    let error: unknown;

    servicio.listar().subscribe({ error: (e: unknown) => (error = e) });
    servicio.detalle('v1').subscribe({ error: (e: unknown) => (error = e) });

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect((error as HttpErrorResponse).status).toBe(0);
    backend.expectNone(() => true);
  });

  it('un corte de conexión se informa de inmediato, sin reintentos automáticos que demoren el aviso', () => {
    let error: unknown;
    servicio.listar().subscribe({ error: (e: unknown) => (error = e) });

    backend.expectOne((req) => req.url === URL).error(new ProgressEvent('error'), { status: 0 });

    expect((error as HttpErrorResponse).status).toBe(0);
    backend.expectNone(() => true);
  });
});
