import { pool } from '../../db/pool';
import type { Rol } from '../../shared/types/rol';

/** Datos públicos de un usuario (nunca incluyen el hash de la contraseña). */
export interface Usuario {
  id: string;
  cedula: string;
  nombreCompleto: string;
  email: string;
  rol: Rol;
  estadoActivo: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UsuarioConPassword extends Usuario {
  passwordHash: string;
}

const COLUMNAS = `
  id,
  cedula,
  nombre_completo AS "nombreCompleto",
  email,
  rol,
  estado_activo   AS "estadoActivo",
  created_at      AS "createdAt",
  updated_at      AS "updatedAt"`;

/** Busca por email sin distinguir mayúsculas. Incluye el hash: uso exclusivo del login. */
export async function buscarPorEmailConPassword(email: string): Promise<UsuarioConPassword | null> {
  const { rows } = await pool.query<UsuarioConPassword>(
    `SELECT ${COLUMNAS}, password_hash AS "passwordHash" FROM usuarios WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function buscarPorId(id: string): Promise<Usuario | null> {
  const { rows } = await pool.query<Usuario>(`SELECT ${COLUMNAS} FROM usuarios WHERE id = $1`, [id]);
  return rows[0] ?? null;
}
