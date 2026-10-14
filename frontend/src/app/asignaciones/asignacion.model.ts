import type { TipoVehiculo } from '../vehiculos/vehiculo.model';

/** Estados de la asignación (coinciden con el backend, HU-04). */
export type EstadoAsignacion = 'HABILITADA' | 'ACTIVA' | 'FINALIZADA';

export const ESTADOS_ASIGNACION: { valor: EstadoAsignacion; etiqueta: string }[] = [
  { valor: 'HABILITADA', etiqueta: 'Habilitada' },
  { valor: 'ACTIVA', etiqueta: 'Activa' },
  { valor: 'FINALIZADA', etiqueta: 'Finalizada' },
];

export function etiquetaEstadoAsignacion(estado: EstadoAsignacion): string {
  return ESTADOS_ASIGNACION.find((e) => e.valor === estado)?.etiqueta ?? estado;
}

export interface Asignacion {
  id: string;
  conductorId: string;
  conductorNombre: string;
  conductorCedula: string;
  vehiculoId: string;
  vehiculoPlaca: string;
  vehiculoTipo: TipoVehiculo;
  remolqueId: string | null;
  remolquePlaca: string | null;
  estado: EstadoAsignacion;
  fechaAsignacion: string;
  fechaActivacion: string | null;
  fechaFinalizacion: string | null;
  /** Se envía al activar o finalizar: si otro administrador ya cambió la asignación, el servidor lo rechaza (CA 19). */
  version: number;
  createdAt: string;
  updatedAt: string;
}

/** Asignación en el historial de un vehículo: el vehículo pudo ser el automotor o el remolque acoplado. */
export interface AsignacionDeHistorial extends Asignacion {
  rolEnAsignacion: 'VEHICULO' | 'REMOLQUE';
}

export interface ConductorHabilitable {
  id: string;
  nombreCompleto: string;
  cedula: string;
  categoriaLicencia: string;
}

export interface DatosHabilitar {
  conductorId: string;
  vehiculoId: string;
}

export interface DatosActivar {
  idRemolque: string | null;
  version: number;
}

export interface FiltrosAsignaciones {
  conductorId?: string;
  estado?: EstadoAsignacion;
}

/** Vehículo (o remolque) en la respuesta del selector del conductor. */
export interface VehiculoDeSelector {
  id: string;
  placa: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
}

/** GET /api/conductores/me/vehiculo-activo: lo único que el conductor puede seleccionar (CA 13). */
export interface VehiculoActivo {
  asignacionId: string;
  vehiculo: VehiculoDeSelector;
  remolque: VehiculoDeSelector | null;
}

/** Vehículo y remolque elegidos para un manifiesto. */
export interface SeleccionVehiculo {
  vehiculoId: string;
  remolqueId: string | null;
}

/** Tipo de remolque que admite cada automotor; los demás no admiten acople (CA 10 y 11). */
export const ACOPLE_POR_TIPO: Partial<Record<TipoVehiculo, TipoVehiculo>> = {
  CAMION: 'REMOLQUE',
  TRACTOCAMION: 'SEMIRREMOLQUE',
};
