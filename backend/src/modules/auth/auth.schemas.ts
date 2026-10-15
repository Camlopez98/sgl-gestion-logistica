import { z } from 'zod';

export const esquemaLogin = z.object({
  email: z
    .string({ error: 'El correo es obligatorio.' })
    .trim()
    .toLowerCase()
    .min(1, 'El correo es obligatorio.')
    .pipe(z.email('El correo no tiene un formato válido.')),
  password: z.string({ error: 'La contraseña es obligatoria.' }).min(1, 'La contraseña es obligatoria.'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
