import { pool } from '../../db/pool';

export interface SolicitudIdempotente {
  ruta: string;
  metodo: string;
  huellaCuerpo: string;
  estado: 'EN_PROCESO' | 'COMPLETADA';
  statusRespuesta: number | null;
  cuerpoRespuesta: unknown;
  segundosDesdeInicio: number;
}

interface Identificacion {
  usuarioId: string;
  clave: string;
}

interface NuevaSolicitud extends Identificacion {
  metodo: string;
  ruta: string;
  huellaCuerpo: string;
}

/** Registra la solicitud como EN_PROCESO. Devuelve false si la clave ya existía. */
export async function reservar(solicitud: NuevaSolicitud): Promise<boolean> {
  const { rowCount } = await pool.query(
    `INSERT INTO solicitudes_idempotentes (usuario_id, clave, metodo, ruta, huella_cuerpo, estado)
     VALUES ($1, $2, $3, $4, $5, 'EN_PROCESO')
     ON CONFLICT (usuario_id, clave) DO NOTHING`,
    [solicitud.usuarioId, solicitud.clave, solicitud.metodo, solicitud.ruta, solicitud.huellaCuerpo],
  );
  return rowCount === 1;
}

export async function buscar({ usuarioId, clave }: Identificacion): Promise<SolicitudIdempotente | null> {
  const { rows } = await pool.query<SolicitudIdempotente>(
    `SELECT ruta, metodo, huella_cuerpo AS "huellaCuerpo", estado,
            status_respuesta AS "statusRespuesta", cuerpo_respuesta AS "cuerpoRespuesta",
            EXTRACT(EPOCH FROM now() - updated_at)::int AS "segundosDesdeInicio"
     FROM solicitudes_idempotentes WHERE usuario_id = $1 AND clave = $2`,
    [usuarioId, clave],
  );
  return rows[0] ?? null;
}

/** Retoma una solicitud abandonada (quedó EN_PROCESO, por ejemplo, por una caída del servidor). */
export async function retomar({ usuarioId, clave }: Identificacion, segundosMinimos: number): Promise<boolean> {
  const { rowCount } = await pool.query(
    `UPDATE solicitudes_idempotentes SET estado = 'EN_PROCESO'
     WHERE usuario_id = $1 AND clave = $2 AND estado = 'EN_PROCESO'
       AND updated_at < now() - make_interval(secs => $3)`,
    [usuarioId, clave, segundosMinimos],
  );
  return rowCount === 1;
}

export async function completar(id: Identificacion, status: number, cuerpo: unknown): Promise<void> {
  await pool.query(
    `UPDATE solicitudes_idempotentes
     SET estado = 'COMPLETADA', status_respuesta = $3, cuerpo_respuesta = $4
     WHERE usuario_id = $1 AND clave = $2`,
    [id.usuarioId, id.clave, status, JSON.stringify(cuerpo ?? null)],
  );
}

export async function liberar({ usuarioId, clave }: Identificacion): Promise<void> {
  await pool.query('DELETE FROM solicitudes_idempotentes WHERE usuario_id = $1 AND clave = $2', [usuarioId, clave]);
}
