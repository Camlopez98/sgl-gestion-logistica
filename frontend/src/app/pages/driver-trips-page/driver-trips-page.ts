import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppVehiculoActivo } from '../../asignaciones/vehiculo-activo/vehiculo-activo';

/** Destino del Conductor tras iniciar sesión (HU-18, escenario 1). El contenido pertenece a otra historia. */
@Component({
  selector: 'app-driver-trips-page',
  imports: [AppVehiculoActivo],
  templateUrl: './driver-trips-page.html',
  styleUrls: ['../../app-page.css', '../placeholder-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDriverTripsPage {}
