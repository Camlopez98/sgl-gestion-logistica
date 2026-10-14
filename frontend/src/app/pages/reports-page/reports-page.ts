import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Destino del Contador tras iniciar sesión (HU-18, escenario 3).
 * Es de solo lectura: no ofrece opciones de creación, edición ni borrado.
 */
@Component({
  selector: 'app-reports-page',
  template: `
    <section class="page-heading" aria-labelledby="reports-title">
      <div>
        <p class="eyebrow">CONTABILIDAD</p>
        <h1 id="reports-title">Visor de reportes</h1>
        <p class="page-description">Consulta de viajes validados y exportación del consolidado financiero.</p>
      </div>
    </section>
    <p class="placeholder-note">Módulo en construcción.</p>
  `,
  styleUrls: ['../../app-page.css', '../placeholder-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppReportsPage {}
