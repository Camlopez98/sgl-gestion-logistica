import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { Vehiculo } from '../../vehiculos/vehiculo.model';
import { AppFleetPage } from './fleet-page';

const URL = `${environment.apiUrl}/vehiculos`;

function vehiculo(datos: Partial<Vehiculo>): Vehiculo {
  return {
    id: 'v-' + (datos.placa ?? 'X'),
    placa: 'TKM482',
    tipo: 'TRACTOCAMION',
    marca: 'Kenworth',
    modelo: 'T800',
    numeroEjes: 3,
    capacidadCargaKg: 34000,
    estado: 'ACTIVO',
    createdAt: '',
    updatedAt: '',
    ...datos,
  };
}

describe('AppFleetPage', () => {
  let fixture: ComponentFixture<AppFleetPage>;
  let backend: HttpTestingController;
  let pagina: HTMLElement;

  const render = () => fixture.detectChanges();
  const filas = () =>
    [...pagina.querySelectorAll('.vehicle-row')].map((fila) =>
      [...fila.querySelectorAll('td')].map((celda) => celda.textContent!.replace(/\s+/g, ' ').trim()).join(' '),
    );
  const boton = (texto: string) =>
    [...pagina.querySelectorAll('button')].find((b) => b.textContent!.trim() === texto) as HTMLButtonElement;
  const clic = (elemento: HTMLElement) => {
    elemento.click();
    render();
  };

  function escribir(campo: string, valor: string) {
    const control = pagina.querySelector<HTMLInputElement | HTMLSelectElement>(`[formControlName="${campo}"]`)!;
    control.value = valor;
    control.dispatchEvent(new Event(control instanceof HTMLSelectElement ? 'change' : 'input'));
  }

  function llenar(datos: Record<string, string>) {
    for (const [campo, valor] of Object.entries(datos)) escribir(campo, valor);
    render();
  }

  const guardar = () => {
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
    render();
  };

  const datosValidos = { tipo: 'TRACTOCAMION', placa: 'tkm-482', marca: 'Kenworth', modelo: 'T800', numeroEjes: '3', capacidadCargaKg: '34000' };

  async function abrir(lista: Vehiculo[] = []) {
    fixture = TestBed.createComponent(AppFleetPage);
    pagina = fixture.nativeElement;
    render();
    backend.expectOne(URL).flush(lista);
    render();
  }

  function esperarRegistro(): TestRequest {
    return backend.expectOne((req) => req.url === URL && req.method === 'POST');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppFleetPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it('CA 6: lista los vehículos, incluidos los inactivos con su estado', async () => {
    await abrir([vehiculo({ placa: 'TKM482' }), vehiculo({ placa: 'HIN500', tipo: 'CAMION', estado: 'INACTIVO' })]);

    expect(filas()).toEqual([
      expect.stringContaining('TKM482 Tractocamión'),
      expect.stringContaining('HIN500 Camión'),
    ]);
    expect(filas()[1]).toContain('Inactivo');
    expect(pagina.querySelector('button[aria-label="Desactivar HIN500"]')).toBeNull();
    expect(pagina.textContent).toContain('Inactivos');
  });

  it('filtra por tipo y estado', async () => {
    await abrir([vehiculo({ placa: 'TKM482' }), vehiculo({ placa: 'R10001', tipo: 'REMOLQUE' })]);
    const [selectTipo] = pagina.querySelectorAll<HTMLSelectElement>('.fleet-filters select');

    selectTipo.value = 'REMOLQUE';
    selectTipo.dispatchEvent(new Event('change'));
    render();

    expect(filas()).toEqual([expect.stringContaining('R10001')]);
  });

  it('muestra el error de carga y permite reintentar', async () => {
    fixture = TestBed.createComponent(AppFleetPage);
    pagina = fixture.nativeElement;
    render();
    backend.expectOne(URL).flush({ codigo: 'ERROR_INTERNO', mensaje: '' }, { status: 500, statusText: 'Error' });
    render();

    expect(pagina.querySelector('.list-state.error')?.textContent).toContain('El servidor presentó un error');
    clic(boton('Reintentar'));
    backend.expectOne(URL).flush([]);
  });

  it('CA 3: con una placa que no corresponde al tipo no envía la solicitud e indica el formato', async () => {
    await abrir();
    clic(boton('+ Registrar Vehículo'));
    llenar({ ...datosValidos, placa: 'R12345' });
    guardar();

    backend.expectNone((req) => req.method === 'POST');
    expect(pagina.querySelector('.field-error')?.textContent).toContain('3 letras y 3 números');
  });

  it('CA 1 y 4: registra con la placa normalizada y una clave de idempotencia', async () => {
    await abrir();
    clic(boton('+ Registrar Vehículo'));
    llenar(datosValidos);
    expect(pagina.querySelector('.field-hint')?.textContent).toContain('Se guardará como TKM482');
    guardar();

    const peticion = esperarRegistro();
    expect(peticion.request.body).toEqual({
      placa: 'TKM482',
      tipo: 'TRACTOCAMION',
      marca: 'Kenworth',
      modelo: 'T800',
      numeroEjes: 3,
      capacidadCargaKg: 34000,
    });
    expect(peticion.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
    peticion.flush(vehiculo({ placa: 'TKM482' }), { status: 201, statusText: 'Created' });
    render();

    expect(pagina.querySelector('.vehicle-dialog')).toBeNull();
    expect(filas()).toEqual([expect.stringContaining('TKM482')]);
    expect(pagina.querySelector('.action-message')?.textContent).toContain('Vehículo TKM482 registrado.');
  });

  it('CA 2: muestra el rechazo por placa duplicada sin cerrar el formulario', async () => {
    await abrir();
    clic(boton('+ Registrar Vehículo'));
    llenar(datosValidos);
    guardar();

    esperarRegistro().flush(
      { codigo: 'PLACA_DUPLICADA', mensaje: 'La placa TKM482 ya está registrada.' },
      { status: 409, statusText: 'Conflict' },
    );
    render();

    expect(pagina.querySelector('.form-error')?.textContent).toContain('La placa TKM482 ya está registrada.');
    expect(pagina.querySelector('.save-button')?.textContent).toContain('Registrar vehículo');
  });

  it('CA 9: tras un error del servidor reintenta con la misma clave; con otros datos usa una clave nueva', async () => {
    await abrir();
    clic(boton('+ Registrar Vehículo'));
    llenar(datosValidos);
    guardar();

    const primera = esperarRegistro();
    const clave = primera.request.headers.get('Idempotency-Key');
    primera.flush({ codigo: 'ERROR_INTERNO', mensaje: '' }, { status: 500, statusText: 'Error' });
    render();
    expect(pagina.querySelector('.save-button')?.textContent).toContain('Reintentar');

    guardar();
    const reintento = esperarRegistro();
    expect(reintento.request.headers.get('Idempotency-Key')).toBe(clave);
    reintento.flush({ codigo: 'ERROR_INTERNO', mensaje: '' }, { status: 500, statusText: 'Error' });
    render();

    llenar({ modelo: 'T880' });
    guardar();
    const conCambios = esperarRegistro();
    expect(conCambios.request.headers.get('Idempotency-Key')).not.toBe(clave);
    conCambios.flush(vehiculo({ placa: 'TKM482', modelo: 'T880' }), { status: 201, statusText: 'Created' });
  });

  it('CA 5: edita un vehículo y muestra el rechazo si la placa pertenece a otro', async () => {
    await abrir([vehiculo({ placa: 'HIN500', tipo: 'CAMION', id: 'v-hin' })]);
    clic(pagina.querySelector<HTMLButtonElement>('button[aria-label="Editar HIN500"]')!);
    expect(pagina.querySelector<HTMLInputElement>('[formControlName="placa"]')!.value).toBe('HIN500');

    llenar({ placa: 'TKM482' });
    guardar();
    const peticion = backend.expectOne(`${URL}/v-hin`);
    expect(peticion.request.method).toBe('PUT');
    peticion.flush({ codigo: 'PLACA_DUPLICADA', mensaje: 'La placa TKM482 ya está registrada.' }, { status: 409, statusText: 'Conflict' });
    render();

    expect(pagina.querySelector('.form-error')?.textContent).toContain('ya está registrada');
  });

  it('CA 6: al desactivar, el vehículo sigue en el listado como inactivo', async () => {
    await abrir([vehiculo({ placa: 'TKM482', id: 'v-tkm' })]);
    clic(pagina.querySelector<HTMLButtonElement>('button[aria-label="Desactivar TKM482"]')!);
    expect(pagina.querySelector('.confirm-dialog')?.textContent).toContain('seguirá en el histórico');

    clic(pagina.querySelector<HTMLButtonElement>('.danger-button')!);
    backend.expectOne(`${URL}/v-tkm/desactivar`).flush(vehiculo({ placa: 'TKM482', id: 'v-tkm', estado: 'INACTIVO' }));
    render();

    expect(pagina.querySelector('.confirm-dialog')).toBeNull();
    expect(filas()[0]).toContain('Inactivo');
  });

  it('CA 7: muestra el rechazo cuando el vehículo está en un viaje activo', async () => {
    await abrir([vehiculo({ placa: 'TKM482', id: 'v-tkm' })]);
    clic(pagina.querySelector<HTMLButtonElement>('button[aria-label="Desactivar TKM482"]')!);
    clic(pagina.querySelector<HTMLButtonElement>('.danger-button')!);

    backend.expectOne(`${URL}/v-tkm/desactivar`).flush(
      { codigo: 'VEHICULO_EN_VIAJE_ACTIVO', mensaje: 'El vehículo TKM482 está en un viaje activo y no se puede desactivar.' },
      { status: 409, statusText: 'Conflict' },
    );
    render();

    expect(pagina.querySelector('.confirm-dialog .form-error')?.textContent).toContain('viaje activo');
    expect(filas()[0]).toContain('Activo');
  });
});
