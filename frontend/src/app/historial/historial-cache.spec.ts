import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { iniciarSesionDePrueba } from '../testing/sesion-prueba';
import { PREFIJO_ALMACEN, borrarDatosGuardados } from './historial-almacen';
import { HistorialCache, MAX_DETALLES_GUARDADOS, MAX_VIAJES_GUARDADOS } from './historial-cache';
import type { DetalleDeViaje, ViajeDeLista } from './viaje.model';

const viaje = (n: number): ViajeDeLista => ({
  id: `v${n}`,
  estado: 'FINALIZADO',
  origen: 'Bogotá',
  destino: 'Cali',
  valorFlete: 1_000_000,
  fechaInicio: '2026-10-10T13:00:00Z',
  placaVehiculo: 'TKM482',
  totalGastos: 0,
});

const detalle = (n: number): DetalleDeViaje => ({
  ...viaje(n),
  fechaEntrega: null,
  placaRemolque: null,
  manifiesto: null,
  gastos: [],
});

const clavesGuardadas = () =>
  Object.keys(localStorage).filter((clave) => clave.startsWith(PREFIJO_ALMACEN));

function configurar() {
  TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
  return {
    auth: TestBed.inject(AuthService),
    cache: TestBed.inject(HistorialCache),
    router: TestBed.inject(Router),
    http: TestBed.inject(HttpTestingController),
  };
}

describe('HistorialCache', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    iniciarSesionDePrueba('CONDUCTOR'); // usuario "u1"
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('guarda y recupera la última lista con su fecha de actualización', () => {
    const { cache } = configurar();
    const antes = Date.now();

    cache.guardarLista([viaje(1), viaje(2)], 12, 'cursor-1');
    const guardada = cache.leerLista();

    expect(guardada?.items.map((v) => v.id)).toEqual(['v1', 'v2']);
    expect(guardada?.total).toBe(12);
    expect(guardada?.siguienteCursor).toBe('cursor-1');
    expect(new Date(guardada!.actualizadoEn).getTime()).toBeGreaterThanOrEqual(antes);
    expect(clavesGuardadas()).toEqual([`${PREFIJO_ALMACEN}u1`]);
  });

  it('sin datos guardados no devuelve nada', () => {
    const { cache } = configurar();

    expect(cache.leerLista()).toBeNull();
    expect(cache.leerDetalle('v1')).toBeNull();
  });

  it('guarda los detalles abiertos y recupera cada uno por su id', () => {
    const { cache } = configurar();

    cache.guardarDetalle(detalle(1));
    cache.guardarDetalle(detalle(2));

    expect(cache.leerDetalle('v1')?.detalle.id).toBe('v1');
    expect(cache.leerDetalle('v2')?.detalle.id).toBe('v2');
    expect(cache.leerDetalle('v3')).toBeNull();
  });

  it('guardar la lista no borra los detalles y viceversa', () => {
    const { cache } = configurar();

    cache.guardarDetalle(detalle(1));
    cache.guardarLista([viaje(1)], 1, null);
    cache.guardarDetalle(detalle(2));

    expect(cache.leerLista()?.items).toHaveLength(1);
    expect(cache.leerDetalle('v1')).not.toBeNull();
    expect(cache.leerDetalle('v2')).not.toBeNull();
  });

  it('limita lo que ocupa en el dispositivo', () => {
    const { cache } = configurar();

    cache.guardarLista(Array.from({ length: MAX_VIAJES_GUARDADOS + 30 }, (_, i) => viaje(i)), 500, null);
    for (let i = 0; i < MAX_DETALLES_GUARDADOS + 5; i++) cache.guardarDetalle(detalle(i));

    expect(cache.leerLista()?.items).toHaveLength(MAX_VIAJES_GUARDADOS);
    expect(cache.leerLista()?.total).toBe(500);
    expect(cache.leerDetalle('v0')).toBeNull(); // el más antiguo salió
    expect(cache.leerDetalle(`v${MAX_DETALLES_GUARDADOS + 4}`)).not.toBeNull();
  });

  it('un detalle abierto de nuevo se mueve al más reciente sin duplicarse', () => {
    const { cache } = configurar();

    cache.guardarDetalle(detalle(1));
    cache.guardarDetalle(detalle(2));
    cache.guardarDetalle({ ...detalle(1), origen: 'Medellín' });

    expect(cache.leerDetalle('v1')?.detalle.origen).toBe('Medellín');
    expect(JSON.parse(localStorage.getItem(`${PREFIJO_ALMACEN}u1`)!).detalles).toHaveLength(2);
  });

  it('sin sesión no guarda ni lee nada', () => {
    sessionStorage.clear();
    const { cache } = configurar();

    cache.guardarLista([viaje(1)], 1, null);
    cache.guardarDetalle(detalle(1));

    expect(clavesGuardadas()).toEqual([]);
    expect(cache.leerLista()).toBeNull();
  });

  it('ignora datos dañados en lugar de fallar', () => {
    localStorage.setItem(`${PREFIJO_ALMACEN}u1`, '{esto no es json');
    const { cache } = configurar();

    expect(cache.leerLista()).toBeNull();
  });

  it('no falla si el almacenamiento no está disponible', () => {
    const { cache } = configurar();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('lleno', 'QuotaExceededError');
    });

    expect(() => cache.guardarLista([viaje(1)], 1, null)).not.toThrow();
    expect(() => cache.guardarDetalle(detalle(1))).not.toThrow();
  });

  describe('CA 9: los datos guardados no pasan a otra persona', () => {
    it('una entrada de otro usuario nunca se lee', () => {
      localStorage.setItem(
        `${PREFIJO_ALMACEN}u1`,
        JSON.stringify({ usuarioId: 'otro', lista: { actualizadoEn: new Date().toISOString(), items: [viaje(9)], total: 1, siguienteCursor: null }, detalles: [] }),
      );
      const { cache } = configurar();

      expect(cache.leerLista()).toBeNull();
    });

    it('al abrir la sesión de un usuario se borran los datos de otros usuarios que quedaron en el dispositivo', () => {
      localStorage.setItem(`${PREFIJO_ALMACEN}u-anterior`, JSON.stringify({ usuarioId: 'u-anterior', lista: null, detalles: [] }));
      localStorage.setItem('otra-clave-de-la-aplicacion', 'se-conserva');

      const { cache } = configurar();
      cache.guardarLista([viaje(1)], 1, null);

      expect(clavesGuardadas()).toEqual([`${PREFIJO_ALMACEN}u1`]);
      expect(localStorage.getItem('otra-clave-de-la-aplicacion')).toBe('se-conserva');
    });

    it('cerrar sesión borra todo lo guardado', () => {
      const { auth, cache, router, http } = configurar();
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      cache.guardarLista([viaje(1)], 1, null);
      cache.guardarDetalle(detalle(1));
      localStorage.setItem(`${PREFIJO_ALMACEN}u-otro`, '{}');
      expect(clavesGuardadas()).toHaveLength(2);

      auth.cerrarSesion();
      http.expectOne(() => true).flush(null, { status: 204, statusText: 'No Content' });

      expect(clavesGuardadas()).toEqual([]);
      expect(cache.leerLista()).toBeNull();
    });

    it.each(['expirada', 'inactiva', 'invalida'] as const)('cerrar la sesión por motivo "%s" también borra lo guardado', (motivo) => {
      const { auth, cache, router } = configurar();
      vi.spyOn(router, 'navigate').mockResolvedValue(true);
      cache.guardarLista([viaje(1)], 1, null);

      auth.cerrarSesion(motivo);

      expect(clavesGuardadas()).toEqual([]);
    });

    it('descartar una sesión (por ejemplo, al responder 401) borra lo guardado', () => {
      const { auth, cache } = configurar();
      cache.guardarLista([viaje(1)], 1, null);

      auth.descartarSesion();

      expect(clavesGuardadas()).toEqual([]);
    });

    it('al abrir la aplicación sin una sesión válida no queda nada guardado de una sesión anterior', () => {
      localStorage.setItem(`${PREFIJO_ALMACEN}u1`, JSON.stringify({ usuarioId: 'u1', lista: null, detalles: [] }));
      sessionStorage.clear(); // se cerró el navegador sin cerrar sesión

      configurar();

      expect(clavesGuardadas()).toEqual([]);
    });

    it('borrarDatosGuardados solo toca las claves del historial', () => {
      configurar();
      localStorage.setItem(`${PREFIJO_ALMACEN}u1`, '{}');
      localStorage.setItem('preferencia', 'x');

      borrarDatosGuardados();

      expect(clavesGuardadas()).toEqual([]);
      expect(localStorage.getItem('preferencia')).toBe('x');
    });
  });
});
