import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { codigoDeError, mensajeDeError } from '../../core/http/mensaje-error';
import { etiquetaTipo } from '../../vehiculos/vehiculo.model';
import type { SeleccionVehiculo, VehiculoActivo, VehiculoDeSelector } from '../asignacion.model';
import { AsignacionService } from '../asignacion.service';

export const MENSAJE_SIN_VEHICULO = 'Necesita un vehículo asignado para iniciar un manifiesto. Comuníquese con el administrador.';

/**
 * HU-04, CA 13 y 14: selector de vehículo para iniciar un manifiesto.
 * Muestra únicamente el vehículo activo del conductor y su remolque acoplado. Sin vehículo activo
 * (o con el vehículo desactivado) lo indica y emite `seleccion` en `null`: el formulario de
 * manifiesto no debe permitir continuar. El servidor lo valida de nuevo al recibir el manifiesto (CA 15).
 *
 *   <app-vehiculo-activo (seleccion)="vehiculo.set($event)" />
 */
@Component({
  selector: 'app-vehiculo-activo',
  templateUrl: './vehiculo-activo.html',
  styleUrl: './vehiculo-activo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppVehiculoActivo {
  private readonly asignacionService = inject(AsignacionService);

  /** Vehículo y remolque que el conductor usará, o null si no puede iniciar un manifiesto. */
  readonly seleccion = output<SeleccionVehiculo | null>();

  protected readonly cargando = signal(true);
  protected readonly activo = signal<VehiculoActivo | null>(null);
  protected readonly sinVehiculo = signal(false);
  protected readonly error = signal('');
  protected readonly mensajeSinVehiculo = MENSAJE_SIN_VEHICULO;

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.sinVehiculo.set(false);
    this.activo.set(null);
    this.seleccion.emit(null);

    this.asignacionService.vehiculoActivo().subscribe({
      next: (activo) => {
        this.activo.set(activo);
        this.cargando.set(false);
        this.seleccion.emit({ vehiculoId: activo.vehiculo.id, remolqueId: activo.remolque?.id ?? null });
      },
      error: (error: unknown) => {
        this.cargando.set(false);
        if (codigoDeError(error) === 'SIN_VEHICULO_ACTIVO') {
          this.sinVehiculo.set(true);
          return;
        }
        this.error.set(mensajeDeError(error));
      },
    });
  }

  protected descripcion(vehiculo: VehiculoDeSelector): string {
    return `${vehiculo.placa} · ${etiquetaTipo(vehiculo.tipo)} ${vehiculo.marca} ${vehiculo.modelo}`;
  }
}
