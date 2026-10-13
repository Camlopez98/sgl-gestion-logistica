import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import type { DatosRuta } from '../../core/auth/auth.models';
import { AuthService } from '../../core/auth/auth.service';

interface EntradaMenu {
  ruta: string;
  etiqueta: string;
  separadorAntes: boolean;
}

/** Estructura común de las pantallas internas: menú lateral, barra superior y contenido. */
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrls: ['../../app.css', '../../app-page.css', '../../app-responsive.css', './shell.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShell {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly usuario = this.auth.usuario;

  protected readonly iniciales = computed(() =>
    (this.usuario()?.nombreCompleto ?? '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((palabra) => palabra[0].toUpperCase())
      .join(''),
  );

  /**
   * El menú se arma con las rutas hijas registradas en app.routes.ts que declaran `data.menu`,
   * mostrando solo las permitidas para el rol de la sesión.
   */
  protected readonly menu = computed<EntradaMenu[]>(() => {
    const rol = this.auth.rol();
    return (this.route.routeConfig?.children ?? [])
      .filter((hija) => {
        const datos = hija.data as DatosRuta | undefined;
        return !!datos?.menu && !!rol && datos.roles.includes(rol);
      })
      .map((hija) => {
        const datos = hija.data as DatosRuta;
        return { ruta: `/${hija.path}`, etiqueta: datos.menu!, separadorAntes: !!datos.separadorAntes };
      });
  });

  protected readonly titulo = toSignal(
    this.router.events.pipe(
      filter((evento) => evento instanceof NavigationEnd),
      map(() => this.tituloActual()),
    ),
    { initialValue: this.tituloActual() },
  );

  protected cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  private tituloActual(): string {
    let actual = this.route.snapshot;
    while (actual.firstChild) {
      actual = actual.firstChild;
    }
    return (actual.data as Partial<DatosRuta>).titulo ?? '';
  }
}
