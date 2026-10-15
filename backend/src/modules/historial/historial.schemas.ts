import { z } from 'zod';

export const ESTADOS_VIAJE = ['ACTIVO', 'PENDIENTE_REVISION', 'FINALIZADO'] as const;
export type EstadoViaje = (typeof ESTADOS_VIAJE)[number];

/** Tamaño de cada bloque del historial: los 5 más recientes y cada "ver más" (HU-05, CA 2 y 3). */
export const TAMANO_BLOQUE = 5;
export const TAMANO_BLOQUE_MAXIMO = 20;

const fecha = (campo: string) => z.iso.date({ error: `${campo} debe tener el formato AAAA-MM-DD.` });

/**
 * Filtros del historial (CA 5). `desde` y `hasta` son fechas de calendario (hora de Colombia) y ambas
 * se incluyen completas. `cursor` es opaco: lo entrega el servidor en `siguienteCursor`.
 */
export const esquemaFiltrosHistorial = z
  .object({
    limite: z.coerce
      .number({ error: 'El límite debe ser un número.' })
      .int('El límite debe ser un número entero.')
      .min(1, 'El límite debe ser al menos 1.')
      .max(TAMANO_BLOQUE_MAXIMO, `El límite no puede superar ${TAMANO_BLOQUE_MAXIMO}.`)
      .default(TAMANO_BLOQUE),
    cursor: z.string().min(1).max(200).optional(),
    estado: z.enum(ESTADOS_VIAJE, { error: `El estado debe ser uno de: ${ESTADOS_VIAJE.join(', ')}.` }).optional(),
    desde: fecha('La fecha inicial').optional(),
    hasta: fecha('La fecha final').optional(),
  })
  .refine((filtros) => !filtros.desde || !filtros.hasta || filtros.desde <= filtros.hasta, {
    error: 'La fecha inicial no puede ser posterior a la fecha final.',
    path: ['desde'],
  });

export type FiltrosHistorial = z.infer<typeof esquemaFiltrosHistorial>;
