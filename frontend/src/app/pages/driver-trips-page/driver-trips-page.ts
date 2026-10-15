import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AppVehiculoActivo } from '../../asignaciones/vehiculo-activo/vehiculo-activo';

/** Destino del Conductor tras iniciar sesión (HU-18, escenario 1). El contenido pertenece a otra historia. */
@Component({
  selector: 'app-driver-trips-page',
  imports: [AppVehiculoActivo],
  template: `
    <section class="page-heading" aria-labelledby="driver-trips-title">
      <div>
        <p class="eyebrow">CONDUCTOR</p>
        <h1 id="driver-trips-title">Mis viajes en curso</h1>
        <p class="page-description">Aquí verá el viaje que tiene activo y podrá registrar su manifiesto.</p>
      </div>
    </section>
    <app-vehiculo-activo />
    <p class="placeholder-note">Módulo en construcción.</p>
  `,
  styleUrls: ['../../app-page.css', '../placeholder-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppDriverTripsPage {}
