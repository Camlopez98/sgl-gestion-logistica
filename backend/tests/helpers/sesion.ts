import type { Express } from 'express';
import request from 'supertest';
import { PASSWORD_PRUEBA } from '../../scripts/seed';

/** Inicia sesión con un usuario de prueba y devuelve su token. */
export async function tokenDe(app: Express, email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD_PRUEBA });
  return res.body.token;
}
