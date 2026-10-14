/** Tipos de vehículo (coinciden con el backend, HU-03). */
export type TipoVehiculo = 'FURGON' | 'CAMION' | 'TRACTOCAMION' | 'REMOLQUE' | 'SEMIRREMOLQUE';
export type EstadoVehiculo = 'ACTIVO' | 'INACTIVO';

export const TIPOS_VEHICULO: { valor: TipoVehiculo; etiqueta: string }[] = [
  { valor: 'FURGON', etiqueta: 'Furgón' },
  { valor: 'CAMION', etiqueta: 'Camión' },
  { valor: 'TRACTOCAMION', etiqueta: 'Tractocamión' },
  { valor: 'REMOLQUE', etiqueta: 'Remolque' },
  { valor: 'SEMIRREMOLQUE', etiqueta: 'Semirremolque' },
];

export function etiquetaTipo(tipo: TipoVehiculo): string {
  return TIPOS_VEHICULO.find((t) => t.valor === tipo)?.etiqueta ?? tipo;
}

export interface Vehiculo {
  id: string;
  placa: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  numeroEjes: number;
  capacidadCargaKg: number;
  estado: EstadoVehiculo;
  createdAt: string;
  updatedAt: string;
}

/** Datos para registrar o editar un vehículo. */
export type DatosVehiculo = Pick<Vehiculo, 'placa' | 'tipo' | 'marca' | 'modelo' | 'numeroEjes' | 'capacidadCargaKg'>;

export interface FiltrosVehiculos {
  estado?: EstadoVehiculo;
  tipo?: TipoVehiculo;
  q?: string;
}
