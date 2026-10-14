import express from 'express';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { pool } from '../src/db/pool';
import { autenticar } from '../src/shared/middlewares/autenticar';
import { idempotente } from '../src/shared/middlewares/idempotente';
import { manejadorErrores } from '../src/shared/middlewares/manejador-errores';
import { tokenDe } from './helpers/sesion';

const app = crearApp();
let admin: string;

const vehiculo = { placa: 'IDM123', tipo: 'CAMION', marca: 'Hino', modelo: '500', numeroEjes: 2, capacidadCargaKg: 8000 };

const registrar = (clave: string, cuerpo: object = vehiculo) =>
  request(app)
    .post('/api/vehiculos')
    .set('Authorization', `Bearer ${admin}`)
    .set('Idempotency-Key', clave)
    .send(cuerpo);

async function totalVehiculos(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS total FROM vehiculos');
  return rows[0].total;
}

beforeAll(async () => {
  admin = await tokenDe(app, 'admin@sgl.test');
});

beforeEach(async () => {
  await pool.query('TRUNCATE solicitudes_idempotentes, asignaciones_vehiculo, vehiculos');
});

describe('Registro de vehículos con Idempotency-Key', () => {
  it('CA 9: un reintento con la misma clave devuelve el vehículo ya creado sin duplicarlo', async () => {
    const primera = await registrar('clave-1');
    const reintento = await registrar('clave-1');

    expect(primera.status).toBe(201);
    expect(reintento.status).toBe(201);
    expect(reintento.body.id).toBe(primera.body.id);
    expect(reintento.headers['idempotent-replayed']).toBe('true');
    expect(await totalVehiculos()).toBe(1);
  });

  it('una operación nueva (otra clave) con la misma placa recibe placa duplicada', async () => {
    await registrar('clave-1');
    const res = await registrar('clave-2');

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('PLACA_DUPLICADA');
  });

  it('rechaza reutilizar una clave con otros datos', async () => {
    await registrar('clave-1');
    const res = await registrar('clave-1', { ...vehiculo, placa: 'OTR123' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    expect(await totalVehiculos()).toBe(1);
  });

  it('repite también las respuestas de error de negocio (4xx)', async () => {
    const primera = await registrar('clave-1', { ...vehiculo, placa: 'R12345' });
    const reintento = await registrar('clave-1', { ...vehiculo, placa: 'R12345' });

    expect(primera.status).toBe(422);
    expect(reintento.status).toBe(422);
    expect(reintento.body).toEqual(primera.body);
  });
});

describe('Middleware idempotente', () => {
  // Endpoint de prueba que falla con 500 la primera vez y luego responde 201.
  let intentos = 0;
  const appPrueba = express();
  appPrueba.use(express.json());
  appPrueba.post('/operacion', autenticar, idempotente(), (_req, res) => {
    intentos += 1;
    if (intentos === 1) {
      res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'falla simulada' });
      return;
    }
    res.status(201).json({ intento: intentos });
  });
  appPrueba.use(manejadorErrores);

  const operar = (clave?: string) => {
    const peticion = request(appPrueba).post('/operacion').set('Authorization', `Bearer ${admin}`);
    return (clave ? peticion.set('Idempotency-Key', clave) : peticion).send({ dato: 1 });
  };

  beforeEach(() => {
    intentos = 0;
  });

  it('CA 9: tras un error del servidor, el reintento se procesa de nuevo', async () => {
    expect((await operar('clave-x')).status).toBe(500);
    const reintento = await operar('clave-x');
    const otroReintento = await operar('clave-x');

    expect(reintento.status).toBe(201);
    expect(otroReintento.body).toEqual({ intento: 2 });
    expect(intentos).toBe(2);
  });

  it('sin encabezado no interviene', async () => {
    await operar();
    await operar();
    expect(intentos).toBe(2);
  });

  it('responde 409 mientras la solicitud original sigue en proceso y retoma una abandonada', async () => {
    const { rows } = await pool.query("SELECT id FROM usuarios WHERE email = 'admin@sgl.test'");
    const huella = (await import('node:crypto')).createHash('sha256').update(JSON.stringify({ dato: 1 })).digest('hex');
    await pool.query(
      `INSERT INTO solicitudes_idempotentes (usuario_id, clave, metodo, ruta, huella_cuerpo, estado)
       VALUES ($1, 'clave-y', 'POST', '/operacion', $2, 'EN_PROCESO')`,
      [rows[0].id, huella],
    );

    const enProceso = await operar('clave-y');
    expect(enProceso.status).toBe(409);
    expect(enProceso.body.codigo).toBe('SOLICITUD_EN_PROCESO');

    await pool.query(
      "ALTER TABLE solicitudes_idempotentes DISABLE TRIGGER trg_solicitudes_idempotentes_updated_at",
    );
    await pool.query("UPDATE solicitudes_idempotentes SET updated_at = now() - interval '2 minutes' WHERE clave = 'clave-y'");
    await pool.query("ALTER TABLE solicitudes_idempotentes ENABLE TRIGGER trg_solicitudes_idempotentes_updated_at");

    intentos = 1; // el endpoint de prueba responde 201 desde el segundo intento
    const retomada = await operar('clave-y');
    expect(retomada.status).toBe(201);
  });
});
