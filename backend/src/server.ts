import { crearApp } from './app';
import { env } from './config/env';
import { verificarConexion } from './db/pool';

async function iniciar() {
  try {
    await verificarConexion();
  } catch (error) {
    console.error('No fue posible conectarse a PostgreSQL. Revise DATABASE_URL en su .env.', error);
    process.exit(1);
  }

  const app = crearApp();
  app.listen(env.PORT, () => {
    console.log(`API SGL escuchando en http://localhost:${env.PORT}/api`);
  });
}

void iniciar();
