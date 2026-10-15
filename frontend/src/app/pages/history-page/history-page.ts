import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import { TimeoutError } from 'rxjs';
import { AppBadge } from '../../components/app-badge/app-badge';
import { mensajeDeError } from '../../core/http/mensaje-error';
import { diaDeCalendarioColombia, formatearFecha, formatearFechaHora, formatearMoneda } from '../../historial/formato';
import { HistorialCache } from '../../historial/historial-cache';
import { HistorialService } from '../../historial/historial.service';
import {
  ESTADOS_VIAJE,
  etiquetaEstado,
  varianteDeEstado,
  type DetalleDeViaje,
  type EstadoViaje,
  type FiltrosHistorial,
  type ViajeDeLista,
} from '../../historial/viaje.model';

const MENSAJE_SIN_DATOS_OFFLINE =
  'No hay datos disponibles sin conexión. Conéctese a internet para consultar su historial de viajes.';
const MENSAJE_ERROR_CONEXION_VER_MAS =
  'Error de conexión: no se pudieron cargar más viajes. Los que ya ve siguen aquí. Revise su conexión e inténtelo de nuevo.';
const MENSAJE_DETALLE_SIN_DATOS = 'Este viaje no está guardado en el dispositivo. Conéctese a internet para consultarlo.';

/**
 * HU-05: historial de viajes del conductor. Vista de solo lectura pensada para el navegador del celular.
 *
 * - Muestra los 5 más recientes y "ver más" agrega el siguiente bloque (CA 2 y 3).
 * - Filtra por estado y rango de fechas (CA 5) y abre el detalle de un viaje (CA 6).
 * - Sin conexión muestra la última copia guardada en el dispositivo, avisando que puede no estar
 *   actualizada (CA 10 a 13). La copia se borra al cerrar sesión (CA 9).
 * - No ofrece gráficas, exportación ni edición (CA 7).
 */
@Component({
  selector: 'app-history-page',
  imports: [AppBadge],
  templateUrl: './history-page.html',
  styleUrls: ['./history-page.css', './history-detail.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(window:online)': 'alRecuperarConexion()' },
})
export class AppHistoryPage {
  private readonly historial = inject(HistorialService);
  private readonly cache = inject(HistorialCache);

  private cargaInicial?: Subscription;
  private cargaMas?: Subscription;
  private cargaDetalle?: Subscription;

  protected readonly estados = ESTADOS_VIAJE;
  protected readonly etiquetaEstado = etiquetaEstado;
  protected readonly varianteDeEstado = varianteDeEstado;
  protected readonly formatearMoneda = formatearMoneda;
  protected readonly formatearFecha = formatearFecha;
  protected readonly formatearFechaHora = formatearFechaHora;

  // Formulario de filtros (se aplican al confirmar).
  protected readonly filtroEstado = signal<EstadoViaje | ''>('');
  protected readonly filtroDesde = signal('');
  protected readonly filtroHasta = signal('');
  protected readonly errorFiltros = signal('');
  private readonly filtrosAplicados = signal<FiltrosHistorial>({});

  // Lista.
  protected readonly viajes = signal<ViajeDeLista[]>([]);
  protected readonly total = signal(0);
  private readonly siguienteCursor = signal<string | null>(null);
  protected readonly cargando = signal(true);
  protected readonly cargandoMas = signal(false);
  protected readonly error = signal('');
  protected readonly errorVerMas = signal('');
  protected readonly sinDatosSinConexion = signal(false);
  /** Momento de la copia guardada que se está mostrando; null cuando los datos vienen del servidor. */
  protected readonly datosGuardadosDe = signal<Date | null>(null);

  protected readonly hayFiltros = computed(() => Object.keys(this.filtrosAplicados()).length > 0);
  protected readonly filtroEnFormulario = computed(
    () => !!(this.filtroEstado() || this.filtroDesde() || this.filtroHasta()) || this.hayFiltros(),
  );
  /** Con datos guardados no hay más bloques que pedir: se actualiza la vista completa. */
  protected readonly hayMas = computed(() => this.datosGuardadosDe() === null && this.siguienteCursor() !== null);

  // Detalle.
  protected readonly viajeAbierto = signal<ViajeDeLista | null>(null);
  protected readonly detalle = signal<DetalleDeViaje | null>(null);
  protected readonly detalleCargando = signal(false);
  protected readonly detalleError = signal('');
  protected readonly detalleGuardadoDe = signal<Date | null>(null);
  protected readonly fotoNoDisponible = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.cargaInicial?.unsubscribe();
      this.cargaMas?.unsubscribe();
      this.cargaDetalle?.unsubscribe();
    });
    this.cargarDesdeElInicio();
  }

  // ---------------------------------------------------------------------------------------------
  // Filtros

  protected alCambiarEstado(evento: Event): void {
    this.filtroEstado.set((evento.target as HTMLSelectElement).value as EstadoViaje | '');
  }

  protected alCambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    (campo === 'desde' ? this.filtroDesde : this.filtroHasta).set(valor);
  }

  protected aplicarFiltros(): void {
    const desde = this.filtroDesde();
    const hasta = this.filtroHasta();
    if (desde && hasta && desde > hasta) {
      this.errorFiltros.set('La fecha inicial no puede ser posterior a la fecha final.');
      return;
    }
    this.errorFiltros.set('');
    this.filtrosAplicados.set({
      ...(this.filtroEstado() ? { estado: this.filtroEstado() as EstadoViaje } : {}),
      ...(desde ? { desde } : {}),
      ...(hasta ? { hasta } : {}),
    });
    this.cargarDesdeElInicio();
  }

  protected limpiarFiltros(): void {
    this.filtroEstado.set('');
    this.filtroDesde.set('');
    this.filtroHasta.set('');
    this.errorFiltros.set('');
    this.filtrosAplicados.set({});
    this.cargarDesdeElInicio();
  }

  // ---------------------------------------------------------------------------------------------
  // Lista

  /** Carga los viajes más recientes (con los filtros aplicados). También actualiza datos guardados (CA 13). */
  protected cargarDesdeElInicio(): void {
    this.cargaInicial?.unsubscribe();
    this.cargaMas?.unsubscribe();
    this.cargando.set(true);
    this.cargandoMas.set(false);
    this.error.set('');
    this.errorVerMas.set('');
    this.sinDatosSinConexion.set(false);

    const filtros = this.filtrosAplicados();
    this.cargaInicial = this.historial.listar(filtros).subscribe({
      next: (pagina) => {
        this.viajes.set(pagina.items);
        this.total.set(pagina.total);
        this.siguienteCursor.set(pagina.siguienteCursor);
        this.datosGuardadosDe.set(null);
        this.cargando.set(false);
        if (!hayFiltros(filtros)) this.cache.guardarLista(pagina.items, pagina.total, pagina.siguienteCursor);
      },
      error: (error: unknown) => this.alFallarLaCarga(error, filtros),
    });
  }

  /** CA 3: agrega el siguiente bloque sin repetir los ya mostrados. */
  protected verMas(): void {
    const cursor = this.siguienteCursor();
    if (!cursor || this.cargandoMas()) return;

    const filtros = this.filtrosAplicados();
    this.cargandoMas.set(true);
    this.errorVerMas.set('');
    this.cargaMas = this.historial.listar(filtros, cursor).subscribe({
      next: (pagina) => {
        const yaMostrados = new Set(this.viajes().map((viaje) => viaje.id));
        this.viajes.update((actuales) => [...actuales, ...pagina.items.filter((viaje) => !yaMostrados.has(viaje.id))]);
        this.total.set(pagina.total);
        this.siguienteCursor.set(pagina.siguienteCursor);
        this.cargandoMas.set(false);
        if (!hayFiltros(filtros)) this.cache.guardarLista(this.viajes(), pagina.total, pagina.siguienteCursor);
      },
      // CA 11: lo ya cargado se conserva; solo se informa el error y se permite reintentar.
      error: (error: unknown) => {
        this.cargandoMas.set(false);
        this.errorVerMas.set(esErrorDeConexion(error) ? MENSAJE_ERROR_CONEXION_VER_MAS : mensajeDeError(error));
      },
    });
  }

  protected alRecuperarConexion(): void {
    // CA 13: al volver internet se actualizan solos los datos guardados que se estaban mostrando.
    if (this.datosGuardadosDe() !== null && !this.cargando()) this.cargarDesdeElInicio();
  }

  private alFallarLaCarga(error: unknown, filtros: FiltrosHistorial): void {
    this.cargando.set(false);

    if (esFalloDeComunicacion(error)) {
      const guardado = this.cache.leerLista();
      if (guardado) {
        // CA 10: última versión guardada, con la fecha y hora de su última actualización.
        const visibles = filtrarGuardados(guardado.items, filtros);
        this.viajes.set(visibles);
        this.total.set(hayFiltros(filtros) ? visibles.length : guardado.total);
        this.siguienteCursor.set(null);
        this.datosGuardadosDe.set(new Date(guardado.actualizadoEn));
        return;
      }
      if (error instanceof HttpErrorResponse && error.status === 0) {
        // CA 12: nunca se cargó el historial y no hay conexión.
        this.sinDatosSinConexion.set(true);
        return;
      }
    }
    this.error.set(mensajeDeError(error));
  }

  // ---------------------------------------------------------------------------------------------
  // Detalle (solo lectura)

  protected abrirDetalle(viaje: ViajeDeLista): void {
    this.viajeAbierto.set(viaje);
    this.cargarDetalle();
  }

  protected cargarDetalle(): void {
    const viaje = this.viajeAbierto();
    if (!viaje) return;

    this.cargaDetalle?.unsubscribe();
    this.detalle.set(null);
    this.detalleError.set('');
    this.detalleGuardadoDe.set(null);
    this.fotoNoDisponible.set(false);
    this.detalleCargando.set(true);

    this.cargaDetalle = this.historial.detalle(viaje.id).subscribe({
      next: (detalle) => {
        this.detalle.set(detalle);
        this.detalleCargando.set(false);
        this.cache.guardarDetalle(detalle);
      },
      error: (error: unknown) => {
        this.detalleCargando.set(false);
        if (esFalloDeComunicacion(error)) {
          const guardado = this.cache.leerDetalle(viaje.id);
          if (guardado) {
            this.detalle.set(guardado.detalle);
            this.detalleGuardadoDe.set(new Date(guardado.actualizadoEn));
            return;
          }
          if (error instanceof HttpErrorResponse && error.status === 0) {
            this.detalleError.set(MENSAJE_DETALLE_SIN_DATOS);
            return;
          }
        }
        this.detalleError.set(mensajeDeError(error));
      },
    });
  }

  protected cerrarDetalle(): void {
    this.cargaDetalle?.unsubscribe();
    this.viajeAbierto.set(null);
    this.detalle.set(null);
    this.detalleError.set('');
    this.detalleCargando.set(false);
  }

  protected readonly mensajeSinDatos = MENSAJE_SIN_DATOS_OFFLINE;
}

function hayFiltros(filtros: FiltrosHistorial): boolean {
  return Object.keys(filtros).length > 0;
}

/** Sin internet o servidor que no responde. */
function esErrorDeConexion(error: unknown): boolean {
  return error instanceof TimeoutError || (error instanceof HttpErrorResponse && error.status === 0);
}

/** Sin internet, servidor que no responde o con error propio: se puede mostrar la copia guardada. */
function esFalloDeComunicacion(error: unknown): boolean {
  return error instanceof TimeoutError || (error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500));
}

/** Aplica los filtros sobre los viajes guardados cuando no se puede consultar al servidor. */
function filtrarGuardados(items: ViajeDeLista[], filtros: FiltrosHistorial): ViajeDeLista[] {
  return items.filter((viaje) => {
    if (filtros.estado && viaje.estado !== filtros.estado) return false;
    const dia = diaDeCalendarioColombia(viaje.fechaInicio);
    if (filtros.desde && dia < filtros.desde) return false;
    if (filtros.hasta && dia > filtros.hasta) return false;
    return true;
  });
}
