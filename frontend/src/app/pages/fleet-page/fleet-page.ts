import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppBadge } from '../../components/app-badge/app-badge';
import { AppButtonComponent } from '../../components/app-button/app-button';
import { AppCard } from '../../components/app-card/app-card';
import { codigoDeError, mensajeDeError } from '../../core/http/mensaje-error';
import { formatoPlaca, normalizarPlaca, placaSegunTipo } from '../../vehiculos/placa';
import {
  TIPOS_VEHICULO,
  etiquetaTipo,
  type DatosVehiculo,
  type EstadoVehiculo,
  type TipoVehiculo,
  type Vehiculo,
} from '../../vehiculos/vehiculo.model';
import { VehiculoService, nuevaClaveIdempotencia } from '../../vehiculos/vehiculo.service';

/** Errores que se corrigen cambiando los datos; los demás (red, servidor) permiten reintentar. */
const CODIGOS_DE_DATOS = ['PLACA_DUPLICADA', 'PLACA_FORMATO_INVALIDO', 'DATOS_INVALIDOS', 'CLAVE_IDEMPOTENCIA_REUTILIZADA'];

/** HU-03: gestión de vehículos de la flota (solo Administrador). */
@Component({
  selector: 'app-fleet-page',
  imports: [AppBadge, AppButtonComponent, AppCard, ReactiveFormsModule],
  templateUrl: './fleet-page.html',
  styleUrls: ['./fleet-page.css', './fleet-dialog.css', './fleet-vehiculos.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppFleetPage {
  private readonly vehiculoService = inject(VehiculoService);

  protected readonly tipos = TIPOS_VEHICULO;
  protected readonly etiquetaTipo = etiquetaTipo;

  // Listado
  protected readonly vehiculos = signal<Vehiculo[]>([]);
  protected readonly cargando = signal(true);
  protected readonly errorCarga = signal('');
  protected readonly mensaje = signal('');

  // Filtros y paginación
  protected readonly busqueda = signal('');
  protected readonly filtroEstado = signal<EstadoVehiculo | ''>('');
  protected readonly filtroTipo = signal<TipoVehiculo | ''>('');
  protected readonly paginaActual = signal(1);
  protected readonly tamanoPagina = 5;

  protected readonly metricas = computed(() => {
    const activos = this.vehiculos().filter((v) => v.estado === 'ACTIVO').length;
    return [
      { title: 'Total vehículos', value: String(this.vehiculos().length), detail: 'Registrados' },
      { title: 'Activos', value: String(activos), detail: 'Disponibles' },
      { title: 'Inactivos', value: String(this.vehiculos().length - activos), detail: 'En el histórico' },
    ];
  });

  protected readonly vehiculosFiltrados = computed(() => {
    const texto = normalizarTexto(this.busqueda());
    const estado = this.filtroEstado();
    const tipo = this.filtroTipo();
    return this.vehiculos().filter(
      (v) =>
        (!texto || normalizarTexto(`${v.placa} ${v.marca} ${v.modelo}`).includes(texto)) &&
        (!estado || v.estado === estado) &&
        (!tipo || v.tipo === tipo),
    );
  });

  protected readonly totalPaginas = computed(() => Math.max(1, Math.ceil(this.vehiculosFiltrados().length / this.tamanoPagina)));
  protected readonly paginas = computed(() => Array.from({ length: this.totalPaginas() }, (_, i) => i + 1));
  protected readonly vehiculosPagina = computed(() =>
    this.vehiculosFiltrados().slice((this.paginaActual() - 1) * this.tamanoPagina, this.paginaActual() * this.tamanoPagina),
  );
  protected readonly primeroVisible = computed(() =>
    this.vehiculosFiltrados().length ? (this.paginaActual() - 1) * this.tamanoPagina + 1 : 0,
  );
  protected readonly ultimoVisible = computed(() =>
    Math.min(this.paginaActual() * this.tamanoPagina, this.vehiculosFiltrados().length),
  );

  // Formulario de registro y edición
  protected readonly formulario = inject(FormBuilder).group(
    {
      placa: ['', Validators.required],
      tipo: ['' as TipoVehiculo | '', Validators.required],
      marca: ['', [Validators.required, Validators.maxLength(60)]],
      modelo: ['', [Validators.required, Validators.maxLength(60)]],
      numeroEjes: [null as number | null, [Validators.required, Validators.min(1), Validators.max(12), Validators.pattern(/^\d+$/)]],
      capacidadCargaKg: [null as number | null, [Validators.required, Validators.min(0.01)]],
    },
    { validators: placaSegunTipo() },
  );
  protected readonly formularioAbierto = signal(false);
  protected readonly editando = signal<Vehiculo | null>(null);
  protected readonly guardando = signal(false);
  protected readonly errorFormulario = signal('');
  protected readonly puedeReintentar = signal(false);
  private solicitudPendiente: { huella: string; clave: string } | null = null;

  // Confirmación de desactivación
  protected readonly porDesactivar = signal<Vehiculo | null>(null);
  protected readonly desactivando = signal(false);
  protected readonly errorDesactivar = signal('');

  private readonly valoresFormulario = toSignal(this.formulario.valueChanges, { initialValue: this.formulario.value });

  /** Formato esperado según el tipo elegido (ayuda visible en el formulario). */
  protected readonly formatoEsperado = computed(() => {
    const tipo = this.valoresFormulario().tipo;
    return tipo ? formatoPlaca(tipo) : null;
  });

  /** Cómo quedará guardada la placa (HU-03, escenario 4). */
  protected readonly placaNormalizada = computed(() => {
    const original = this.valoresFormulario().placa ?? '';
    const normalizada = normalizarPlaca(original);
    return normalizada && normalizada !== original ? normalizada : '';
  });

  constructor() {
    this.cargar();
  }

  protected cargar(): void {
    this.cargando.set(true);
    this.errorCarga.set('');
    this.vehiculoService.listar().subscribe({
      next: (vehiculos) => {
        this.vehiculos.set(vehiculos);
        this.cargando.set(false);
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
    this.filtroEstado.set((evento.target as HTMLSelectElement).value as EstadoVehiculo | '');
    this.paginaActual.set(1);
  }

  protected alFiltrarTipo(evento: Event): void {
    this.filtroTipo.set((evento.target as HTMLSelectElement).value as TipoVehiculo | '');
    this.paginaActual.set(1);
  }

  protected cambiarPagina(pagina: number): void {
    this.paginaActual.set(Math.min(Math.max(pagina, 1), this.totalPaginas()));
  }

  protected abrirRegistro(): void {
    this.editando.set(null);
    this.formulario.reset({ placa: '', tipo: '', marca: '', modelo: '', numeroEjes: null, capacidadCargaKg: null });
    this.abrirFormulario();
  }

  protected abrirEdicion(vehiculo: Vehiculo): void {
    this.editando.set(vehiculo);
    this.formulario.reset({
      placa: vehiculo.placa,
      tipo: vehiculo.tipo,
      marca: vehiculo.marca,
      modelo: vehiculo.modelo,
      numeroEjes: vehiculo.numeroEjes,
      capacidadCargaKg: vehiculo.capacidadCargaKg,
    });
    this.abrirFormulario();
  }

  protected cerrarFormulario(): void {
    if (this.guardando()) return;
    this.formularioAbierto.set(false);
  }

  protected campoInvalido(campo: keyof typeof this.formulario.controls): boolean {
    const control = this.formulario.controls[campo];
    return control.invalid && control.touched;
  }

  protected guardar(): void {
    if (this.guardando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const datos = this.datosFormulario();
    const editando = this.editando();
    this.guardando.set(true);
    this.errorFormulario.set('');

    const solicitud = editando
      ? this.vehiculoService.editar(editando.id, datos)
      : this.vehiculoService.registrar(datos, this.claveParaRegistro(datos));

    solicitud.subscribe({
      next: (vehiculo) => {
        this.solicitudPendiente = null;
        this.guardando.set(false);
        this.formularioAbierto.set(false);
        this.reemplazarEnListado(vehiculo);
        this.mensaje.set(editando ? `Vehículo ${vehiculo.placa} actualizado.` : `Vehículo ${vehiculo.placa} registrado.`);
      },
      error: (error: unknown) => {
        const codigo = codigoDeError(error);
        this.guardando.set(false);
        this.errorFormulario.set(mensajeDeError(error));
        this.puedeReintentar.set(!codigo || !CODIGOS_DE_DATOS.includes(codigo));
      },
    });
  }

  protected pedirDesactivacion(vehiculo: Vehiculo): void {
    this.mensaje.set('');
    this.errorDesactivar.set('');
    this.porDesactivar.set(vehiculo);
  }

  protected cancelarDesactivacion(): void {
    if (this.desactivando()) return;
    this.porDesactivar.set(null);
  }

  /** HU-03, escenarios 6 y 7: desactivación lógica; se rechaza si el vehículo está en un viaje activo. */
  protected confirmarDesactivacion(): void {
    const vehiculo = this.porDesactivar();
    if (!vehiculo || this.desactivando()) return;

    this.desactivando.set(true);
    this.errorDesactivar.set('');
    this.vehiculoService.desactivar(vehiculo.id).subscribe({
      next: (actualizado) => {
        this.desactivando.set(false);
        this.porDesactivar.set(null);
        this.reemplazarEnListado(actualizado);
        this.mensaje.set(`Vehículo ${actualizado.placa} desactivado. Se conserva en el histórico.`);
      },
      error: (error: unknown) => {
        this.desactivando.set(false);
        this.errorDesactivar.set(mensajeDeError(error));
      },
    });
  }

  protected variante(estado: EstadoVehiculo): 'active' | 'inactive' {
    return estado === 'ACTIVO' ? 'active' : 'inactive';
  }

  private abrirFormulario(): void {
    this.mensaje.set('');
    this.errorFormulario.set('');
    this.puedeReintentar.set(false);
    this.solicitudPendiente = null;
    this.formularioAbierto.set(true);
  }

  private datosFormulario(): DatosVehiculo {
    const valores = this.formulario.getRawValue();
    return {
      placa: normalizarPlaca(valores.placa ?? ''),
      tipo: valores.tipo as TipoVehiculo,
      marca: (valores.marca ?? '').trim(),
      modelo: (valores.modelo ?? '').trim(),
      numeroEjes: Number(valores.numeroEjes),
      capacidadCargaKg: Number(valores.capacidadCargaKg),
    };
  }

  /**
   * Misma clave mientras se reintenta con los mismos datos (el servidor devuelve el vehículo
   * ya creado); clave nueva si el administrador cambió algún dato.
   */
  private claveParaRegistro(datos: DatosVehiculo): string {
    const huella = JSON.stringify(datos);
    if (this.solicitudPendiente?.huella !== huella) {
      this.solicitudPendiente = { huella, clave: nuevaClaveIdempotencia() };
    }
    return this.solicitudPendiente.clave;
  }

  protected reemplazarEnListado(vehiculo: Vehiculo): void {
    this.vehiculos.update((lista) => {
      const sinEl = lista.filter((v) => v.id !== vehiculo.id);
      return [...sinEl, vehiculo].sort((a, b) => a.placa.localeCompare(b.placa));
    });
  }
}

function normalizarTexto(texto: string): string {
  return texto.trim().toLocaleLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
