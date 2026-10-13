import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';

const app = crearApp();

describe('aplicación', () => {
  it('responde en /api/salud', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ estado: 'ok' });
  });

  it('responde 404 con el formato común en rutas inexistentes', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ codigo: 'RECURSO_NO_ENCONTRADO', mensaje: expect.any(String) });
  });

  it('responde 400 con el formato común ante JSON mal formado', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{mal');
    expect(res.status).toBe(400);
    expect(res.body.codigo).toBe('JSON_INVALIDO');
  });

  it('permite CORS solo desde el origen configurado', async () => {
    const permitido = await request(app).get('/api/salud').set('Origin', 'http://localhost:4200');
    const otro = await request(app).get('/api/salud').set('Origin', 'http://otro-sitio.com');

    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(otro.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('evita que el navegador guarde en caché las respuestas de la API', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.headers['cache-control']).toBe('no-store');
  });
});
