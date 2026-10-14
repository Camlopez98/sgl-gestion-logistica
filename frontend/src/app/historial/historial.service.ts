import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, throwError, timeout } from 'rxjs';
import { environment } from '../../environments/environment';
import { TAMANO_BLOQUE, type DetalleDeViaje, type FiltrosHistorial, type PaginaHistorial } from './viaje.model';

const URL = `${environment.apiUrl}/conductores/me/viajes`;
const TIEMPO_MAXIMO_MS = 15000;

/**
 * Acceso a la API del historial del conductor (HU-05). Solo lectura.
 *
 * Sin conexión a internet no envía la solicitud y falla con status 0. No reintenta sola: la pantalla
 * ofrece "Reintentar", así un corte durante "ver más" se informa de inmediato (CA 11).
 */
@Injectable({ providedIn: 'root' })
export class HistorialService {
  private readonly http = inject(HttpClient);

  /** Un bloque del historial: sin cursor devuelve los más recientes; con cursor, el siguiente bloque. */
  listar(filtros: FiltrosHistorial = {}, cursor: string | null = null, limite = TAMANO_BLOQUE): Observable<PaginaHistorial> {
    let params = new HttpParams().set('limite', limite);
    if (cursor) params = params.set('cursor', cursor);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.desde) params = params.set('desde', filtros.desde);
    if (filtros.hasta) params = params.set('hasta', filtros.hasta);
    return this.enviar(() => this.http.get<PaginaHistorial>(URL, { params }));
  }

  /** Detalle de un viaje propio; el servidor responde 404 si no existe o es de otro conductor. */
  detalle(id: string): Observable<DetalleDeViaje> {
    return this.enviar(() => this.http.get<DetalleDeViaje>(`${URL}/${encodeURIComponent(id)}`));
  }

  private enviar<T>(peticion: () => Observable<T>): Observable<T> {
    return defer(() => (navigator.onLine === false ? throwError(() => sinConexion()) : peticion())).pipe(
      timeout(TIEMPO_MAXIMO_MS),
    );
  }
}

function sinConexion(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 0, statusText: 'Sin conexión' });
}
