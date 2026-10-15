import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import type { Asignacion, AsignacionDeHistorial, ConductorHabilitable } from '../../asignaciones/asignacion.model';
import { MENSAJE_SIN_INTERNET } from '../../core/http/mensaje-error';
import type { Vehiculo } from '../../vehiculos/vehiculo.model';
import { AppAssignmentsPage } from './assignments-page';

const URL = `${environment.apiUrl}/asignaciones`;
const URL_VEHICULOS = `${environment.apiUrl}/vehiculos`;

function asignacion(datos: Partial<Asignacion>): Asignacion {
  return {
    id: 'a1',
    conductorId: 'c1',
    conductorNombre: 'Ana Ruiz',
    conductorCedula: '2000000001',
    vehiculoId: 'v1',
    vehiculoPlaca: 'TKM482',
    vehiculoTipo: 'TRACTOCAMION',
    remolqueId: null,
    remolquePlaca: null,
    estado: 'HABILITADA',
    fechaAsignacion: '2026-10-14T14:00:00.000Z',
    fechaActivacion: null,
    fechaFinalizacion: null,
    version: 1,
    createdAt: '',
    updatedAt: '',
    ...datos,
  };
}

function vehiculo(datos: Partial<Vehiculo>): Vehiculo {
  return {
    id: 'x',
    placa: 'AAA111',
    tipo: 'CAMION',
    marca: 'Hino',
    modelo: '500',
    numeroEjes: 2,
    capacidadCargaKg: 8000,
    estado: 'ACTIVO',
    createdAt: '',
    updatedAt: '',
    ...datos,
  };
}

const conductores: ConductorHabilitable[] = [
  { id: 'c1', nombreCompleto: 'Ana Ruiz', cedula: '2000000001', categoriaLicencia: 'C3' },
  { id: 'c2', nombreCompleto: 'Beto Gómez', cedula: '2000000002', categoriaLicencia: 'C3' },
];

describe('AppAssignmentsPage', () => {
  let fixture: ComponentFixture<AppAssignmentsPage>;
  let backend: HttpTestingController;
  let pagina: HTMLElement;

  const render = () => fixture.detectChanges();
  const filas = () =>
    [...pagina.querySelectorAll('.assignment-row')].map((fila) =>
      [...fila.querySelectorAll('td')].map((celda) => celda.textContent!.replace(/\s+/g, ' ').trim()).join(' | '),
    );
  const boton = (texto: string) =>
    [...pagina.querySelectorAll('button')].find((b) => b.textContent!.trim() === texto) as HTMLButtonElement;
  /** Botón dentro del diálogo abierto (las filas de la tabla repiten textos como "Activar" o "Finalizar"). */
  const botonDelDialogo = (texto: string) =>
    [...pagina.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')].find(
      (b) => b.textContent!.trim() === texto,
    ) as HTMLButtonElement;
  const botonConNombre = (nombre: string) => pagina.querySelector<HTMLButtonElement>(`button[aria-label="${nombre}"]`)!;
  const clic = (elemento: HTMLElement) => {
    elemento.click();
    render();
  };
  const elegir = (nombre: string, valor: string) => {
    const select = pagina.querySelector<HTMLSelectElement>(`select[name="${nombre}"]`)!;
    select.value = valor;
    select.dispatchEvent(new Event('change'));
    render();
  };
  const opciones = (nombre: string) =>
    [...pagina.querySelectorAll(`select[name="${nombre}"] option`)].map((o) => o.textContent!.replace(/\s+/g, ' ').trim());
  const dialogo = () => pagina.querySelector('[role="dialog"], [role="alertdialog"]');
  const enviarFormulario = () => {
    pagina.querySelector('form')!.dispatchEvent(new Event('submit'));
    render();
  };

  async function abrir(lista: Asignacion[] = []) {
    fixture = TestBed.createComponent(AppAssignmentsPage);
    pagina = fixture.nativeElement;
    render();
    backend.expectOne(URL).flush(lista);
    render();
  }

  /** Abre el diálogo de habilitar y responde los dos catálogos. */
  function abrirHabilitar(vehiculos: Vehiculo[]) {
    clic(boton('+ Habilitar Vehículo'));
    backend.expectOne(`${URL}/conductores`).flush(conductores);
    backend.expectOne((req) => req.url === URL_VEHICULOS && req.params.get('estado') === 'ACTIVO').flush(vehiculos);
    render();
  }

  function esperarHabilitar(): TestRequest {
    return backend.expectOne((req) => req.url === URL && req.method === 'POST');
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AppAssignmentsPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    backend.verify();
    vi.restoreAllMocks();
  });

  describe('listado', () => {
    it('muestra las asignaciones vigentes con sus fechas y oculta las finalizadas', async () => {
      await abrir([
        asignacion({ id: 'a1' }),
        asignacion({ id: 'a2', conductorNombre: 'Beto Gómez', vehiculoPlaca: 'ABC123', estado: 'ACTIVA', fechaActivacion: '2026-10-14T15:00:00.000Z', remolqueId: 'r1', remolquePlaca: 'S00012' }),
        asignacion({ id: 'a3', vehiculoPlaca: 'OLD999', estado: 'FINALIZADA', fechaFinalizacion: '2026-10-10T12:00:00.000Z' }),
      ]);

      expect(filas()).toHaveLength(2);
      expect(filas()[0]).toContain('Ana Ruiz');
      expect(filas()[0]).toContain('Habilitada');
      expect(filas()[1]).toContain('S00012');
      expect(filas()[1]).toContain('Activa');
      expect(pagina.textContent).not.toContain('OLD999');
    });

    it('el filtro "Todas" incluye las finalizadas y el de estado las separa', async () => {
      await abrir([asignacion({ id: 'a1' }), asignacion({ id: 'a3', vehiculoPlaca: 'OLD999', estado: 'FINALIZADA', fechaFinalizacion: '2026-10-10T12:00:00.000Z' })]);
      const filtro = pagina.querySelector<HTMLSelectElement>('.fleet-filters select')!;

      filtro.value = 'TODAS';
      filtro.dispatchEvent(new Event('change'));
      render();
      expect(filas()).toHaveLength(2);

      filtro.value = 'FINALIZADA';
      filtro.dispatchEvent(new Event('change'));
      render();
      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toContain('OLD999');
    });

    it('busca por conductor o placa', async () => {
      await abrir([asignacion({ id: 'a1' }), asignacion({ id: 'a2', conductorNombre: 'Beto Gómez', vehiculoPlaca: 'ABC123' })]);
      const buscador = pagina.querySelector<HTMLInputElement>('input[type="search"]')!;

      buscador.value = 'beto';
      buscador.dispatchEvent(new Event('input'));
      render();

      expect(filas()).toHaveLength(1);
      expect(filas()[0]).toContain('Beto Gómez');
    });

    it('resume cuántas están activas, habilitadas y finalizadas', async () => {
      await abrir([
        asignacion({ id: 'a1' }),
        asignacion({ id: 'a2', estado: 'ACTIVA', fechaActivacion: '2026-10-14T15:00:00.000Z' }),
        asignacion({ id: 'a3', estado: 'FINALIZADA', fechaFinalizacion: '2026-10-10T12:00:00.000Z' }),
      ]);

      const valores = [...pagina.querySelectorAll('app-card')].map((c) => c.textContent!.replace(/\s+/g, ' ').trim());
      expect(valores[0]).toContain('Activas');
      expect(valores[0]).toContain('1');
      expect(valores[1]).toContain('Habilitadas');
      expect(valores[2]).toContain('Finalizadas');
    });

    it('informa si no hay asignaciones y si el servidor falla permite reintentar', async () => {
      fixture = TestBed.createComponent(AppAssignmentsPage);
      pagina = fixture.nativeElement;
      render();
      backend.expectOne(URL).flush({}, { status: 500, statusText: 'Server Error' });
      render();
      expect(pagina.querySelector('.list-state.error')?.textContent).toContain('El servidor presentó un error');

      clic(boton('Reintentar'));
      backend.expectOne(URL).flush([]);
      render();
      expect(pagina.textContent).toContain('Aún no hay vehículos habilitados a conductores');
    });
  });

  describe('habilitar', () => {
    it('CA 1: habilita un vehículo a un conductor enviando una clave de idempotencia', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1', placa: 'TKM482', tipo: 'TRACTOCAMION' })]);

      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      enviarFormulario();

      const peticion = esperarHabilitar();
      expect(peticion.request.body).toEqual({ conductorId: 'c1', vehiculoId: 'v1' });
      expect(peticion.request.headers.get('Idempotency-Key')).toMatch(/^[0-9a-f-]{36}$/);
      peticion.flush(asignacion({ id: 'nueva' }), { status: 201, statusText: 'Created' });
      render();

      expect(dialogo()).toBeNull();
      expect(filas()).toHaveLength(1);
      expect(pagina.querySelector('.action-message')?.textContent).toContain('Vehículo TKM482 habilitado a Ana Ruiz');
    });

    it('solo ofrece automotores: no lista remolques ni semirremolques', async () => {
      await abrir([]);
      abrirHabilitar([
        vehiculo({ id: 'v1', placa: 'TKM482', tipo: 'TRACTOCAMION' }),
        vehiculo({ id: 'v2', placa: 'R00001', tipo: 'REMOLQUE' }),
        vehiculo({ id: 'v3', placa: 'S00001', tipo: 'SEMIRREMOLQUE' }),
        vehiculo({ id: 'v4', placa: 'FUR123', tipo: 'FURGON' }),
      ]);

      const texto = opciones('vehiculo').join(' ');
      expect(texto).toContain('TKM482');
      expect(texto).toContain('FUR123');
      expect(texto).not.toContain('R00001');
      expect(texto).not.toContain('S00001');
    });

    it('pide elegir conductor y vehículo antes de enviar', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' })]);

      enviarFormulario();

      backend.expectNone((req) => req.method === 'POST');
      expect(pagina.textContent).toContain('Seleccione un conductor.');
      expect(pagina.textContent).toContain('Seleccione un vehículo.');
    });

    it('CA 2: si ya existe la asignación, muestra la advertencia del servidor y no agrega otra fila', async () => {
      await abrir([asignacion({ id: 'a1' })]);
      abrirHabilitar([vehiculo({ id: 'v1', placa: 'TKM482' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      enviarFormulario();

      esperarHabilitar().flush(
        { codigo: 'ASIGNACION_DUPLICADA', mensaje: 'Ya existe una asignación vigente del vehículo TKM482 a Ana Ruiz.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(pagina.querySelector('.form-error')?.textContent).toContain('Ya existe una asignación vigente');
      expect(botonDelDialogo('Habilitar vehículo')).toBeTruthy(); // es un error de datos: no ofrece "Reintentar"
      expect(filas()).toHaveLength(1);
    });

    it('CA 3: muestra el motivo cuando el vehículo o el conductor están inactivos', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      enviarFormulario();

      esperarHabilitar().flush(
        { codigo: 'VEHICULO_INACTIVO', mensaje: 'El vehículo AAA111 está inactivo y no se puede habilitar ni activar.' },
        { status: 422, statusText: 'Unprocessable' },
      );
      render();

      expect(pagina.querySelector('.form-error')?.textContent).toContain('está inactivo');
    });

    it('CA 16: sin conexión informa y no envía nada, así no queda una asignación parcial', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);

      enviarFormulario();

      backend.expectNone((req) => req.method === 'POST');
      expect(pagina.querySelector('.form-error')?.textContent).toContain(MENSAJE_SIN_INTERNET);
      expect(filas()).toHaveLength(0);
      expect(dialogo()).not.toBeNull(); // conserva lo elegido para reintentar al volver la conexión
    });

    it('CA 17: tras un fallo del servidor, el reintento usa la misma clave de idempotencia', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      enviarFormulario();

      const primera = esperarHabilitar();
      const clave = primera.request.headers.get('Idempotency-Key');
      primera.flush({}, { status: 500, statusText: 'Server Error' });
      render();
      expect(pagina.querySelector('.form-error')?.textContent).toContain('El servidor presentó un error');

      clic(botonDelDialogo('Reintentar'));
      const reintento = esperarHabilitar();
      expect(reintento.request.headers.get('Idempotency-Key')).toBe(clave);
      reintento.flush(asignacion({ id: 'nueva' }), { status: 201, statusText: 'Created' });
      render();

      expect(filas()).toHaveLength(1);
    });

    it('CA 17: si el administrador cambia los datos, usa una clave nueva', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' }), vehiculo({ id: 'v2', placa: 'BBB222' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');
      enviarFormulario();
      const primera = esperarHabilitar();
      const clave = primera.request.headers.get('Idempotency-Key');
      primera.flush({}, { status: 500, statusText: 'Server Error' });
      render();

      elegir('vehiculo', 'v2');
      enviarFormulario();

      expect(esperarHabilitar().request.headers.get('Idempotency-Key')).not.toBe(clave);
    });

    it('no envía dos veces mientras guarda', async () => {
      await abrir([]);
      abrirHabilitar([vehiculo({ id: 'v1' })]);
      elegir('conductor', 'c1');
      elegir('vehiculo', 'v1');

      enviarFormulario();
      enviarFormulario();

      expect(backend.match((req) => req.method === 'POST')).toHaveLength(1);
    });
  });

  describe('activar', () => {
    it('CA 7 y 10: activa un tractocamión con un semirremolque disponible y recarga el listado', async () => {
      await abrir([asignacion({ id: 'a1', version: 4 })]);

      clic(botonConNombre('Activar TKM482 para Ana Ruiz'));
      const catalogo = backend.expectOne((req) => req.url === URL_VEHICULOS && req.params.get('tipo') === 'SEMIRREMOLQUE');
      expect(catalogo.request.params.get('estado')).toBe('ACTIVO');
      catalogo.flush([vehiculo({ id: 'r1', placa: 'S00012', tipo: 'SEMIRREMOLQUE', marca: 'Fruehauf', modelo: 'X1' })]);
      render();
      elegir('remolque', 'r1');
      clic(botonDelDialogo('Activar'));

      const peticion = backend.expectOne(`${URL}/a1/activar`);
      expect(peticion.request.method).toBe('PATCH');
      expect(peticion.request.body).toEqual({ idRemolque: 'r1', version: 4 });
      peticion.flush(asignacion({ id: 'a1', estado: 'ACTIVA', remolqueId: 'r1', remolquePlaca: 'S00012', version: 5 }));
      render();

      expect(dialogo()).toBeNull();
      expect(pagina.querySelector('.action-message')?.textContent).toContain('Vehículo TKM482 activo para Ana Ruiz');
      backend.expectOne(URL).flush([asignacion({ id: 'a1', estado: 'ACTIVA', remolqueId: 'r1', remolquePlaca: 'S00012', version: 5, fechaActivacion: '2026-10-14T15:00:00.000Z' })]);
      render();
      expect(filas()[0]).toContain('Activa');
      expect(filas()[0]).toContain('S00012');
    });

    it('activa sin remolque enviando idRemolque nulo', async () => {
      await abrir([asignacion({ id: 'a1', vehiculoTipo: 'CAMION', vehiculoPlaca: 'CAM123' })]);

      clic(botonConNombre('Activar CAM123 para Ana Ruiz'));
      backend.expectOne((req) => req.url === URL_VEHICULOS && req.params.get('tipo') === 'REMOLQUE').flush([]);
      render();
      clic(botonDelDialogo('Activar'));

      expect(backend.expectOne(`${URL}/a1/activar`).request.body).toEqual({ idRemolque: null, version: 1 });
    });

    it('CA 11: un furgón no admite acople y no ofrece remolques', async () => {
      await abrir([asignacion({ id: 'a1', vehiculoTipo: 'FURGON', vehiculoPlaca: 'FUR123' })]);

      clic(botonConNombre('Activar FUR123 para Ana Ruiz'));

      backend.expectNone((req) => req.url === URL_VEHICULOS);
      expect(pagina.querySelector('select[name="remolque"]')).toBeNull();
      expect(pagina.textContent).toContain('no admite remolque ni semirremolque');
    });

    it('CA 12: no ofrece un semirremolque que está acoplado en la asignación activa de otro conductor', async () => {
      await abrir([
        asignacion({ id: 'a1', conductorId: 'c1' }),
        asignacion({ id: 'a2', conductorId: 'c2', conductorNombre: 'Beto Gómez', vehiculoPlaca: 'ABC123', estado: 'ACTIVA', remolqueId: 'r1', remolquePlaca: 'S00001', fechaActivacion: '2026-10-14T15:00:00.000Z' }),
      ]);

      clic(botonConNombre('Activar TKM482 para Ana Ruiz'));
      backend
        .expectOne((req) => req.url === URL_VEHICULOS && req.params.get('tipo') === 'SEMIRREMOLQUE')
        .flush([
          vehiculo({ id: 'r1', placa: 'S00001', tipo: 'SEMIRREMOLQUE' }),
          vehiculo({ id: 'r2', placa: 'S00002', tipo: 'SEMIRREMOLQUE' }),
        ]);
      render();

      const lista = opciones('remolque').join(' ');
      expect(lista).toContain('S00002');
      expect(lista).not.toContain('S00001');
    });

    it('CA 9: con un viaje activo muestra el motivo en el diálogo y no cambia nada', async () => {
      await abrir([asignacion({ id: 'a1', vehiculoTipo: 'FURGON', vehiculoPlaca: 'FUR123' })]);
      clic(botonConNombre('Activar FUR123 para Ana Ruiz'));
      clic(botonDelDialogo('Activar'));

      backend.expectOne(`${URL}/a1/activar`).flush(
        { codigo: 'VIAJE_ACTIVO', mensaje: 'El conductor tiene un viaje activo: no se puede cambiar su vehículo hasta que el viaje se reporte como entregado.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(dialogo()).not.toBeNull();
      expect(pagina.querySelector('.form-error')?.textContent).toContain('viaje activo');
      backend.expectNone(URL);
    });

    it('CA 8: si el vehículo está activo con otro conductor, el servidor indica con cuál', async () => {
      await abrir([asignacion({ id: 'a1', vehiculoTipo: 'FURGON', vehiculoPlaca: 'FUR123' })]);
      clic(botonConNombre('Activar FUR123 para Ana Ruiz'));
      clic(botonDelDialogo('Activar'));

      backend.expectOne(`${URL}/a1/activar`).flush(
        { codigo: 'VEHICULO_ACTIVO_CON_OTRO_CONDUCTOR', mensaje: 'El vehículo FUR123 ya está activo con Beto Gómez.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(pagina.querySelector('.form-error')?.textContent).toContain('Beto Gómez');
    });

    it('CA 19: si otro administrador ya modificó la asignación, avisa, cierra el diálogo y recarga', async () => {
      await abrir([asignacion({ id: 'a1', vehiculoTipo: 'FURGON', vehiculoPlaca: 'FUR123' })]);
      clic(botonConNombre('Activar FUR123 para Ana Ruiz'));
      clic(botonDelDialogo('Activar'));

      backend.expectOne(`${URL}/a1/activar`).flush(
        { codigo: 'ASIGNACION_MODIFICADA', mensaje: 'La asignación fue modificada por otro administrador. Recargue la información e intente de nuevo.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(dialogo()).toBeNull();
      expect(pagina.querySelector('.warning-message')?.textContent).toContain('Recargue la información');
      backend.expectOne(URL).flush([asignacion({ id: 'a1', estado: 'ACTIVA', version: 2, fechaActivacion: '2026-10-14T15:00:00.000Z' })]);
      render();
      expect(filas()[0]).toContain('Activa');
    });

    it('en una asignación activa permite cambiar el acople', async () => {
      await abrir([asignacion({ id: 'a1', estado: 'ACTIVA', remolqueId: 'r1', remolquePlaca: 'S00001', version: 2, fechaActivacion: '2026-10-14T15:00:00.000Z' })]);

      expect(botonConNombre('Cambiar el acople de TKM482')).toBeTruthy();
      expect(pagina.querySelector('button[aria-label^="Activar"]')).toBeNull();
    });
  });

  describe('finalizar', () => {
    it('CA 4: finaliza con confirmación, conserva el registro y lo mueve a finalizadas', async () => {
      await abrir([asignacion({ id: 'a1', version: 3 })]);

      clic(botonConNombre('Finalizar TKM482 de Ana Ruiz'));
      expect(pagina.textContent).toContain('El registro se conserva en el historial');
      clic(botonDelDialogo('Finalizar'));

      const peticion = backend.expectOne(`${URL}/a1/finalizar`);
      expect(peticion.request.method).toBe('PATCH');
      expect(peticion.request.body).toEqual({ version: 3 });
      peticion.flush(asignacion({ id: 'a1', estado: 'FINALIZADA', version: 4, fechaFinalizacion: '2026-10-14T16:00:00.000Z' }));
      render();

      expect(dialogo()).toBeNull();
      expect(filas()).toHaveLength(0); // ya no es vigente...
      expect(pagina.querySelector('.action-message')?.textContent).toContain('finalizada');
      const filtro = pagina.querySelector<HTMLSelectElement>('.fleet-filters select')!;
      filtro.value = 'FINALIZADA';
      filtro.dispatchEvent(new Event('change'));
      render();
      expect(filas()).toHaveLength(1); // ...pero sigue en el listado
    });

    it('CA 5: con un viaje activo muestra el motivo y la asignación sigue vigente', async () => {
      await abrir([asignacion({ id: 'a1', estado: 'ACTIVA', fechaActivacion: '2026-10-14T15:00:00.000Z' })]);
      clic(botonConNombre('Finalizar TKM482 de Ana Ruiz'));
      clic(botonDelDialogo('Finalizar'));

      backend.expectOne(`${URL}/a1/finalizar`).flush(
        { codigo: 'VIAJE_ACTIVO', mensaje: 'El conductor tiene un viaje activo con el vehículo TKM482: no se puede finalizar la asignación.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(dialogo()).not.toBeNull();
      expect(pagina.querySelector('.form-error')?.textContent).toContain('viaje activo');
      expect(filas()).toHaveLength(1);
    });

    it('CA 19: si otro administrador ya la modificó, avisa y recarga', async () => {
      await abrir([asignacion({ id: 'a1' })]);
      clic(botonConNombre('Finalizar TKM482 de Ana Ruiz'));
      clic(botonDelDialogo('Finalizar'));

      backend.expectOne(`${URL}/a1/finalizar`).flush(
        { codigo: 'ASIGNACION_MODIFICADA', mensaje: 'La asignación fue modificada por otro administrador. Recargue la información e intente de nuevo.' },
        { status: 409, statusText: 'Conflict' },
      );
      render();

      expect(dialogo()).toBeNull();
      expect(pagina.querySelector('.warning-message')).not.toBeNull();
      backend.expectOne(URL).flush([asignacion({ id: 'a1', version: 2 })]);
    });

    it('cancelar no envía nada', async () => {
      await abrir([asignacion({ id: 'a1' })]);
      clic(botonConNombre('Finalizar TKM482 de Ana Ruiz'));

      clic(botonDelDialogo('Cancelar'));

      expect(dialogo()).toBeNull();
      backend.expectNone(`${URL}/a1/finalizar`);
    });

    it('una asignación finalizada ya no ofrece activar ni finalizar, solo el historial', async () => {
      await abrir([asignacion({ id: 'a1', estado: 'FINALIZADA', fechaFinalizacion: '2026-10-10T12:00:00.000Z' })]);
      const filtro = pagina.querySelector<HTMLSelectElement>('.fleet-filters select')!;
      filtro.value = 'TODAS';
      filtro.dispatchEvent(new Event('change'));
      render();

      const acciones = [...pagina.querySelectorAll('.assignment-row .row-button')].map((b) => b.textContent!.trim());
      expect(acciones).toEqual(['Historial']);
    });
  });

  describe('historial del vehículo (CA 6)', () => {
    const registro = (datos: Partial<AsignacionDeHistorial>): AsignacionDeHistorial => ({
      ...asignacion({}),
      rolEnAsignacion: 'VEHICULO',
      ...datos,
    });

    it('muestra todos los conductores que lo han tenido, con sus fechas de inicio y fin', async () => {
      await abrir([asignacion({ id: 'a1' })]);

      clic(botonConNombre('Historial de TKM482'));
      backend.expectOne(`${URL_VEHICULOS}/v1/asignaciones`).flush([
        registro({ id: 'h1', conductorNombre: 'Beto Gómez', estado: 'FINALIZADA', fechaAsignacion: '2026-09-01T10:00:00.000Z', fechaFinalizacion: '2026-09-30T10:00:00.000Z' }),
        registro({ id: 'h2', conductorNombre: 'Ana Ruiz', estado: 'ACTIVA', fechaAsignacion: '2026-10-01T10:00:00.000Z' }),
      ]);
      render();

      const filasHistorial = [...pagina.querySelectorAll('.history-row')].map((f) => f.textContent!.replace(/\s+/g, ' ').trim());
      expect(filasHistorial).toHaveLength(2);
      expect(filasHistorial[0]).toContain('Beto Gómez');
      expect(filasHistorial[0]).toContain('Finalizada');
      expect(filasHistorial[0]).toMatch(/30\/09\/2026/);
      expect(filasHistorial[1]).toContain('Vigente');
    });

    it('indica cuando el vehículo se acopló como remolque y cuando nunca se asignó', async () => {
      await abrir([asignacion({ id: 'a1' })]);
      clic(botonConNombre('Historial de TKM482'));
      backend.expectOne(`${URL_VEHICULOS}/v1/asignaciones`).flush([registro({ id: 'h1', rolEnAsignacion: 'REMOLQUE' })]);
      render();
      expect(pagina.querySelector('.history-row')?.textContent).toContain('Remolque acoplado');

      clic(pagina.querySelector<HTMLButtonElement>('button[aria-label="Cerrar historial"]')!);
      expect(dialogo()).toBeNull();

      clic(botonConNombre('Historial de TKM482'));
      backend.expectOne(`${URL_VEHICULOS}/v1/asignaciones`).flush([]);
      render();
      expect(pagina.textContent).toContain('aún no ha sido asignado a ningún conductor');
    });

    it('si falla la consulta permite reintentar', async () => {
      await abrir([asignacion({ id: 'a1' })]);
      clic(botonConNombre('Historial de TKM482'));
      backend.expectOne(`${URL_VEHICULOS}/v1/asignaciones`).flush({}, { status: 500, statusText: 'Server Error' });
      render();
      expect(pagina.querySelector('.dialog-state.error')).not.toBeNull();

      clic(botonDelDialogo('Reintentar'));
      backend.expectOne(`${URL_VEHICULOS}/v1/asignaciones`).flush([]);
    });
  });
});
