/** Roles del sistema (coinciden con el tipo rol_usuario de PostgreSQL). */
export const ROLES = ['CONDUCTOR', 'ADMINISTRADOR', 'CONTADOR'] as const;

export type Rol = (typeof ROLES)[number];
