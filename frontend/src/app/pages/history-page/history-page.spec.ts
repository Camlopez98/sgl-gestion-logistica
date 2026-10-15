import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { formatearFechaHora } from '../../historial/formato';
import { PREFIJO_ALMACEN } from '../../historial/historial-almacen';
import { HistorialCache } from '../../historial/historial-cache';
import type { DetalleDeViaje, PaginaHistorial, ViajeDeLista } from '../../historial/viaje.model';
import { iniciarSesionDePrueba } from '../../testing/sesion-prueba';
import { AppHistoryPage } from './history-page';

const URL = `${environment.apiUrl}/conductores/me/viajes`;

function viaje(n: number, extra: Partial<ViajeDeLista> = {}): ViajeDeLista {
  return {
    id: `v${n}`,
    estado: 'FINALIZADO',
    origen: `Origen ${n}`,
    destino: `Destino ${n}`,
    valorFlete: 1_000_000 + n,
    fechaInicio: `2026-09-${String(28 - n).padStart(2, '0')}T15:00:00Z`,
    placaVehiculo: 'TKM482',
    totalGastos: 0,
    ...extra,
  };
}

const viajes = (desde: number, hasta: number) => Array.from({ length: hasta - desde + 1 }, (_, i) => viaje(desde + i));

function pagina(items: ViajeDeLista[], siguienteCursor: string | null = null, total = items.length): PaginaHistorial {
  return { items, siguienteCursor, total };
}

function detalle(n: number, extra: Partial<DetalleDeViaje> = {}): DetalleDeViaje {
  return {
    ...viaje(n),
    fechaEntrega: '2026-09-29T20:30:00Z',
    placaRemolque: 'S12345',
    manifiesto: {
      numeroManifiesto: 'MAN-0001',
      urlImagen: 'https://archivos.sgl.test/manifiestos/man-0001.jpg',
      tipoMime: 'image/jpeg',
      fechaCarga: '2026-09-28T12:00:00Z',
    },
    gastos: [
      { id: 'g1', tipo: 'PEAJE', monto: 45_000, concepto: 'Peaje Chusacá', urlSoporte: null, createdAt: '2026-09-28T16:00:00Z' },
      { id: 'g2', tipo: 'COMBUSTIBLE', monto: 300_000, concepto: 'Tanqueo', urlSoporte: null, createdAt: '2026-09-28T17:00:00Z' },
    ],
    totalGastos: 345_000,
    ...extra,
  };
}

describe('AppHistoryPage', () => {
  let fixture: ComponentFixture<AppHistoryPage>;
  let backend: HttpTestingController;
  let cache: HistorialCache;
  let pantalla: HTMLElement;

  const render = () => fixture.detectChanges();
  /** Los espacios que usa Intl entre "a." y "m." son especiales: se comparan todos como un espacio normal. */
  const plano = (valor: string) => valor.replace(/\s+/g, ' ').trim();
  const texto = () => plano(pantalla.textContent!);
  const tarjetas = () => [...pantalla.querySelectorAll<HTMLElement>('.trip-card')];
  const origenes = () => tarjetas().map((t) => t.querySelector('.trip-route')!.textContent!.split('→')[0].trim());
  const boton = (nombre: string) =>
    [...pantalla.querySelectorAll('button')].find((b) => b.textContent!.trim() === nombre) as HTMLButtonElement | undefined;
  const clic = (elemento: HTMLElement | undefined) => {
    expect(elemento, 'el elemento existe').toBeTruthy();
    elemento!.click();
    render();
  };

  const lista = (cursor: string | null = null): TestRequest =>
    backend.expectOne((req) => req.url === URL && (req.params.get('cursor') ?? null) === cursor);
  const sinConexion = (peticion: TestRequest) => peticion.error(new ProgressEvent('error'), { status: 0 });

  function montar(): void {
    fixture = TestBed.createComponent(AppHistoryPage);
    pantalla = fixture.nativeElement as HTMLElement;
    render();
  }

  /** Abre la pantalla y responde el primer bloque. */
  function abrirCon(respuesta: PaginaHistorial): void {
    montar();
    lista().flush(respuesta);
    render();
  }

  function filtrar(valores: { estado?: string; desde?: string; hasta?: string }): void {
    const campo = (nombre: string) => pantalla.querySelector<HTMLInputElement | HTMLSelectElement>(`[name="${nombre}"]`)!;
    if (valores.estado !== undefined) {
      campo('estado').value = valores.estado;
      campo('estado').dispatchEvent(new Event('change'));
    }
    for (const nombre of ['desde', 'hasta'] as const) {
      if (valores[nombre] !== undefined) {
        campo(nombre).value = valores[nombre]!;
        campo(nombre).dispatchEvent(new Event('input'));
      }
    }
    pantalla.querySelector('form')!.dispatchEvent(new Event('submit'));
    render();
  }

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    iniciarSesionDePrueba('CONDUCTOR');
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    backend = TestBed.inject(HttpTestingController);
    cache = TestBed.inject(HistorialCache);
  });

  afterEach(() => {
    backend.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('Consulta del historial', () => {
    it('CA 1 y 2: pide solo los 5 más recientes, sin identificar al conductor, y muestra "Ver más"', () => {
      montar();
      const peticion = lista();
      expect(peticion.request.params.get('limite')).toBe('5');
      expect([...peticion.request.params.keys()].sort()).toEqual(['limite']);
      peticion.flush(pagina(viajes(1, 5), 'c1', 12));
      render();

      expect(tarjetas()).toHaveLength(5);
      expect(origenes()).toEqual(['Origen 1', 'Origen 2', 'Origen 3', 'Origen 4', 'Origen 5']);
      expect(texto()).toContain('Mostrando 5 de 12 viajes');
      expect(boton('Ver más')).toBeTruthy();
    });

    it('CA 2: la tarjeta muestra fecha, estado, ruta, flete y placa', () => {
      abrirCon(pagina([viaje(1, { estado: 'PENDIENTE_REVISION', valorFlete: 3_200_000, placaVehiculo: 'ABC123' })]));

      const tarjeta = tarjetas()[0].textContent!.replace(/\s+/g, ' ');
      expect(tarjeta).toContain('Origen 1 → Destino 1');
      expect(tarjeta).toContain('En revisión');
      expect(tarjeta).toMatch(/3\.200\.000/);
      expect(tarjeta).toContain('ABC123');
    });

    it('CA 2: con 5 viajes o menos no ofrece "Ver más"', () => {
      abrirCon(pagina(viajes(1, 5), null, 5));

      expect(boton('Ver más')).toBeUndefined();
    });

    it('CA 3: "Ver más" agrega el siguiente bloque con el cursor, en orden y sin repetir los ya mostrados', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      clic(boton('Ver más'));
      const segunda = lista('c1');
      expect(segunda.request.params.get('limite')).toBe('5');
      // El servidor repite por error un viaje ya mostrado: no debe duplicarse.
      segunda.flush(pagina([viaje(5), ...viajes(6, 10)], 'c2', 12));
      render();

      expect(origenes()).toEqual(Array.from({ length: 10 }, (_, i) => `Origen ${i + 1}`));
      expect(texto()).toContain('Mostrando 10 de 12 viajes');
      expect(boton('Ver más')).toBeTruthy();

      clic(boton('Ver más'));
      lista('c2').flush(pagina(viajes(11, 12), null, 12));
      render();
      expect(tarjetas()).toHaveLength(12);
      expect(boton('Ver más')).toBeUndefined();
    });

    it('CA 3: mientras carga el siguiente bloque, un segundo clic no pide el bloque dos veces', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      clic(boton('Ver más'));
      const pendiente = lista('c1');
      expect(boton('Cargando…')?.disabled).toBe(true);
      boton('Cargando…')!.click();
      pendiente.flush(pagina(viajes(6, 10), null, 10));
      render();

      expect(tarjetas()).toHaveLength(10);
    });

    it('CA 4: sin viajes registrados muestra un mensaje, no una lista vacía', () => {
      abrirCon(pagina([], null, 0));

      expect(texto()).toContain('Todavía no tiene viajes registrados.');
      expect(pantalla.querySelector('.trip-list')).toBeNull();
      expect(boton('Ver más')).toBeUndefined();
    });
  });

  describe('Filtros', () => {
    it('CA 5: filtra por estado y rango de fechas al confirmar, desde el primer bloque', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      filtrar({ estado: 'FINALIZADO', desde: '2026-09-01', hasta: '2026-09-30' });
      const peticion = lista();
      expect(peticion.request.params.get('estado')).toBe('FINALIZADO');
      expect(peticion.request.params.get('desde')).toBe('2026-09-01');
      expect(peticion.request.params.get('hasta')).toBe('2026-09-30');
      peticion.flush(pagina([viaje(7)], null, 1));
      render();

      expect(origenes()).toEqual(['Origen 7']);
      expect(texto()).toContain('Mostrando 1 de 1 viajes');
    });

    it('CA 5: los filtros no se envían hasta confirmarlos', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      const estado = pantalla.querySelector<HTMLSelectElement>('[name="estado"]')!;
      estado.value = 'ACTIVO';
      estado.dispatchEvent(new Event('change'));
      render();

      backend.expectNone(() => true);
    });

    it('CA 5: "Ver más" mantiene los filtros aplicados', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));
      filtrar({ estado: 'ACTIVO' });
      lista().flush(pagina(viajes(1, 5), 'c9', 8));
      render();

      clic(boton('Ver más'));
      const siguiente = lista('c9');

      expect(siguiente.request.params.get('estado')).toBe('ACTIVO');
      siguiente.flush(pagina(viajes(6, 8), null, 8));
    });

    it('CA 5: un filtro sin coincidencias lo dice, distinto de "no tiene viajes"', () => {
      abrirCon(pagina(viajes(1, 2)));
      filtrar({ estado: 'ACTIVO' });
      lista().flush(pagina([], null, 0));
      render();

      expect(texto()).toContain('No hay viajes que cumplan los filtros aplicados.');
      expect(texto()).not.toContain('Todavía no tiene viajes');
    });

    it('CA 5: no consulta con un rango de fechas invertido y lo explica', () => {
      abrirCon(pagina(viajes(1, 2)));

      filtrar({ desde: '2026-10-10', hasta: '2026-10-01' });

      backend.expectNone(() => true);
      expect(pantalla.querySelector('[role="alert"]')!.textContent).toContain('La fecha inicial no puede ser posterior');
      expect(tarjetas()).toHaveLength(2);
    });

    it('"Limpiar" quita los filtros y vuelve a pedir los viajes más recientes', () => {
      abrirCon(pagina(viajes(1, 2)));
      filtrar({ estado: 'ACTIVO', desde: '2026-09-01' });
      lista().flush(pagina([], null, 0));
      render();

      clic(boton('Limpiar'));
      const peticion = lista();

      expect([...peticion.request.params.keys()]).toEqual(['limite']);
      peticion.flush(pagina(viajes(1, 2)));
      render();
      expect(tarjetas()).toHaveLength(2);
      expect(boton('Limpiar')).toBeUndefined();
    });

    it('un filtro nuevo cancela la carga anterior que seguía en curso', () => {
      montar();
      const primera = lista();

      filtrar({ estado: 'ACTIVO' });
      const segunda = lista();
      segunda.flush(pagina([viaje(3)], null, 1));
      render();

      expect(primera.cancelled).toBe(true);
      expect(origenes()).toEqual(['Origen 3']);
    });
  });

  describe('Detalle del viaje', () => {
    function abrirDetalleDe(n: number, respuesta: DetalleDeViaje = detalle(n)): HTMLElement {
      abrirCon(pagina(viajes(1, 3), null, 3));
      clic(tarjetas()[n - 1]);
      backend.expectOne(`${URL}/v${n}`).flush(respuesta);
      render();
      return pantalla.querySelector<HTMLElement>('[role="dialog"]')!;
    }

    it('CA 6: muestra estado, origen, destino, flete, fechas, foto del manifiesto y gastos de ruta', () => {
      const hoja = abrirDetalleDe(2);
      const contenido = hoja.textContent!.replace(/\s+/g, ' ');

      expect(contenido).toContain('Finalizado');
      expect(contenido).toContain('Origen 2');
      expect(contenido).toContain('Destino 2');
      expect(contenido).toMatch(/1\.000\.002/);
      expect(contenido).toContain(plano(formatearFechaHora('2026-09-26T15:00:00Z'))); // inicio
      expect(contenido).toContain(plano(formatearFechaHora('2026-09-29T20:30:00Z'))); // entrega
      expect(contenido).toContain('S12345');
      expect(contenido).toContain('Manifiesto MAN-0001');
      const foto = hoja.querySelector<HTMLImageElement>('img.manifest-photo')!;
      expect(foto.getAttribute('src')).toBe('https://archivos.sgl.test/manifiestos/man-0001.jpg');
      expect(foto.alt).toContain('MAN-0001');
      expect(contenido).toContain('Peaje Chusacá');
      expect(contenido).toContain('Tanqueo');
      expect(contenido).toMatch(/Total de gastos.*345\.000/);
    });

    it('CA 6: es de solo lectura, sin opciones de edición ni eliminación', () => {
      const hoja = abrirDetalleDe(1);

      expect([...hoja.querySelectorAll('button')].map((b) => b.getAttribute('aria-label') ?? b.textContent!.trim())).toEqual([
        'Cerrar detalle',
      ]);
      expect(hoja.querySelector('input, select, textarea, form, a')).toBeNull();
      expect(texto()).not.toMatch(/editar|eliminar|borrar|modificar/i);
    });

    it('CA 6: un viaje sin manifiesto, sin gastos ni entrega lo indica', () => {
      const hoja = abrirDetalleDe(1, detalle(1, { manifiesto: null, gastos: [], totalGastos: 0, fechaEntrega: null, placaRemolque: null, estado: 'ACTIVO' }));
      const contenido = hoja.textContent!.replace(/\s+/g, ' ');

      expect(contenido).toContain('Aún sin entregar');
      expect(contenido).toContain('todavía no tiene manifiesto registrado');
      expect(contenido).toContain('no tiene gastos de ruta registrados');
      expect(hoja.querySelector('img')).toBeNull();
      expect(contenido).not.toContain('Remolque');
    });

    it('si la foto del manifiesto no carga, lo explica en lugar de mostrar una imagen rota', () => {
      const hoja = abrirDetalleDe(1);

      hoja.querySelector('img')!.dispatchEvent(new Event('error'));
      render();

      expect(hoja.querySelector('img')).toBeNull();
      expect(hoja.textContent).toContain('La foto del manifiesto no está disponible');
    });

    it('se cierra con el botón, con Escape o tocando fuera, y la lista sigue igual', () => {
      abrirDetalleDe(1);
      clic(boton('×'));
      expect(pantalla.querySelector('[role="dialog"]')).toBeNull();

      clic(tarjetas()[0]);
      backend.expectOne(`${URL}/v1`).flush(detalle(1));
      render();
      pantalla.querySelector('[role="dialog"]')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      render();
      expect(pantalla.querySelector('[role="dialog"]')).toBeNull();

      clic(tarjetas()[0]);
      backend.expectOne(`${URL}/v1`).flush(detalle(1));
      render();
      clic(pantalla.querySelector<HTMLElement>('.sheet-backdrop')!);
      expect(pantalla.querySelector('[role="dialog"]')).toBeNull();
      expect(tarjetas()).toHaveLength(3);
    });

    it('CA 8: si el servidor responde 404 (viaje ajeno o inexistente) muestra el mensaje sin datos del viaje', () => {
      abrirCon(pagina(viajes(1, 1)));
      clic(tarjetas()[0]);
      backend.expectOne(`${URL}/v1`).flush({ codigo: 'VIAJE_NO_ENCONTRADO', mensaje: 'El viaje no existe.' }, { status: 404, statusText: 'Not Found' });
      render();

      const hoja = pantalla.querySelector('[role="dialog"]')!;
      expect(hoja.querySelector('[role="alert"]')!.textContent).toContain('El viaje no existe.');
      expect(hoja.querySelector('dl')).toBeNull();
    });
  });

  describe('CA 7: sin gráficas ni exportación', () => {
    it('no ofrece gráficas, exportación a Excel ni descargas', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));
      clic(tarjetas()[0]);
      backend.expectOne(`${URL}/v1`).flush(detalle(1));
      render();

      expect(texto()).not.toMatch(/exportar|excel|descargar|gr[aá]fic|csv|imprimir/i);
      expect(pantalla.querySelector('canvas, svg, a[download]')).toBeNull();
    });
  });

  describe('Sin conexión', () => {
    function guardarCopia(items = viajes(1, 5), total = 12): string {
      cache.guardarLista(items, total, 'c1');
      return cache.leerLista()!.actualizadoEn;
    }

    it('CA 10: sin conexión muestra la última versión guardada con su fecha y hora de actualización', () => {
      const guardadoEn = guardarCopia();
      montar();

      sinConexion(lista());
      render();

      expect(origenes()).toEqual(['Origen 1', 'Origen 2', 'Origen 3', 'Origen 4', 'Origen 5']);
      expect(texto()).toContain('Está viendo datos guardados');
      expect(texto()).toContain('Pueden no estar actualizados');
      expect(texto()).toContain(plano(formatearFechaHora(guardadoEn)));
      expect(texto()).toContain('Mostrando 5 de 12 viajes');
      expect(boton('Actualizar')).toBeTruthy();
    });

    it('CA 10: con datos guardados no ofrece "Ver más" (se actualiza la vista completa)', () => {
      guardarCopia();
      montar();
      sinConexion(lista());
      render();

      expect(boton('Ver más')).toBeUndefined();
    });

    it('CA 10: también muestra lo guardado si el servidor no responde o falla', () => {
      guardarCopia();
      montar();

      lista().flush({ codigo: 'ERROR_INTERNO', mensaje: 'x' }, { status: 500, statusText: 'Server Error' });
      render();

      expect(texto()).toContain('Está viendo datos guardados');
      expect(tarjetas()).toHaveLength(5);
    });

    it('CA 10: no usa datos guardados ante un error que no es de conexión (por ejemplo, filtros inválidos)', () => {
      guardarCopia();
      montar();

      lista().flush({ codigo: 'DATOS_INVALIDOS', mensaje: 'estado: inválido' }, { status: 422, statusText: 'Unprocessable' });
      render();

      expect(texto()).not.toContain('datos guardados');
      expect(pantalla.querySelector('.list-state.error')!.textContent).toContain('estado: inválido');
    });

    it('CA 10: sin conexión, aplicar filtros se resuelve sobre los viajes guardados', () => {
      guardarCopia([viaje(1, { estado: 'ACTIVO' }), viaje(2, { estado: 'FINALIZADO' }), viaje(3, { estado: 'FINALIZADO' })], 3);
      montar();
      sinConexion(lista());
      render();

      filtrar({ estado: 'FINALIZADO' });
      sinConexion(lista());
      render();

      expect(origenes()).toEqual(['Origen 2', 'Origen 3']);
      expect(texto()).toContain('Está viendo datos guardados');
      expect(texto()).toContain('Mostrando 2 de 2 viajes');
    });

    it('CA 10: el filtro de fechas sobre lo guardado usa el día de Colombia', () => {
      guardarCopia([
        viaje(1, { fechaInicio: '2026-10-06T04:59:59Z' }), // 5 oct 23:59 en Colombia
        viaje(2, { fechaInicio: '2026-10-06T05:00:00Z' }), // 6 oct 00:00 en Colombia
      ], 2);
      montar();
      sinConexion(lista());
      render();

      filtrar({ desde: '2026-10-06' });
      sinConexion(lista());
      render();

      expect(origenes()).toEqual(['Origen 2']);
    });

    it('CA 11: si se pierde la conexión al presionar "Ver más", avisa, conserva lo cargado y permite reintentar', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      clic(boton('Ver más'));
      sinConexion(lista('c1'));
      render();

      expect(origenes()).toHaveLength(5); // nada se pierde
      expect(pantalla.querySelector('.more-error')!.textContent).toContain('Error de conexión');
      expect(boton('Ver más')).toBeUndefined();

      clic(boton('Reintentar'));
      lista('c1').flush(pagina(viajes(6, 10), 'c2', 12));
      render();

      expect(tarjetas()).toHaveLength(10);
      expect(pantalla.querySelector('.more-error')).toBeNull();
      expect(boton('Ver más')).toBeTruthy();
    });

    it('CA 11: tras un error en "Ver más" no se mezclan datos guardados con lo que ya se mostraba', () => {
      guardarCopia(viajes(20, 22), 3);
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      clic(boton('Ver más'));
      sinConexion(lista('c1'));
      render();

      expect(origenes()).toEqual(['Origen 1', 'Origen 2', 'Origen 3', 'Origen 4', 'Origen 5']);
      expect(texto()).not.toContain('datos guardados');
    });

    it('CA 12: sin conexión y sin datos guardados lo dice, sin pantalla en blanco ni error técnico', () => {
      montar();

      sinConexion(lista());
      render();

      expect(texto()).toContain('No hay datos disponibles sin conexión');
      expect(texto()).not.toMatch(/HttpErrorResponse|status|undefined|null/);
      expect(tarjetas()).toHaveLength(0);
      expect(boton('Reintentar')).toBeTruthy();
    });

    it('CA 12: "Reintentar" vuelve a consultar y muestra el historial cuando hay conexión', () => {
      montar();
      sinConexion(lista());
      render();

      clic(boton('Reintentar'));
      lista().flush(pagina(viajes(1, 3)));
      render();

      expect(tarjetas()).toHaveLength(3);
      expect(texto()).not.toContain('No hay datos disponibles');
    });

    it('un error del servidor sin datos guardados muestra el mensaje común y permite reintentar', () => {
      montar();

      lista().flush({ codigo: 'ERROR_INTERNO', mensaje: 'x' }, { status: 500, statusText: 'Server Error' });
      render();

      expect(pantalla.querySelector('.list-state.error')!.textContent).toContain('El servidor presentó un error');
      expect(boton('Reintentar')).toBeTruthy();
    });

    it('CA 13: al actualizar con conexión carga la información actual y quita el aviso de datos desactualizados', () => {
      guardarCopia(viajes(1, 5), 12);
      montar();
      sinConexion(lista());
      render();
      expect(texto()).toContain('datos guardados');

      clic(boton('Actualizar'));
      lista().flush(pagina([viaje(9), ...viajes(1, 4)], 'c7', 13));
      render();

      expect(texto()).not.toContain('datos guardados');
      expect(boton('Actualizar')).toBeUndefined();
      expect(origenes()).toEqual(['Origen 9', 'Origen 1', 'Origen 2', 'Origen 3', 'Origen 4']);
      expect(texto()).toContain('Mostrando 5 de 13 viajes');
      expect(boton('Ver más')).toBeTruthy();
    });

    it('CA 13: al recuperar la conexión se actualiza solo la vista que mostraba datos guardados', () => {
      guardarCopia();
      montar();
      sinConexion(lista());
      render();

      window.dispatchEvent(new Event('online'));
      lista().flush(pagina(viajes(1, 5), 'c1', 12));
      render();

      expect(texto()).not.toContain('datos guardados');
    });

    it('al recuperar la conexión no recarga una vista que ya estaba actualizada', () => {
      abrirCon(pagina(viajes(1, 5), 'c1', 12));

      window.dispatchEvent(new Event('online'));

      backend.expectNone(() => true);
    });

    it('si la actualización vuelve a fallar, sigue mostrando lo guardado con el aviso', () => {
      guardarCopia();
      montar();
      sinConexion(lista());
      render();

      clic(boton('Actualizar'));
      sinConexion(lista());
      render();

      expect(texto()).toContain('Está viendo datos guardados');
      expect(tarjetas()).toHaveLength(5);
    });

    describe('qué se guarda en el dispositivo', () => {
      it('guarda la lista sin filtros después de cargarla y de cada "Ver más"', () => {
        abrirCon(pagina(viajes(1, 5), 'c1', 12));
        expect(cache.leerLista()?.items).toHaveLength(5);

        clic(boton('Ver más'));
        lista('c1').flush(pagina(viajes(6, 10), 'c2', 12));

        expect(cache.leerLista()?.items).toHaveLength(10);
        expect(cache.leerLista()?.total).toBe(12);
      });

      it('una consulta con filtros no reemplaza la copia guardada sin filtros', () => {
        abrirCon(pagina(viajes(1, 5), 'c1', 12));

        filtrar({ estado: 'ACTIVO' });
        lista().flush(pagina([viaje(1)], null, 1));

        expect(cache.leerLista()?.items).toHaveLength(5);
        expect(cache.leerLista()?.total).toBe(12);
      });

      it('guarda el detalle de cada viaje abierto', () => {
        abrirCon(pagina(viajes(1, 3)));
        clic(tarjetas()[1]);
        backend.expectOne(`${URL}/v2`).flush(detalle(2));

        expect(cache.leerDetalle('v2')?.detalle.origen).toBe('Origen 2');
      });
    });

    describe('detalle sin conexión', () => {
      it('muestra el detalle guardado con su fecha de actualización', () => {
        cache.guardarDetalle(detalle(2));
        const guardadoEn = cache.leerDetalle('v2')!.actualizadoEn;
        abrirCon(pagina(viajes(1, 3)));

        clic(tarjetas()[1]);
        sinConexion(backend.expectOne(`${URL}/v2`));
        render();

        const hoja = pantalla.querySelector('[role="dialog"]')!.textContent!.replace(/\s+/g, ' ');
        expect(hoja).toContain('Datos guardados en este dispositivo');
        expect(hoja).toContain(plano(formatearFechaHora(guardadoEn)));
        expect(hoja).toContain('Peaje Chusacá');
      });

      it('si el viaje nunca se abrió con conexión, lo explica y permite reintentar', () => {
        abrirCon(pagina(viajes(1, 3)));

        clic(tarjetas()[0]);
        sinConexion(backend.expectOne(`${URL}/v1`));
        render();

        const hoja = pantalla.querySelector('[role="dialog"]')!;
        expect(hoja.textContent).toContain('no está guardado en el dispositivo');
        clic([...hoja.querySelectorAll('button')].find((b) => b.textContent!.trim() === 'Reintentar'));
        backend.expectOne(`${URL}/v1`).flush(detalle(1));
        render();
        expect(pantalla.querySelector('[role="dialog"]')!.textContent).toContain('Peaje Chusacá');
      });
    });
  });

  describe('CA 9: no queda nada guardado de otra persona', () => {
    it('no muestra la copia guardada por otro usuario del dispositivo', () => {
      localStorage.setItem(
        `${PREFIJO_ALMACEN}u1`,
        JSON.stringify({
          usuarioId: 'otro-conductor',
          lista: { actualizadoEn: new Date().toISOString(), items: [viaje(99, { origen: 'Secreto' })], total: 1, siguienteCursor: null },
          detalles: [],
        }),
      );
      montar();

      sinConexion(lista());
      render();

      expect(texto()).not.toContain('Secreto');
      expect(texto()).toContain('No hay datos disponibles sin conexión');
    });
  });
});
