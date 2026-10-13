import { pool } from '../../db/pool';

export type MotivoIntentoFallido = 'CREDENCIALES_INVALIDAS' | 'CUENTA_INACTIVA';

export interface IntentoFallido {
  email: string;
  motivo: MotivoIntentoFallido;
  ip?: string;
  userAgent?: string;
}

/** Registra un intento fallido de inicio de sesión (HU-18, escenario 13). */
export async function registrarIntentoFallido(intento: IntentoFallido): Promise<void> {
  await pool.query(
    `INSERT INTO bitacora_intentos_fallidos (email_ingresado, motivo, ip, user_agent)
     VALUES ($1, $2, $3, $4)`,
    [intento.email.slice(0, 255), intento.motivo, intento.ip ?? null, intento.userAgent?.slice(0, 500) ?? null],
  );
}
