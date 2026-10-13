/** Roles del sistema (coinciden con los del backend). */
export type Rol = 'CONDUCTOR' | 'ADMINISTRADOR' | 'CONTADOR';

/** Usuario de la sesión actual. */
export interface UsuarioSesion {
  id: string;
  nombreCompleto: string;
  rol: Rol;
}

/** Respuesta de POST /api/auth/login. */
export interface RespuestaLogin {
  token: string;
  expiraEn: number;
  usuario: UsuarioSesion;
}

/** Módulo al que se dirige cada rol después de iniciar sesión (HU-18, escenarios 1 a 3). */
export const RUTA_INICIO_POR_ROL: Record<Rol, string> = {
  CONDUCTOR: '/conductor/viajes-en-curso',
  ADMINISTRADOR: '/admin/dashboard',
  CONTADOR: '/contador/reportes',
};

/**
 * Datos que cada ruta interna declara en `data`:
 * - titulo: texto de la barra superior.
 * - roles: roles que pueden abrirla (lo valida rolGuard).
 * - menu: si existe, la ruta aparece en el menú lateral con ese texto.
 * - separadorAntes: dibuja una línea divisoria antes de la entrada del menú.
 */
export interface DatosRuta {
  titulo: string;
  roles: Rol[];
  menu?: string;
  separadorAntes?: boolean;
}
