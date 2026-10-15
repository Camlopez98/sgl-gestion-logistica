import { pool } from '../../db/pool';
import type { EstadoViaje, FiltrosHistorial } from './historial.schemas';

/** Zona horaria de las fechas de calendario que envía el conductor para filtrar. */
const ZONA_HORARIA = 'America/Bogota';

export interface ViajeDeLista {
  id: string;
  estado: EstadoViaje;
  origen: string;
  destino: string;
  valorFlete: number;
  fechaInicio: Date;
  placaVehiculo: string;
  totalGastos: number;
  /** Posición del viaje para el cursor (microsegundos incluidos: la fecha de JavaScript los perdería). */
  marcaCursor: string;
}

export interface PosicionCursor {
  marca: string;
  id: string;
}

export interface ViajeDetalle {
  id: string;
  estado: EstadoViaje;
  origen: string;
  destino: string;
  valorFlete: number;
  fechaInicio: Date;
  fechaEntrega: Date | null;
  placaVehiculo: string;
  placaRemolque: string | null;
}

export interface ManifiestoDeViaje {
  numeroManifiesto: string;
  urlImagen: string;
  tipoMime: string;
  fechaCarga: Date;
}

export interface GastoDeViaje {
  id: string;
  tipo: string;
  monto: number;
  concepto: string;
  urlSoporte: string | null;
  createdAt: Date;
}

type Filtros = Pick<FiltrosHistorial, 'estado' | 'desde' | 'hasta'>;

/** Condiciones comunes de lista y conteo. Siempre acota por conductor: nunca se consulta sin ese filtro. */
function condiciones(conductorId: string, filtros: Filtros): { sql: string; valores: unknown[] } {
  const valores: unknown[] = [conductorId];
  const partes = ['v.conductor_id = $1'];

  if (filtros.estado) {
    valores.push(filtros.estado);
    partes.push(`v.estado = $${valores.length}`);
  }
  if (filtros.desde) {
    valores.push(filtros.desde);
    partes.push(`v.fecha_inicio >= ($${valores.length}::date)::timestamp AT TIME ZONE '${ZONA_HORARIA}'`);
  }
  if (filtros.hasta) {
    valores.push(filtros.hasta);
    partes.push(`v.fecha_inicio < (($${valores.length}::date) + 1)::timestamp AT TIME ZONE '${ZONA_HORARIA}'`);
  }
  return { sql: partes.join(' AND '), valores };
}

/** Viajes del conductor del más reciente al más antiguo; trae uno de más para saber si hay otro bloque. */
export async function listar(
  conductorId: string,
  filtros: Filtros,
  cursor: PosicionCursor | null,
  cantidad: number,
): Promise<ViajeDeLista[]> {
  const { sql, valores } = condiciones(conductorId, filtros);
  let posicion = '';
  if (cursor) {
    valores.push(cursor.marca, cursor.id);
    posicion = `AND (v.fecha_inicio, v.id) < ($${valores.length - 1}::timestamptz, $${valores.length}::uuid)`;
  }
  valores.push(cantidad);

  const { rows } = await pool.query<ViajeDeLista>(
    `SELECT v.id,
            v.estado,
            v.origen,
            v.destino,
            v.valor_flete::float8 AS "valorFlete",
            v.fecha_inicio        AS "fechaInicio",
            ve.placa              AS "placaVehiculo",
            COALESCE((SELECT SUM(g.monto) FROM gastos_ruta g WHERE g.viaje_id = v.id), 0)::float8 AS "totalGastos",
            to_char(v.fecha_inicio AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "marcaCursor"
       FROM viajes v
       JOIN vehiculos ve ON ve.id = v.vehiculo_id
      WHERE ${sql} ${posicion}
      ORDER BY v.fecha_inicio DESC, v.id DESC
      LIMIT $${valores.length}`,
    valores,
  );
  return rows;
}

/** Cantidad de viajes del conductor que cumplen los filtros (sin importar el cursor). */
export async function contar(conductorId: string, filtros: Filtros): Promise<number> {
  const { sql, valores } = condiciones(conductorId, filtros);
  const { rows } = await pool.query<{ total: number }>(
    `SELECT count(*)::int AS total FROM viajes v WHERE ${sql}`,
    valores,
  );
  return rows[0].total;
}

/** Un viaje solo se devuelve si pertenece al conductor: para un viaje ajeno el resultado es el mismo que si no existiera. */
export async function buscarDeConductor(conductorId: string, viajeId: string): Promise<ViajeDetalle | null> {
  const { rows } = await pool.query<ViajeDetalle>(
    `SELECT v.id,
            v.estado,
            v.origen,
            v.destino,
            v.valor_flete::float8 AS "valorFlete",
            v.fecha_inicio        AS "fechaInicio",
            v.fecha_entrega       AS "fechaEntrega",
            ve.placa              AS "placaVehiculo",
            re.placa              AS "placaRemolque"
       FROM viajes v
       JOIN vehiculos ve ON ve.id = v.vehiculo_id
       LEFT JOIN vehiculos re ON re.id = v.remolque_id
      WHERE v.id = $1 AND v.conductor_id = $2`,
    [viajeId, conductorId],
  );
  return rows[0] ?? null;
}

export async function manifiestoDelViaje(viajeId: string): Promise<ManifiestoDeViaje | null> {
  const { rows } = await pool.query<ManifiestoDeViaje>(
    `SELECT numero_manifiesto AS "numeroManifiesto",
            url_imagen        AS "urlImagen",
            tipo_mime         AS "tipoMime",
            fecha_carga       AS "fechaCarga"
       FROM manifiestos_carga
      WHERE viaje_id = $1`,
    [viajeId],
  );
  return rows[0] ?? null;
}

export async function gastosDelViaje(viajeId: string): Promise<GastoDeViaje[]> {
  const { rows } = await pool.query<GastoDeViaje>(
    `SELECT id,
            tipo,
            monto::float8 AS monto,
            concepto,
            url_soporte   AS "urlSoporte",
            created_at    AS "createdAt"
       FROM gastos_ruta
      WHERE viaje_id = $1
      ORDER BY created_at, id`,
    [viajeId],
  );
  return rows;
}
