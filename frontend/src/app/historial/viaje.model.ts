import type { BadgeVariant } from '../components/app-badge/app-badge';

/** Estados de un viaje (coinciden con el backend). */
export type EstadoViaje = 'ACTIVO' | 'PENDIENTE_REVISION' | 'FINALIZADO';

export const ESTADOS_VIAJE: { valor: EstadoViaje; etiqueta: string }[] = [
  { valor: 'ACTIVO', etiqueta: 'En curso' },
  { valor: 'PENDIENTE_REVISION', etiqueta: 'En revisión' },
  { valor: 'FINALIZADO', etiqueta: 'Finalizado' },
];

export function etiquetaEstado(estado: EstadoViaje): string {
  return ESTADOS_VIAJE.find((e) => e.valor === estado)?.etiqueta ?? estado;
}

const VARIANTE_POR_ESTADO: Record<EstadoViaje, BadgeVariant> = {
  ACTIVO: 'active',
  PENDIENTE_REVISION: 'review',
  FINALIZADO: 'completed',
};

export function varianteDeEstado(estado: EstadoViaje): BadgeVariant {
  return VARIANTE_POR_ESTADO[estado];
}

/** Tamaño de cada bloque del historial: los 5 más recientes y cada "ver más" (HU-05, CA 2 y 3). */
export const TAMANO_BLOQUE = 5;

/** Fila del historial (GET /api/conductores/me/viajes). */
export interface ViajeDeLista {
  id: string;
  estado: EstadoViaje;
  origen: string;
  destino: string;
  valorFlete: number;
  fechaInicio: string;
  placaVehiculo: string;
  totalGastos: number;
}

export interface PaginaHistorial {
  items: ViajeDeLista[];
  /** Cursor para pedir el siguiente bloque; null cuando ya no hay más viajes. */
  siguienteCursor: string | null;
  total: number;
}

/** Filtros del historial: fechas AAAA-MM-DD (hora de Colombia), ambas incluidas. */
export interface FiltrosHistorial {
  estado?: EstadoViaje;
  desde?: string;
  hasta?: string;
}

export interface ManifiestoDeViaje {
  numeroManifiesto: string;
  urlImagen: string;
  tipoMime: string;
  fechaCarga: string;
}

export interface GastoDeViaje {
  id: string;
  tipo: string;
  monto: number;
  concepto: string;
  urlSoporte: string | null;
  createdAt: string;
}

/** Detalle de un viaje propio (GET /api/conductores/me/viajes/{id}). */
export interface DetalleDeViaje {
  id: string;
  estado: EstadoViaje;
  origen: string;
  destino: string;
  valorFlete: number;
  fechaInicio: string;
  fechaEntrega: string | null;
  placaVehiculo: string;
  placaRemolque: string | null;
  manifiesto: ManifiestoDeViaje | null;
  gastos: GastoDeViaje[];
  totalGastos: number;
}
