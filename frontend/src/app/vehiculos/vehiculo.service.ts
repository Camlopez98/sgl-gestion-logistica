import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, retry, throwError, timeout, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import type { DatosVehiculo, FiltrosVehiculos, Vehiculo } from './vehiculo.model';

const URL = `${environment.apiUrl}/vehiculos`;
const TIEMPO_MAXIMO_MS = 15000;
const REINTENTOS_POR_CORTE = 2;

/** Acceso a la API de vehículos (HU-03). */
@Injectable({ providedIn: 'root' })
export class VehiculoService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosVehiculos = {}): Observable<Vehiculo[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) params = params.set(clave, valor);
    }
    return this.enviar(() => this.http.get<Vehiculo[]>(URL, { params }));
  }

  obtener(id: string): Observable<Vehiculo> {
    return this.enviar(() => this.http.get<Vehiculo>(`${URL}/${id}`));
  }

  /**
   * Registra un vehículo. `claveIdempotencia` identifica la operación: los reenvíos
   * automáticos y los reintentos del usuario con los mismos datos usan la misma clave,
   * así el servidor no duplica el vehículo (HU-03, escenarios 9 y 10).
   */
  registrar(datos: DatosVehiculo, claveIdempotencia: string): Observable<Vehiculo> {
    return this.enviar(() =>
      this.http.post<Vehiculo>(URL, datos, { headers: { 'Idempotency-Key': claveIdempotencia } }),
    );
  }

  editar(id: string, datos: DatosVehiculo): Observable<Vehiculo> {
    return this.enviar(() => this.http.put<Vehiculo>(`${URL}/${id}`, datos));
  }

  desactivar(id: string): Observable<Vehiculo> {
    return this.enviar(() => this.http.patch<Vehiculo>(`${URL}/${id}/desactivar`, {}));
  }

  /**
   * - Sin conexión a internet no envía la solicitud (HU-03, escenario 8).
   * - Si la conexión se corta a mitad de camino (status 0), reenvía hasta 2 veces (escenario 10).
   *   Todas las operaciones son seguras de repetir: el registro usa Idempotency-Key y la edición
   *   y la desactivación producen el mismo resultado.
   * - Corta la espera si el servidor no responde.
   */
  private enviar<T>(peticion: () => Observable<T>): Observable<T> {
    return defer(() => (navigator.onLine === false ? throwError(() => sinConexion()) : peticion())).pipe(
      retry({
        count: REINTENTOS_POR_CORTE,
        delay: (error: unknown, intento: number) =>
          esCorteDeConexion(error) ? timer(1000 * intento) : throwError(() => error),
      }),
      timeout(TIEMPO_MAXIMO_MS),
    );
  }
}

function esCorteDeConexion(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 0 && navigator.onLine !== false;
}

function sinConexion(): HttpErrorResponse {
  return new HttpErrorResponse({ status: 0, statusText: 'Sin conexión' });
}

/** Genera una clave única para una operación de registro. */
export function nuevaClaveIdempotencia(): string {
  return crypto.randomUUID();
}
