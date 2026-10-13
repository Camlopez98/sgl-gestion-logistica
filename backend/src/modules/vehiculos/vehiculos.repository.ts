import type { PoolClient } from 'pg';
import { pool } from '../../db/pool';
import type { EstadoVehiculo, TipoVehiculo } from './placa';
import type { DatosVehiculo, FiltrosVehiculos } from './vehiculos.schemas';

export interface Vehiculo {
  id: string;
  placa: string;
  tipo: TipoVehiculo;
  marca: string;
  modelo: string;
  numeroEjes: number;
  capacidadCargaKg: number;
  estado: EstadoVehiculo;
  createdAt: Date;
  updatedAt: Date;
}

type Ejecutor = Pick<PoolClient, 'query'>;

const COLUMNAS = `
  id,
  placa,
  tipo,
  marca,
  modelo,
  numero_ejes                AS "numeroEjes",
  capacidad_carga_kg::float8 AS "capacidadCargaKg",
  estado,
  created_at                 AS "createdAt",
  updated_at                 AS "updatedAt"`;

export async function crear(datos: DatosVehiculo, ejecutor: Ejecutor = pool): Promise<Vehiculo> {
  const { rows } = await ejecutor.query<Vehiculo>(
    `INSERT INTO vehiculos (placa, tipo, marca, modelo, numero_ejes, capacidad_carga_kg)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${COLUMNAS}`,
    [datos.placa, datos.tipo, datos.marca, datos.modelo, datos.numeroEjes, datos.capacidadCargaKg],
  );
  return rows[0];
}

export async function listar(filtros: FiltrosVehiculos): Promise<Vehiculo[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.estado) {
    valores.push(filtros.estado);
    condiciones.push(`estado = $${valores.length}`);
  }
  if (filtros.tipo) {
    valores.push(filtros.tipo);
    condiciones.push(`tipo = $${valores.length}`);
  }
  if (filtros.q) {
    valores.push(`%${filtros.q}%`);
    condiciones.push(`(placa ILIKE $${valores.length} OR marca ILIKE $${valores.length} OR modelo ILIKE $${valores.length})`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await pool.query<Vehiculo>(`SELECT ${COLUMNAS} FROM vehiculos ${where} ORDER BY placa`, valores);
  return rows;
}

export async function buscarPorId(id: string): Promise<Vehiculo | null> {
  const { rows } = await pool.query<Vehiculo>(`SELECT ${COLUMNAS} FROM vehiculos WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

/** Busca otro vehículo con la placa indicada, excluyendo opcionalmente un id (para la edición). */
export async function buscarPorPlaca(placa: string, excluirId?: string): Promise<Vehiculo | null> {
  const { rows } = await pool.query<Vehiculo>(
    `SELECT ${COLUMNAS} FROM vehiculos WHERE placa = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)`,
    [placa, excluirId ?? null],
  );
  return rows[0] ?? null;
}

export async function actualizar(id: string, datos: DatosVehiculo): Promise<Vehiculo | null> {
  const { rows } = await pool.query<Vehiculo>(
    `UPDATE vehiculos
     SET placa = $2, tipo = $3, marca = $4, modelo = $5, numero_ejes = $6, capacidad_carga_kg = $7
     WHERE id = $1
     RETURNING ${COLUMNAS}`,
    [id, datos.placa, datos.tipo, datos.marca, datos.modelo, datos.numeroEjes, datos.capacidadCargaKg],
  );
  return rows[0] ?? null;
}

export async function cambiarEstado(id: string, estado: EstadoVehiculo): Promise<Vehiculo | null> {
  const { rows } = await pool.query<Vehiculo>(
    `UPDATE vehiculos SET estado = $2 WHERE id = $1 RETURNING ${COLUMNAS}`,
    [id, estado],
  );
  return rows[0] ?? null;
}
