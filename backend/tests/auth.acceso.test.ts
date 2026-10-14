import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { env } from '../src/config/env';
import { pool } from '../src/db/pool';
import { autenticar } from '../src/shared/middlewares/autenticar';
import { autorizar } from '../src/shared/middlewares/autorizar';
import { manejadorErrores } from '../src/shared/middlewares/manejador-errores';
import { PASSWORD_PRUEBA } from '../scripts/seed';

const app = crearApp();

// Aplicación mínima con un endpoint de escritura reservado al Administrador,
// para probar los middlewares tal como los usarán los módulos.
const appProtegida = express();
appProtegida.use(express.json());
appProtegida.post('/recurso', autenticar, autorizar('ADMINISTRADOR'), (_req, res) => {
  res.status(201).json({ ok: true });
});
appProtegida.use(manejadorErrores);

async function tokenDe(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD_PRUEBA });
  return res.body.token;
}

describe('autenticar', () => {
  it('CA 10: rechaza peticiones sin token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('TOKEN_AUSENTE');
  });

  it('rechaza un token alterado', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('TOKEN_INVALIDO');
  });

  it('rechaza un token firmado con otro secreto', async () => {
    const falso = jwt.sign({ rol: 'ADMINISTRADOR' }, 'otro-secreto-de-al-menos-32-caracteres!!', { subject: 'x' });
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${falso}`);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('TOKEN_INVALIDO');
  });

  it('CA 11: rechaza un token expirado indicando que la sesión expiró', async () => {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = 'admin@sgl.test'");
    const vencido = jwt.sign({ rol: 'ADMINISTRADOR' }, env.JWT_SECRET, { subject: rows[0].id, expiresIn: -10 });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${vencido}`);
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('SESION_EXPIRADA');
  });

  it('devuelve el usuario de la sesión en GET /api/auth/me', async () => {
    const token = await tokenDe('conductor@sgl.test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'conductor@sgl.test', rol: 'CONDUCTOR', nombreCompleto: 'Carlos Méndez' });
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('CA 11: no renueva un token recién emitido', async () => {
    const token = await tokenDe('conductor@sgl.test');
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.headers['x-token-renovado']).toBeUndefined();
  });

  it('CA 11: renueva el token cuando le queda menos de la mitad de su vida', async () => {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = 'conductor@sgl.test'");
    const casiVencido = jwt.sign({ rol: 'CONDUCTOR' }, env.JWT_SECRET, { subject: rows[0].id, expiresIn: 60 });

    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${casiVencido}`);
    const renovado = res.headers['x-token-renovado'];

    expect(res.status).toBe(200);
    expect(renovado).toEqual(expect.any(String));
    const payload = jwt.decode(renovado) as jwt.JwtPayload;
    expect(payload.exp! - payload.iat!).toBe(env.JWT_EXPIRA_EN);
  });

  describe('usuario desactivado durante la sesión', () => {
    let token: string;

    beforeAll(async () => {
      token = await tokenDe('contador@sgl.test');
      await pool.query("UPDATE usuarios SET estado_activo = false WHERE email = 'contador@sgl.test'");
    });

    afterAll(async () => {
      await pool.query("UPDATE usuarios SET estado_activo = true WHERE email = 'contador@sgl.test'");
    });

    it('pierde el acceso de inmediato aunque su token siga vigente', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
      expect(res.body.codigo).toBe('CUENTA_INACTIVA');
    });
  });
});

describe('autorizar', () => {
  it('CA 9: el contador recibe 403 al enviar una escritura directa al servidor', async () => {
    const token = await tokenDe('contador@sgl.test');
    const res = await request(appProtegida).post('/recurso').set('Authorization', `Bearer ${token}`).send({});

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ codigo: 'ACCESO_DENEGADO', mensaje: 'No tiene permisos para realizar esta acción.' });
  });

  it('el conductor recibe 403 en un endpoint del administrador', async () => {
    const token = await tokenDe('conductor@sgl.test');
    const res = await request(appProtegida).post('/recurso').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(403);
  });

  it('el administrador accede a su endpoint', async () => {
    const token = await tokenDe('admin@sgl.test');
    const res = await request(appProtegida).post('/recurso').set('Authorization', `Bearer ${token}`).send({});
    expect(res.status).toBe(201);
  });
});

describe('POST /api/auth/logout', () => {
  it('responde 204', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(204);
  });
});
