import { Pool } from 'pg';
import { env } from '../config/env';

/** Pool único de conexiones a PostgreSQL, compartido por todos los repositorios. */
export const pool = new Pool({ connectionString: env.DATABASE_URL });

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión inactiva de PostgreSQL', error);
});

export async function verificarConexion(): Promise<void> {
  await pool.query('SELECT 1');
}
