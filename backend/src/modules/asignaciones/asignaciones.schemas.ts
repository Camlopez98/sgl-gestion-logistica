import { z } from 'zod';

export const ESTADOS_ASIGNACION = ['HABILITADA', 'ACTIVA', 'FINALIZADA'] as const;
export type EstadoAsignacion = (typeof ESTADOS_ASIGNACION)[number];

const identificador = (campo: string) =>
  z.uuid({ error: `${campo} debe ser un identificador válido.` });

const version = z
  .number({ error: 'La versión debe ser un número.' })
  .int('La versión debe ser un número entero.')
  .positive('La versión debe ser mayor que cero.');

/** CA 1: habilitar un vehículo automotor a un conductor. */
export const esquemaHabilitar = z.object({
  conductorId: identificador('El conductor'),
  vehiculoId: identificador('El vehículo'),
});

export type DatosHabilitar = z.infer<typeof esquemaHabilitar>;

/**
 * CA 7 y 10: activar la asignación, con su remolque o semirremolque si aplica.
 * `version` es opcional: si se envía, se rechaza el cambio cuando otro administrador ya modificó
 * la asignación (CA 19).
 */
export const esquemaActivar = z.object({
  idRemolque: identificador('El remolque').nullish(),
  version: version.optional(),
});

export type DatosActivar = z.infer<typeof esquemaActivar>;

export const esquemaFinalizar = z.object({
  version: version.optional(),
});

export type DatosFinalizar = z.infer<typeof esquemaFinalizar>;

export const esquemaFiltrosAsignaciones = z.object({
  conductorId: identificador('El conductor').optional(),
  estado: z.enum(ESTADOS_ASIGNACION, { error: `El estado debe ser uno de: ${ESTADOS_ASIGNACION.join(', ')}.` }).optional(),
});

export type FiltrosAsignaciones = z.infer<typeof esquemaFiltrosAsignaciones>;
