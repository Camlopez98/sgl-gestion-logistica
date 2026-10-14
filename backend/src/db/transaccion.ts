import type { PoolClient } from 'pg';
import { pool } from './pool';

/**
 * Ejecuta `trabajo` dentro de una transacción. Si algo falla, se hace ROLLBACK
 * y no queda ningún cambio parcial en la base de datos.
 *
 *   await enTransaccion(async (cliente) => {
 *     await cliente.query('UPDATE ...');
 *     await cliente.query('INSERT ...');
 *   });
 */
export async function enTransaccion<T>(trabajo: (cliente: PoolClient) => Promise<T>): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await trabajo(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
  }
}
