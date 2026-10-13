/** Tipos de vehículo (coinciden con el tipo tipo_vehiculo de PostgreSQL). */
export const TIPOS_VEHICULO = ['FURGON', 'CAMION', 'TRACTOCAMION', 'REMOLQUE', 'SEMIRREMOLQUE'] as const;
export type TipoVehiculo = (typeof TIPOS_VEHICULO)[number];

export const ESTADOS_VEHICULO = ['ACTIVO', 'INACTIVO'] as const;
export type EstadoVehiculo = (typeof ESTADOS_VEHICULO)[number];

interface FormatoPlaca {
  patron: RegExp;
  descripcion: string;
}

const AUTOMOTOR: FormatoPlaca = { patron: /^[A-Z]{3}[0-9]{3}$/, descripcion: 'AAA999 (3 letras y 3 números)' };

/** Formato legal de placa por tipo de vehículo (HU-03, reglas de negocio). */
const FORMATO_POR_TIPO: Record<TipoVehiculo, FormatoPlaca> = {
  FURGON: AUTOMOTOR,
  CAMION: AUTOMOTOR,
  TRACTOCAMION: AUTOMOTOR,
  REMOLQUE: { patron: /^R[0-9]{5}$/, descripcion: 'R99999 (R y 5 números)' },
  SEMIRREMOLQUE: { patron: /^S[0-9]{5}$/, descripcion: 'S99999 (S y 5 números)' },
};

/** Convierte la placa a mayúsculas y elimina espacios y guiones: "tkm-482" → "TKM482". */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]/g, '');
}

export function formatoPlaca(tipo: TipoVehiculo): FormatoPlaca {
  return FORMATO_POR_TIPO[tipo];
}

/** Indica si una placa ya normalizada cumple el formato de su tipo. */
export function placaCumpleFormato(placa: string, tipo: TipoVehiculo): boolean {
  return FORMATO_POR_TIPO[tipo].patron.test(placa);
}
