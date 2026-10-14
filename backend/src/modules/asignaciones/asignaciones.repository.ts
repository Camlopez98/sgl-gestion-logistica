import type { PoolClient } from 'pg';
import { pool } from '../../db/pool';
import type { EstadoVehiculo, TipoVehiculo } from '../vehiculos/placa';
import type { EstadoAsignacion, FiltrosAsignaciones } from './asignaciones.schemas';

export interface Asignacion {
  id: string;
  conductorId: string;
  conductorNombre: string;
  conductorCedula: string;
  vehiculoId: string;
  vehiculoPlaca: string;
  vehiculoTipo: TipoVehiculo;
  remolqueId: string | null;
  remolquePlaca: string | null;
  estado: EstadoAsignacion;
  fechaAsignacion: Date;
  fechaActivacion: Date | null;
  fechaFinalizacion: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/** Asignación de un vehículo en el historial: puede haber sido el vehículo o el remolque acoplado. */
export interface AsignacionDeHistorial extends Asignacion {
  rolEnAsignacion: 'VEHICULO' | 'REMOLQUE';
}

export interface ConductorHabilitable {
  id: string;
  nombreCompleto: string;
  cedula: string;
  categoriaLicencia: string;
  estadoActivo: boolean;
}

export interface VehiculoBasico {
  id: string;
  placa: string;
  tipo: TipoVehiculo;
  estado: EstadoVehiculo;
}

/** Asignación vigente (no finalizada) bloqueada por una transacción. */
export interface AsignacionVigente {
  id: string;
  estado: EstadoAsignacion;
}

export interface OcupanteActivo {
  asignacionId: string;
  conductorId: string;
  conductorNombre: string;
  vehiculoId: string;
  remolqueId: string | null;
}

export interface VehiculoActivoDeConductor {
  asignacionId: string;
  vehiculoId: string;
  vehiculoPlaca: string;
  vehiculoTipo: TipoVehiculo;
  vehiculoMarca: string;
  vehiculoModelo: string;
  remolqueId: string | null;
  remolquePlaca: string | null;
  remolqueTipo: TipoVehiculo | null;
  remolqueMarca: string | null;
  remolqueModelo: string | null;
}

type Ejecutor = Pick<PoolClient, 'query'>;

const SELECT_ASIGNACION = `
  SELECT a.id,
         a.conductor_id        AS "conductorId",
         u.nombre_completo     AS "conductorNombre",
         u.cedula              AS "conductorCedula",
         a.vehiculo_id         AS "vehiculoId",
         v.placa               AS "vehiculoPlaca",
         v.tipo                AS "vehiculoTipo",
         a.remolque_id         AS "remolqueId",
         r.placa               AS "remolquePlaca",
         a.estado,
         a.fecha_asignacion    AS "fechaAsignacion",
         a.fecha_activacion    AS "fechaActivacion",
         a.fecha_finalizacion  AS "fechaFinalizacion",
         a.version,
         a.created_at          AS "createdAt",
         a.updated_at          AS "updatedAt"
  FROM asignaciones_vehiculo a
  JOIN usuarios  u ON u.id = a.conductor_id
  JOIN vehiculos v ON v.id = a.vehiculo_id
  LEFT JOIN vehiculos r ON r.id = a.remolque_id`;

export async function buscarPorId(id: string, ejecutor: Ejecutor = pool): Promise<Asignacion | null> {
  const { rows } = await ejecutor.query<Asignacion>(`${SELECT_ASIGNACION} WHERE a.id = $1`, [id]);
  return rows[0] ?? null;
}

export async function listar(filtros: FiltrosAsignaciones): Promise<Asignacion[]> {
  const condiciones: string[] = [];
  const valores: unknown[] = [];

  if (filtros.conductorId) {
    valores.push(filtros.conductorId);
    condiciones.push(`a.conductor_id = $${valores.length}`);
  }
  if (filtros.estado) {
    valores.push(filtros.estado);
    condiciones.push(`a.estado = $${valores.length}`);
  }

  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await pool.query<Asignacion>(
    `${SELECT_ASIGNACION} ${where} ORDER BY u.nombre_completo, a.fecha_asignacion DESC`,
    valores,
  );
  return rows;
}

/** CA 6: todas las asignaciones en las que el vehículo fue el automotor o el remolque acoplado. */
export async function historialDeVehiculo(vehiculoId: string): Promise<AsignacionDeHistorial[]> {
  const { rows } = await pool.query<AsignacionDeHistorial>(
    `SELECT h.*,
            CASE WHEN h."vehiculoId" = $1 THEN 'VEHICULO' ELSE 'REMOLQUE' END AS "rolEnAsignacion"
     FROM (${SELECT_ASIGNACION}) h
     WHERE h."vehiculoId" = $1 OR h."remolqueId" = $1
     ORDER BY h."fechaAsignacion" DESC, h.id`,
    [vehiculoId],
  );
  return rows;
}

export async function conductoresActivos(): Promise<ConductorHabilitable[]> {
  const { rows } = await pool.query<ConductorHabilitable>(
    `SELECT c.usuario_id AS id, u.nombre_completo AS "nombreCompleto", u.cedula,
            c.categoria_licencia AS "categoriaLicencia", u.estado_activo AS "estadoActivo"
     FROM conductores c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE u.estado_activo
     ORDER BY u.nombre_completo`,
  );
  return rows;
}

export async function buscarConductor(id: string, ejecutor: Ejecutor = pool): Promise<ConductorHabilitable | null> {
  const { rows } = await ejecutor.query<ConductorHabilitable>(
    `SELECT c.usuario_id AS id, u.nombre_completo AS "nombreCompleto", u.cedula,
            c.categoria_licencia AS "categoriaLicencia", u.estado_activo AS "estadoActivo"
     FROM conductores c
     JOIN usuarios u ON u.id = c.usuario_id
     WHERE c.usuario_id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

/**
 * Lee el vehículo con FOR SHARE: mientras la transacción no termine, nadie puede desactivarlo,
 * así la elegibilidad verificada sigue siendo cierta al confirmar.
 */
export async function buscarVehiculo(id: string, ejecutor: Ejecutor): Promise<VehiculoBasico | null> {
  const { rows } = await ejecutor.query<VehiculoBasico>(
    'SELECT id, placa, tipo, estado FROM vehiculos WHERE id = $1 FOR SHARE',
    [id],
  );
  return rows[0] ?? null;
}

export async function existeVigente(conductorId: string, vehiculoId: string, ejecutor: Ejecutor): Promise<boolean> {
  const { rowCount } = await ejecutor.query(
    `SELECT 1 FROM asignaciones_vehiculo
     WHERE conductor_id = $1 AND vehiculo_id = $2 AND estado <> 'FINALIZADA'`,
    [conductorId, vehiculoId],
  );
  return (rowCount ?? 0) > 0;
}

export async function insertar(conductorId: string, vehiculoId: string, ejecutor: Ejecutor): Promise<string> {
  const { rows } = await ejecutor.query<{ id: string }>(
    `INSERT INTO asignaciones_vehiculo (conductor_id, vehiculo_id) VALUES ($1, $2) RETURNING id`,
    [conductorId, vehiculoId],
  );
  return rows[0].id;
}

/**
 * Bloquea (FOR UPDATE, en orden de id para evitar interbloqueos) las asignaciones vigentes del conductor.
 * Serializa a los administradores que modifican las asignaciones del mismo conductor.
 */
export async function bloquearVigentesDelConductor(conductorId: string, ejecutor: Ejecutor): Promise<AsignacionVigente[]> {
  const { rows } = await ejecutor.query<AsignacionVigente>(
    `SELECT id, estado FROM asignaciones_vehiculo
     WHERE conductor_id = $1 AND estado <> 'FINALIZADA'
     ORDER BY id
     FOR UPDATE`,
    [conductorId],
  );
  return rows;
}

/** Asignaciones ACTIVAS que usan alguno de los vehículos indicados, como automotor o como remolque. */
export async function buscarActivasQueUsan(vehiculoIds: string[], ejecutor: Ejecutor = pool): Promise<OcupanteActivo[]> {
  const { rows } = await ejecutor.query<OcupanteActivo>(
    `SELECT a.id AS "asignacionId", a.conductor_id AS "conductorId", u.nombre_completo AS "conductorNombre",
            a.vehiculo_id AS "vehiculoId", a.remolque_id AS "remolqueId"
     FROM asignaciones_vehiculo a
     JOIN usuarios u ON u.id = a.conductor_id
     WHERE a.estado = 'ACTIVA' AND (a.vehiculo_id = ANY($1::uuid[]) OR a.remolque_id = ANY($1::uuid[]))`,
    [vehiculoIds],
  );
  return rows;
}

/** La asignación vuelve a HABILITADA y suelta su remolque (CA 7). */
export async function liberar(id: string, ejecutor: Ejecutor): Promise<void> {
  await ejecutor.query(
    `UPDATE asignaciones_vehiculo
     SET estado = 'HABILITADA', remolque_id = NULL, version = version + 1
     WHERE id = $1`,
    [id],
  );
}

/** Activa la asignación con su remolque. Si ya estaba ACTIVA conserva su fecha de activación. */
export async function activar(id: string, remolqueId: string | null, ejecutor: Ejecutor): Promise<void> {
  await ejecutor.query(
    `UPDATE asignaciones_vehiculo
     SET estado = 'ACTIVA',
         remolque_id = $2,
         fecha_activacion = CASE WHEN estado = 'ACTIVA' THEN fecha_activacion ELSE now() END,
         version = version + 1
     WHERE id = $1`,
    [id, remolqueId],
  );
}

/** CA 4: registra la fecha de fin sin eliminar el registro. */
export async function finalizar(id: string, ejecutor: Ejecutor): Promise<void> {
  await ejecutor.query(
    `UPDATE asignaciones_vehiculo
     SET estado = 'FINALIZADA', fecha_finalizacion = now(), version = version + 1
     WHERE id = $1`,
    [id],
  );
}

/**
 * CA 13 y 14: el vehículo activo del conductor, con su remolque. Si el vehículo fue desactivado,
 * la asignación sigue ACTIVA pero el conductor ya no puede usarlo.
 */
export async function buscarActivaDeConductor(conductorId: string): Promise<VehiculoActivoDeConductor | null> {
  const { rows } = await pool.query<VehiculoActivoDeConductor>(
    `SELECT a.id AS "asignacionId",
            v.id AS "vehiculoId", v.placa AS "vehiculoPlaca", v.tipo AS "vehiculoTipo",
            v.marca AS "vehiculoMarca", v.modelo AS "vehiculoModelo",
            r.id AS "remolqueId", r.placa AS "remolquePlaca", r.tipo AS "remolqueTipo",
            r.marca AS "remolqueMarca", r.modelo AS "remolqueModelo"
     FROM asignaciones_vehiculo a
     JOIN vehiculos v ON v.id = a.vehiculo_id
     LEFT JOIN vehiculos r ON r.id = a.remolque_id
     WHERE a.conductor_id = $1 AND a.estado = 'ACTIVA' AND v.estado = 'ACTIVO'`,
    [conductorId],
  );
  return rows[0] ?? null;
}
