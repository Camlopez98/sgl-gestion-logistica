import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, defer, retry, throwError, timeout, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import type {
  Asignacion,
  AsignacionDeHistorial,
  ConductorHabilitable,
  DatosActivar,
  DatosHabilitar,
  FiltrosAsignaciones,
  VehiculoActivo,
} from './asignacion.model';

const URL = `${environment.apiUrl}/asignaciones`;
const TIEMPO_MAXIMO_MS = 15000;
const REINTENTOS_POR_CORTE = 2;

/** Acceso a la API de asignaciones de vehículos (HU-04). */
@Injectable({ providedIn: 'root' })
export class AsignacionService {
  private readonly http = inject(HttpClient);

  listar(filtros: FiltrosAsignaciones = {}): Observable<Asignacion[]> {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) params = params.set(clave, valor);
    }
    return this.enviar(() => this.http.get<Asignacion[]>(URL, { params }), true);
  }

  conductores(): Observable<ConductorHabilitable[]> {
    return this.enviar(() => this.http.get<ConductorHabilitable[]>(`${URL}/conductores`), true);
  }

  /** CA 6: conductores que han tenido el vehículo asignado, con sus fechas de inicio y fin. */
  historialDeVehiculo(vehiculoId: string): Observable<AsignacionDeHistorial[]> {
    return this.enviar(
      () => this.http.get<AsignacionDeHistorial[]>(`${environment.apiUrl}/vehiculos/${vehiculoId}/asignaciones`),
      true,
    );
  }

  /**
   * Habilita un vehículo a un conductor. `claveIdempotencia` identifica la operación: los reenvíos
   * automáticos y los reintentos con los mismos datos usan la misma clave, así el servidor no
   * duplica la asignación (CA 17).
   */
  habilitar(datos: DatosHabilitar, claveIdempotencia: string): Observable<Asignacion> {
    return this.enviar(
      () => this.http.post<Asignacion>(URL, datos, { headers: { 'Idempotency-Key': claveIdempotencia } }),
      true,
    );
  }

  /** Activa la asignación, con su remolque o semirremolque si aplica (CA 7 y 10). */
  activar(id: string, datos: DatosActivar): Observable<Asignacion> {
    return this.enviar(() => this.http.patch<Asignacion>(`${URL}/${id}/activar`, datos), false);
  }

  /** Finaliza la asignación sin eliminarla (CA 4). */
  finalizar(id: string, version: number): Observable<Asignacion> {
    return this.enviar(() => this.http.patch<Asignacion>(`${URL}/${id}/finalizar`, { version }), false);
  }

  /** Selector del conductor: su vehículo activo y el remolque acoplado (404 si no tiene, CA 14). */
  vehiculoActivo(): Observable<VehiculoActivo> {
    return this.enviar(() => this.http.get<VehiculoActivo>(`${environment.apiUrl}/conductores/me/vehiculo-activo`), true);
  }

  /**
   * - Sin conexión a internet no envía la solicitud, así no queda una asignación parcial (CA 16).
   * - Si la conexión se corta a mitad de camino (status 0) reenvía hasta 2 veces, pero solo las
   *   operaciones seguras de repetir: consultas y habilitar (que usa Idempotency-Key). Activar y
   *   finalizar no se reenvían solas: si la primera llegó al servidor, su versión ya cambió y el
   *   reenvío se rechazaría; el administrador recarga y decide.
   * - Corta la espera si el servidor no responde.
   */
  private enviar<T>(peticion: () => Observable<T>, reintentable: boolean): Observable<T> {
    return defer(() => (navigator.onLine === false ? throwError(() => sinConexion()) : peticion())).pipe(
      retry({
        count: reintentable ? REINTENTOS_POR_CORTE : 0,
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
