import { afterAll, beforeAll } from 'vitest';
import { pool } from '../src/db/pool';
import { enTransaccion } from '../src/db/transaccion';
import { sembrarUsuariosPrueba } from '../scripts/seed';

beforeAll(async () => {
  await pool.query(
    'TRUNCATE solicitudes_idempotentes, asignaciones_vehiculo, gastos_ruta, manifiestos_carga, viajes, vehiculos, bitacora_intentos_fallidos, conductores, administradores, contadores, usuarios',
  );
  await enTransaccion(sembrarUsuariosPrueba);
});

afterAll(async () => {
  await pool.end();
});
