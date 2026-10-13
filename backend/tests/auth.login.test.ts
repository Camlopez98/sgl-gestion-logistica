import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { pool } from '../src/db/pool';
import { PASSWORD_PRUEBA } from '../scripts/seed';

const app = crearApp();
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

describe('POST /api/auth/login', () => {
  it.each([
    ['conductor@sgl.test', 'CONDUCTOR'],
    ['admin@sgl.test', 'ADMINISTRADOR'],
    ['contador@sgl.test', 'CONTADOR'],
  ])('CA 1-3: %s inicia sesión y recibe su rol %s', async (email, rol) => {
    const res = await login(email, PASSWORD_PRUEBA);

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.expiraEn).toBe(1800);
    expect(res.body.usuario).toEqual({ id: expect.any(String), nombreCompleto: expect.any(String), rol });
  });

  it('normaliza el correo (mayúsculas y espacios)', async () => {
    const res = await login('  ADMIN@SGL.TEST ', PASSWORD_PRUEBA);
    expect(res.status).toBe(200);
  });

  it('CA 4: rechaza una contraseña equivocada', async () => {
    const res = await login('conductor@sgl.test', 'equivocada');

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ codigo: 'CREDENCIALES_INVALIDAS', mensaje: 'Credenciales incorrectas, inténtelo de nuevo.' });
  });

  it('CA 5: responde igual ante un correo no registrado', async () => {
    const existente = await login('conductor@sgl.test', 'equivocada');
    const inexistente = await login('nadie@sgl.test', 'equivocada');

    expect(inexistente.status).toBe(existente.status);
    expect(inexistente.body).toEqual(existente.body);
  });

  it.each([
    [{ email: '', password: 'x' }, 'email'],
    [{ email: 'sin-formato', password: 'x' }, 'email'],
    [{ email: 'conductor@sgl.test', password: '' }, 'password'],
    [{}, 'email'],
  ])('CA 6: rechaza datos inválidos %j', async (cuerpo, campo) => {
    const res = await request(app).post('/api/auth/login').send(cuerpo);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    expect(res.body.mensaje).toContain(campo);
  });

  it('CA 7: rechaza una cuenta inactiva con credenciales correctas', async () => {
    const res = await login('inactivo@sgl.test', PASSWORD_PRUEBA);

    expect(res.status).toBe(403);
    expect(res.body.codigo).toBe('CUENTA_INACTIVA');
    expect(res.body.token).toBeUndefined();
  });

  it('CA 7: una cuenta inactiva con contraseña errónea no revela su estado', async () => {
    const res = await login('inactivo@sgl.test', 'equivocada');
    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('CA 13: registra en la bitácora la fecha, la hora y el correo de cada intento fallido', async () => {
    await pool.query('TRUNCATE bitacora_intentos_fallidos');

    await login('conductor@sgl.test', 'equivocada');
    await login('nadie@sgl.test', 'equivocada');
    await login('inactivo@sgl.test', PASSWORD_PRUEBA);
    await login('admin@sgl.test', PASSWORD_PRUEBA); // exitoso: no se registra

    const { rows } = await pool.query(
      'SELECT email_ingresado, motivo, created_at FROM bitacora_intentos_fallidos ORDER BY created_at',
    );
    expect(rows.map((r) => [r.email_ingresado, r.motivo])).toEqual([
      ['conductor@sgl.test', 'CREDENCIALES_INVALIDAS'],
      ['nadie@sgl.test', 'CREDENCIALES_INVALIDAS'],
      ['inactivo@sgl.test', 'CUENTA_INACTIVA'],
    ]);
    rows.forEach((r) => expect(r.created_at).toBeInstanceOf(Date));
  });

  it('guarda las contraseñas con hash bcrypt, nunca en texto plano', async () => {
    const { rows } = await pool.query('SELECT password_hash FROM usuarios');
    rows.forEach((r) => {
      expect(r.password_hash).toMatch(/^\$2[aby]\$\d{2}\$/);
      expect(r.password_hash).not.toContain(PASSWORD_PRUEBA);
    });
  });
});
