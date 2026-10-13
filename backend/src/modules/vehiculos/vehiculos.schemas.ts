import { z } from 'zod';
import { ESTADOS_VEHICULO, TIPOS_VEHICULO, normalizarPlaca } from './placa';

const MENSAJE_TIPO = `El tipo debe ser uno de: ${TIPOS_VEHICULO.join(', ')}.`;

const texto = (campo: string) =>
  z
    .string({ error: `${campo} es obligatorio.` })
    .trim()
    .min(1, `${campo} es obligatorio.`)
    .max(60, `${campo} admite máximo 60 caracteres.`);

/** Datos para registrar o editar un vehículo. La placa se normaliza antes de validar su formato. */
export const esquemaVehiculo = z.object({
  placa: z
    .string({ error: 'La placa es obligatoria.' })
    .transform(normalizarPlaca)
    .pipe(z.string().min(1, 'La placa es obligatoria.')),
  tipo: z.enum(TIPOS_VEHICULO, { error: MENSAJE_TIPO }),
  marca: texto('La marca'),
  modelo: texto('El modelo'),
  numeroEjes: z
    .number({ error: 'El número de ejes debe ser un número.' })
    .int('El número de ejes debe ser un número entero.')
    .min(1, 'El número de ejes debe ser al menos 1.')
    .max(12, 'El número de ejes no puede superar 12.'),
  capacidadCargaKg: z
    .number({ error: 'La capacidad de carga debe ser un número.' })
    .positive('La capacidad de carga debe ser mayor que cero.')
    .max(99_999_999, 'La capacidad de carga es demasiado alta.'),
});

export type DatosVehiculo = z.infer<typeof esquemaVehiculo>;

export const esquemaFiltrosVehiculos = z.object({
  estado: z.enum(ESTADOS_VEHICULO, { error: 'El estado debe ser ACTIVO o INACTIVO.' }).optional(),
  tipo: z.enum(TIPOS_VEHICULO, { error: MENSAJE_TIPO }).optional(),
  q: z.string().trim().max(60).optional(),
});

export type FiltrosVehiculos = z.infer<typeof esquemaFiltrosVehiculos>;
