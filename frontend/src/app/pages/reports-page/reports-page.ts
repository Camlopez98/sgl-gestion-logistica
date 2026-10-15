import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Destino del Contador tras iniciar sesión (HU-18, escenario 3).
 * Es de solo lectura: no ofrece opciones de creación, edición ni borrado.
 */
@Component({
  selector: 'app-reports-page',
  templateUrl: './reports-page.html',
  styleUrls: ['../../app-page.css', '../placeholder-page.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppReportsPage {}
