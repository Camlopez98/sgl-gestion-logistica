/**
 * Crea los usuarios de prueba (uno por rol y un conductor inactivo).
 * Es idempotente: si un usuario ya existe (mismo email), no lo duplica.
 * Uso: npm run seed
 */
import type { PoolClient } from 'pg';
import { env } from '../src/config/env';
import { pool } from '../src/db/pool';
import { enTransaccion } from '../src/db/transaccion';
import { generarHash } from '../src/modules/auth/password';
import type { Rol } from '../src/shared/types/rol';

export const PASSWORD_PRUEBA = 'Sgl2026*';

interface UsuarioPrueba {
  cedula: string;
  nombreCompleto: string;
  email: string;
  rol: Rol;
  estadoActivo: boolean;
  perfil: Record<string, string>;
}

export const USUARIOS_PRUEBA: UsuarioPrueba[] = [
  {
    cedula: '1000000001',
    nombreCompleto: 'Admin Ramírez',
    email: 'admin@sgl.test',
    rol: 'ADMINISTRADOR',
    estadoActivo: true,
    perfil: { cargo_directivo: 'Jefe de operaciones', departamento: 'Operaciones' },
  },
  {
    cedula: '1000000002',
    nombreCompleto: 'Carlos Méndez',
    email: 'conductor@sgl.test',
    rol: 'CONDUCTOR',
    estadoActivo: true,
    perfil: { numero_licencia: 'LIC-0001', categoria_licencia: 'C3', telefono_contacto: '3001234567' },
  },
  {
    cedula: '1000000003',
    nombreCompleto: 'Laura Contreras',
    email: 'contador@sgl.test',
    rol: 'CONTADOR',
    estadoActivo: true,
    perfil: { tarjeta_profesional: 'TP-12345' },
  },
  {
    cedula: '1000000004',
    nombreCompleto: 'Diego Torres',
    email: 'inactivo@sgl.test',
    rol: 'CONDUCTOR',
    estadoActivo: false,
    perfil: { numero_licencia: 'LIC-0002', categoria_licencia: 'C2', telefono_contacto: '3007654321' },
  },
];

const TABLA_PERFIL: Record<Rol, string> = {
  CONDUCTOR: 'conductores',
  ADMINISTRADOR: 'administradores',
  CONTADOR: 'contadores',
};

export async function sembrarUsuariosPrueba(cliente: PoolClient): Promise<void> {
  const hash = await generarHash(PASSWORD_PRUEBA);

  for (const usuario of USUARIOS_PRUEBA) {
    const insertado = await cliente.query<{ id: string }>(
      `INSERT INTO usuarios (cedula, nombre_completo, email, password_hash, rol, estado_activo)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT ((lower(email))) DO NOTHING
       RETURNING id`,
      [usuario.cedula, usuario.nombreCompleto, usuario.email, hash, usuario.rol, usuario.estadoActivo],
    );

    const id = insertado.rows[0]?.id;
    if (!id) continue; // ya existía

    const columnas = Object.keys(usuario.perfil);
    const valores = Object.values(usuario.perfil);
    const marcadores = valores.map((_, i) => `$${i + 2}`).join(', ');
    await cliente.query(
      `INSERT INTO ${TABLA_PERFIL[usuario.rol]} (usuario_id, ${columnas.join(', ')}) VALUES ($1, ${marcadores})`,
      [id, ...valores],
    );
  }
}

async function main() {
  if (env.NODE_ENV === 'production') {
    throw new Error('El seed de usuarios de prueba no se ejecuta en producción.');
  }

  await enTransaccion(sembrarUsuariosPrueba);
  console.log('Usuarios de prueba listos:');
  console.table(
    USUARIOS_PRUEBA.map((u) => ({ email: u.email, rol: u.rol, activo: u.estadoActivo, password: PASSWORD_PRUEBA })),
  );
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
