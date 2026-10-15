import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AppBadge, type BadgeVariant } from '../../components/app-badge/app-badge';
import { AppButtonComponent } from '../../components/app-button/app-button';
import { AppCard } from '../../components/app-card/app-card';
import {
  ACOPLE_POR_TIPO,
  ESTADOS_ASIGNACION,
  etiquetaEstadoAsignacion,
  type Asignacion,
  type AsignacionDeHistorial,
  type ConductorHabilitable,
  type EstadoAsignacion,
} from '../../asignaciones/asignacion.model';
import { AsignacionService } from '../../asignaciones/asignacion.service';
import { codigoDeError, mensajeDeError } from '../../core/http/mensaje-error';
import { etiquetaTipo, type Vehiculo } from '../../vehiculos/vehiculo.model';
import { VehiculoService, nuevaClaveIdempotencia } from '../../vehiculos/vehiculo.service';

type FiltroEstado = 'VIGENTES' | 'TODAS' | EstadoAsignacion;

/** Errores que se corrigen cambiando los datos; los demás (red, servidor) permiten reintentar. */
const CODIGOS_DE_DATOS = [
  'ASIGNACION_DUPLICADA',
  'CONDUCTOR_INACTIVO',
  'CONDUCTOR_NO_ENCONTRADO',
  'VEHICULO_INACTIVO',
  'VEHICULO_NO_ENCONTRADO',
  'VEHICULO_NO_HABILITABLE',
  'DATOS_INVALIDOS',
  'CLAVE_IDEMPOTENCIA_REUTILIZADA',
];

const TIPOS_AUTOMOTOR = ['FURGON', 'CAMION', 'TRACTOCAMION'];

/** HU-04: asignación de vehículos a conductores (solo Administrador). */
@Component({
  selector: 'app-assignments-page',
  imports: [AppBadge, AppButtonComponent, AppCard, DatePipe],
  templateUrl: './assignments-page.html',
  styleUrls: [
    '../fleet-page/fleet-page.css',
    '../fleet-page/fleet-dialog.css',
    '../fleet-page/fleet-vehiculos.css',
    './assignments-page.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppAssignmentsPage {
  private readonly asignacionService = inject(AsignacionService);
  private readonly vehiculoService = inject(VehiculoService);

  protected readonly estados = ESTADOS_ASIGNACION;
  protected readonly etiquetaTipo = etiquetaTipo;
  protected readonly etiquetaEstado = etiquetaEstadoAsignacion;
  protected readonly admiteAcople = (a: Asignacion): boolean => !!ACOPLE_POR_TIPO[a.vehiculoTipo];

  // Listado
  protected readonly asignaciones = signal<Asignacion[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal('');
  protected readonly mensaje = signal('');
  protected readonly aviso = signal('');

  // Filtros y paginación
  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal<FiltroEstado>('VIGENTES');
  protected readonly paginaActual = signal(1);
  protected readonly tamanoPagina = 6;

  protected readonly metricas = computed(() => {
    const cuenta = (estado: EstadoAsignacion) => this.asignaciones().filter((a) => a.estado === estado).length;
    return [
      { title: 'Activas', value: String(cuenta('ACTIVA')), detail: 'En uso por su conductor' },
      { title: 'Habilitadas', value: String(cuenta('HABILITADA')), detail: 'Pueden activarse' },
      { title: 'Finalizadas', value: String(cuenta('FINALIZADA')), detail: 'En el histórico' },
    ];
  });

  protected readonly asignacionesFiltradas = computed(() => {
    const texto = normalizarTexto(this.busqueda());
    const estado = this.filtroEstado();
    return this.asignaciones().filter(
      (a) =>
        (estado === 'TODAS' || (estado === 'VIGENTES' ? a.estado !== 'FINALIZADA' : a.estado === estado)) &&
        (!texto || normalizarTexto(`${a.conductorNombre} ${a.conductorCedula} ${a.vehiculoPlaca} ${a.remolquePlaca ?? ''}`).includes(texto)),
    );
  });

  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.asignacionesFiltradas().length / this.tamanoPagina)));
  protected readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  protected readonly asignacionesPagina = computed(() =>
    this.asignacionesFiltradas().slice((this.paginaActual() - 1) * this.tamanoPagina, this.paginaActual() * this.tamanoPagina),
  );
  protected readonly primeroVisible = computed(() =>
    this.asignacionesFiltradas().length ? (this.paginaActual() - 1) * this.tamanoPagina + 1 : 0,
  );
  protected readonly ultimoVisible = computed(() =>
    Math.min(this.paginaActual() * this.tamanoPagina, this.asignacionesFiltradas().length),
  );

  // Habilitar (CA 1, 2, 3, 16, 17)
  protected readonly habilitarAbierto = signal(false);
  protected readonly conductores = signal<ConductorHabilitable[]>([]);
  protected readonly automotores = signal<Vehiculo[]>([]);
  protected readonly cargandoCatalogos = signal(false);
  protected readonly conductorElegido = signal('');
  protected readonly vehiculoElegido = signal('');
  protected readonly seleccionIncompleta = signal(false);
  protected readonly habilitando = signal(false);
  protected readonly errorHabilitar = signal('');
  protected readonly puedeReintentar = signal(false);
  private solicitudPendiente: { huella: string; clave: string } | null = null;

  // Activar (CA 7 a 12, 19)
  protected readonly porActivar = signal<Asignacion | null>(null);
  protected readonly remolques = signal<Vehiculo[]>([]);
  protected readonly cargandoRemolques = signal(false);
  protected readonly remolqueElegido = signal('');
  protected readonly activando = signal(false);
  protected readonly errorActivar = signal('');

  /** Remolques activos que no están acoplados en la asignación activa de otro conductor (CA 12). */
  protected readonly remolquesDisponibles = computed(() => {
    const actual = this.porActivar();
    const ocupados = new Set(
      this.asignaciones()
        .filter((a) => a.estado === 'ACTIVA' && a.conductorId !== actual?.conductorId && a.remolqueId)
        .map((a) => a.remolqueId),
    );
    return this.remolques().filter((r) => !ocupados.has(r.id));
  });

  // Finalizar (CA 4, 5, 19)
  protected readonly porFinalizar = signal<Asignacion | null>(null);
  protected readonly finalizando = signal(false);
  protected readonly errorFinalizar = signal('');

  // Historial del vehículo (CA 6)
  protected readonly historialDe = signal<{ id: string; placa: string } | null>(null);
  protected readonly historial = signal<AsignacionDeHistorial[]>([]);
  protected readonly cargandoHistorial = signal(false);
  protected readonly errorHistorial = signal('');

  constructor() {
    this.cargar();
  }

  protected cargar(conSpinner = true): void {
    if (conSpinner) this.cargando.set(true);
    this.errorCarga.set('');
    this.asignacionService.listar().subscribe({
      next: (asignaciones) => {
        this.asignaciones.set(asignaciones);
        this.cargando.set(false);
        this.paginaActual.update((pagina) => Math.min(pagina, this.totalPaginas()));
      },
      error: (error: unknown) => {
        this.errorCarga.set(mensajeDeError(error));
        this.cargando.set(false);
      },
    });
  }

  protected alBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
    this.paginaActual.set(1);
  }

  protected alFiltrarEstado(evento: Event): void {
    this.filtroEstado.set((evento.target as HTMLSelectElement).value as FiltroEstado);
    this.paginaActual.set(1);
  }

  protected cambiarPagina(pagina: number): void {
    this.paginaActual.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  protected variante(estado: EstadoAsignacion): BadgeVariant {
    return estado === 'ACTIVA' ? 'active' : estado === 'HABILITADA' ? 'pending' : 'inactive';
  }

  // ---------------------------------------------------------------------------------------------
  // Habilitar
  // ---------------------------------------------------------------------------------------------

  protected abrirHabilitar(): void {
    this.limpiarMensajes();
    this.conductorElegido.set('');
    this.vehiculoElegido.set('');
    this.seleccionIncompleta.set(false);
    this.errorHabilitar.set('');
    this.puedeReintentar.set(false);
    this.solicitudPendiente = null;
    this.habilitarAbierto.set(true);
    this.cargarCatalogos();
  }

  protected cerrarHabilitar(): void {
    if (this.habilitando()) return;
    this.habilitarAbierto.set(false);
  }

  protected cargarCatalogos(): void {
    this.cargandoCatalogos.set(true);
    this.errorHabilitar.set('');
    let pendientes = 2;
    const terminar = () => {
      pendientes -= 1;
      if (pendientes === 0) this.cargandoCatalogos.set(false);
    };

    this.asignacionService.conductores().subscribe({
      next: (conductores) => {
        this.conductores.set(conductores);
        terminar();
      },
      error: (error: unknown) => {
        this.errorHabilitar.set(mensajeDeError(error));
        terminar();
      },
    });
    this.vehiculoService.listar({ estado: 'ACTIVO' }).subscribe({
      next: (vehiculos) => {
        this.automotores.set(vehiculos.filter((v) => TIPOS_AUTOMOTOR.includes(v.tipo)));
        terminar();
      },
      error: (error: unknown) => {
        this.errorHabilitar.set(mensajeDeError(error));
        terminar();
      },
    });
  }

  protected alElegirConductor(evento: Event): void {
    this.conductorElegido.set((evento.target as HTMLSelectElement).value);
  }

  protected alElegirVehiculo(evento: Event): void {
    this.vehiculoElegido.set((evento.target as HTMLSelectElement).value);
  }

  protected habilitar(): void {
    if (this.habilitando()) return;
    const conductorId = this.conductorElegido();
    const vehiculoId = this.vehiculoElegido();
    if (!conductorId || !vehiculoId) {
      this.seleccionIncompleta.set(true);
      return;
    }

    this.habilitando.set(true);
    this.errorHabilitar.set('');
    this.asignacionService.habilitar({ conductorId, vehiculoId }, this.claveParaHabilitar(conductorId, vehiculoId)).subscribe({
      next: (asignacion) => {
        this.solicitudPendiente = null;
        this.habilitando.set(false);
        this.habilitarAbierto.set(false);
        this.asignaciones.update((lista) => [asignacion, ...lista]);
        this.mensaje.set(`Vehículo ${asignacion.vehiculoPlaca} habilitado a ${asignacion.conductorNombre}.`);
      },
      error: (error: unknown) => {
        const codigo = codigoDeError(error);
        this.habilitando.set(false);
        this.errorHabilitar.set(mensajeDeError(error));
        this.puedeReintentar.set(!codigo || !CODIGOS_DE_DATOS.includes(codigo));
      },
    });
  }

  /**
   * Misma clave mientras se reintenta con los mismos datos (el servidor devuelve la asignación
   * ya creada); clave nueva si el administrador cambió el conductor o el vehículo (CA 17).
   */
  private claveParaHabilitar(conductorId: string, vehiculoId: string): string {
    const huella = `${conductorId}|${vehiculoId}`;
    if (this.solicitudPendiente?.huella !== huella) {
      this.solicitudPendiente = { huella, clave: nuevaClaveIdempotencia() };
    }
    return this.solicitudPendiente.clave;
  }

  // ---------------------------------------------------------------------------------------------
  // Activar
  // ---------------------------------------------------------------------------------------------

  protected pedirActivacion(asignacion: Asignacion): void {
    this.limpiarMensajes();
    this.errorActivar.set('');
    this.remolques.set([]);
    this.remolqueElegido.set(asignacion.remolqueId ?? '');
    this.porActivar.set(asignacion);

    const tipoRemolque = ACOPLE_POR_TIPO[asignacion.vehiculoTipo];
    if (!tipoRemolque) return;

    this.cargandoRemolques.set(true);
    this.vehiculoService.listar({ estado: 'ACTIVO', tipo: tipoRemolque }).subscribe({
      next: (vehiculos) => {
        this.remolques.set(vehiculos);
        this.cargandoRemolques.set(false);
      },
      error: (error: unknown) => {
        this.errorActivar.set(mensajeDeError(error));
        this.cargandoRemolques.set(false);
      },
    });
  }

  protected cancelarActivacion(): void {
    if (this.activando()) return;
    this.porActivar.set(null);
  }

  protected alElegirRemolque(evento: Event): void {
    this.remolqueElegido.set((evento.target as HTMLSelectElement).value);
  }

  protected confirmarActivacion(): void {
    const asignacion = this.porActivar();
    if (!asignacion || this.activando()) return;

    this.activando.set(true);
    this.errorActivar.set('');
    this.asignacionService
      .activar(asignacion.id, { idRemolque: this.remolqueElegido() || null, version: asignacion.version })
      .subscribe({
        next: (activada) => {
          this.activando.set(false);
          this.porActivar.set(null);
          this.mensaje.set(`Vehículo ${activada.vehiculoPlaca} activo para ${activada.conductorNombre}.`);
          // El vehículo que estaba activo vuelve a "habilitado": se recarga para reflejarlo (CA 7).
          this.cargar(false);
        },
        error: (error: unknown) => {
          this.activando.set(false);
          this.alFallarCambio(error, (texto) => this.errorActivar.set(texto), () => this.porActivar.set(null));
        },
      });
  }

  // ---------------------------------------------------------------------------------------------
  // Finalizar
  // ---------------------------------------------------------------------------------------------

  protected pedirFinalizacion(asignacion: Asignacion): void {
    this.limpiarMensajes();
    this.errorFinalizar.set('');
    this.porFinalizar.set(asignacion);
  }

  protected cancelarFinalizacion(): void {
    if (this.finalizando()) return;
    this.porFinalizar.set(null);
  }

  protected confirmarFinalizacion(): void {
    const asignacion = this.porFinalizar();
    if (!asignacion || this.finalizando()) return;

    this.finalizando.set(true);
    this.errorFinalizar.set('');
    this.asignacionService.finalizar(asignacion.id, asignacion.version).subscribe({
      next: (finalizada) => {
        this.finalizando.set(false);
        this.porFinalizar.set(null);
        this.asignaciones.update((lista) => lista.map((a) => (a.id === finalizada.id ? finalizada : a)));
        this.mensaje.set(
          `Asignación de ${finalizada.vehiculoPlaca} a ${finalizada.conductorNombre} finalizada. Se conserva en el historial.`,
        );
      },
      error: (error: unknown) => {
        this.finalizando.set(false);
        this.alFallarCambio(error, (texto) => this.errorFinalizar.set(texto), () => this.porFinalizar.set(null));
      },
    });
  }

  /**
   * CA 19: si otro administrador ya modificó la asignación, se cierra el diálogo, se recarga el
   * listado y se avisa. Cualquier otro error (viaje activo, acople inválido, red) se muestra en el diálogo.
   */
  private alFallarCambio(error: unknown, mostrarEnDialogo: (texto: string) => void, cerrarDialogo: () => void): void {
    if (codigoDeError(error) === 'ASIGNACION_MODIFICADA') {
      cerrarDialogo();
      this.aviso.set(mensajeDeError(error));
      this.cargar(false);
      return;
    }
    mostrarEnDialogo(mensajeDeError(error));
  }

  // ---------------------------------------------------------------------------------------------
  // Historial del vehículo
  // ---------------------------------------------------------------------------------------------

  protected verHistorial(vehiculoId: string, placa: string): void {
    this.historialDe.set({ id: vehiculoId, placa });
    this.cargarHistorial();
  }

  protected cargarHistorial(): void {
    const vehiculo = this.historialDe();
    if (!vehiculo) return;

    this.historial.set([]);
    this.errorHistorial.set('');
    this.cargandoHistorial.set(true);
    this.asignacionService.historialDeVehiculo(vehiculo.id).subscribe({
      next: (historial) => {
        this.historial.set(historial);
        this.cargandoHistorial.set(false);
      },
      error: (error: unknown) => {
        this.errorHistorial.set(mensajeDeError(error));
        this.cargandoHistorial.set(false);
      },
    });
  }

  protected cerrarHistorial(): void {
    this.historialDe.set(null);
  }

  private limpiarMensajes(): void {
    this.mensaje.set('');
    this.aviso.set('');
  }
}

function normalizarTexto(texto: string): string {
  return texto.trim().toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
