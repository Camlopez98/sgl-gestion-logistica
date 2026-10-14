import 'dotenv/config';
import { z } from 'zod';

const esquemaEnv = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  DATABASE_URL_TEST: z.string().optional(),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:4200'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_EXPIRA_EN: z.coerce.number().int().positive().default(1800),
  BCRYPT_COSTO: z.coerce.number().int().min(4).max(15).default(12),
});

const resultado = esquemaEnv.safeParse(process.env);

if (!resultado.success) {
  const detalle = resultado.error.issues
    .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Variables de entorno inválidas. Revise su archivo .env:\n${detalle}`);
}

const datos = resultado.data;

export const env = {
  ...datos,
  // En pruebas se usa la base de datos de pruebas para no tocar los datos de desarrollo.
  DATABASE_URL:
    datos.NODE_ENV === 'test' && datos.DATABASE_URL_TEST ? datos.DATABASE_URL_TEST : datos.DATABASE_URL,
};
