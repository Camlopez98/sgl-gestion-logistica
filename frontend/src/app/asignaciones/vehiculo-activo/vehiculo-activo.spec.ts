import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { SeleccionVehiculo, VehiculoActivo } from '../asignacion.model';
import { AppVehiculoActivo, MENSAJE_SIN_VEHICULO } from './vehiculo-activo';

const URL = `${environment.apiUrl}/conductores/me/vehiculo-activo`;

const tracto = { id: 'v1', placa: 'TKM482', tipo: 'TRACTOCAMION', marca: 'Kenworth', modelo: 'T800' } as const;
const semi = { id: 'r1', placa: 'S00012', tipo: 'SEMIRREMOLQUE', marca: 'Fruehauf', modelo: 'X1' } as const;

describe('AppVehiculoActivo (selector del conductor)', () => {
  let fixture: ComponentFixture<AppVehiculoActivo>;
  let backend: HttpTestingController;
  let pagina: HTMLElement;
  let selecciones: (SeleccionVehiculo | null)[];

  function abrir(): void {
    fixture = TestBed.createComponent(AppVehiculoActivo);
    pagina = fixture.nativeElement;
    selecciones = [];
    fixture.componentInstance.seleccion.subscribe((s) => selecciones.push(s));
    fixture.detectChanges();
  }

  const responder = (cuerpo: VehiculoActivo) => {
    backend.expectOne(URL).flush(cuerpo);
    fixture.detectChanges();
  };

  const opciones = (nombre: string) =>
    [...pagina.querySelectorAll(`select[name="${nombre}"] option`)].map((o) => o.textContent!.trim());

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppVehiculoActivo],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('consulta el vehículo activo al abrirse', () => {
    abrir();
    expect(pagina.textContent).toContain('Consultando su vehículo asignado');
    backend.expectOne(URL).flush({ asignacionId: 'a1', vehiculo: tracto, remolque: null });
  });

  it('CA 13: muestra solo el vehículo activo y su remolque acoplado', () => {
    abrir();
    responder({ asignacionId: 'a1', vehiculo: tracto, remolque: semi });

    expect(opciones('vehiculo')).toEqual(['TKM482 · Tractocamión Kenworth T800']);
    expect(opciones('remolque')).toEqual(['S00012 · Semirremolque Fruehauf X1']);
    expect(pagina.textContent).toContain('Semirremolque acoplado');
    expect(selecciones.at(-1)).toEqual({ vehiculoId: 'v1', remolqueId: 'r1' });
  });

  it('CA 13: sin remolque acoplado solo muestra el vehículo', () => {
    abrir();
    responder({ asignacionId: 'a1', vehiculo: tracto, remolque: null });

    expect(opciones('vehiculo')).toHaveLength(1);
    expect(pagina.querySelector('select[name="remolque"]')).toBeNull();
    expect(selecciones.at(-1)).toEqual({ vehiculoId: 'v1', remolqueId: null });
  });

  it('CA 14: sin vehículo activo indica que necesita un vehículo asignado y no deja continuar', () => {
    abrir();
    backend.expectOne(URL).flush(
      { codigo: 'SIN_VEHICULO_ACTIVO', mensaje: MENSAJE_SIN_VEHICULO },
      { status: 404, statusText: 'Not Found' },
    );
    fixture.detectChanges();

    expect(pagina.querySelector('[role="alert"]')?.textContent).toContain('Necesita un vehículo asignado');
    expect(pagina.querySelector('select')).toBeNull();
    expect(selecciones.every((s) => s === null)).toBe(true);
  });

  it('un error de red o del servidor se informa y permite reintentar, sin confundirlo con "sin vehículo"', () => {
    abrir();
    backend.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(pagina.querySelector('[role="alert"]')?.textContent).toContain('El servidor presentó un error');
    expect(pagina.textContent).not.toContain('Necesita un vehículo asignado');

    (pagina.querySelector('button') as HTMLButtonElement).click();
    responder({ asignacionId: 'a1', vehiculo: tracto, remolque: null });

    expect(opciones('vehiculo')).toHaveLength(1);
    expect(selecciones.at(-1)).toEqual({ vehiculoId: 'v1', remolqueId: null });
  });
});
