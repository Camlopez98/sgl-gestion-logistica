import { Injectable, inject } from '@angular/core';
import { AuthService } from '../core/auth/auth.service';
import {
  borrarDatosDeOtrosUsuarios,
  escribirAlmacen,
  leerAlmacen,
  type AlmacenDeUsuario,
  type DetalleGuardado,
  type ListaGuardada,
} from './historial-almacen';
import type { DetalleDeViaje, ViajeDeLista } from './viaje.model';

/** Máximo de viajes y de detalles que se guardan en el dispositivo. */
export const MAX_VIAJES_GUARDADOS = 100;
export const MAX_DETALLES_GUARDADOS = 20;

/**
 * Copia del historial del conductor de la sesión para consultarla sin conexión (HU-05).
 * Si no hay sesión no lee ni escribe nada.
 */
@Injectable({ providedIn: 'root' })
export class HistorialCache {
  private readonly auth = inject(AuthService);

  constructor() {
    // Datos de otra persona que quedaron en el dispositivo (CA 9): se descartan al abrir la sesión.
    const usuarioId = this.auth.usuario()?.id;
    if (usuarioId) borrarDatosDeOtrosUsuarios(usuarioId);
  }

  leerLista(): ListaGuardada | null {
    return this.almacen()?.lista ?? null;
  }

  /** Guarda la lista sin filtros tal como se está mostrando. */
  guardarLista(items: ViajeDeLista[], total: number, siguienteCursor: string | null): void {
    const usuarioId = this.auth.usuario()?.id;
    if (!usuarioId) return;
    const actual = this.almacen() ?? vacio(usuarioId);
    escribirAlmacen({
      ...actual,
      lista: {
        actualizadoEn: new Date().toISOString(),
        items: items.slice(0, MAX_VIAJES_GUARDADOS),
        total,
        siguienteCursor,
      },
    });
  }

  leerDetalle(id: string): DetalleGuardado | null {
    return this.almacen()?.detalles.find((guardado) => guardado.detalle.id === id) ?? null;
  }

  guardarDetalle(detalle: DetalleDeViaje): void {
    const usuarioId = this.auth.usuario()?.id;
    if (!usuarioId) return;
    const actual = this.almacen() ?? vacio(usuarioId);
    const detalles = [
      { actualizadoEn: new Date().toISOString(), detalle },
      ...actual.detalles.filter((guardado) => guardado.detalle.id !== detalle.id),
    ].slice(0, MAX_DETALLES_GUARDADOS);
    escribirAlmacen({ ...actual, detalles });
  }

  private almacen(): AlmacenDeUsuario | null {
    const usuarioId = this.auth.usuario()?.id;
    return usuarioId ? leerAlmacen(usuarioId) : null;
  }
}

function vacio(usuarioId: string): AlmacenDeUsuario {
  return { usuarioId, lista: null, detalles: [] };
}
