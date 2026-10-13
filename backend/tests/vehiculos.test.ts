import request from 'supertest';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { pool } from '../src/db/pool';
import { registrarConsultaViajeActivo, restablecerConsultaViajeActivo } from '../src/modules/vehiculos/viajes-activos';
import { tokenDe } from './helpers/sesion';

const app = crearApp();
let admin: string;

const tractocamion = {
  placa: 'TKM482',
  tipo: 'TRACTOCAMION',
  marca: 'Kenworth',
  modelo: 'T800',
  numeroEjes: 3,
  capacidadCargaKg: 34000,
};

const registrar = (cuerpo: object, token = admin) =>
  request(app).post('/api/vehiculos').set('Authorization', `Bearer ${token}`).send(cuerpo);

beforeAll(async () => {
  admin = await tokenDe(app, 'admin@sgl.test');
});

beforeEach(async () => {
  await pool.query('TRUNCATE solicitudes_idempotentes, vehiculos');
});

afterEach(() => restablecerConsultaViajeActivo());

describe('Registro y placa', () => {
  it('CA 1: registra un vehículo con placa válida y estado ACTIVO por defecto', async () => {
    const res = await registrar(tractocamion);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ ...tractocamion, estado: 'ACTIVO' });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it('CA 2: rechaza una placa ya registrada', async () => {
    await registrar(tractocamion);
    const res = await registrar({ ...tractocamion, marca: 'Otra' });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ codigo: 'PLACA_DUPLICADA', mensaje: 'La placa TKM482 ya está registrada.' });
  });

  it('CA 3: rechaza una placa que no corresponde al formato de su tipo e indica el formato esperado', async () => {
    const res = await registrar({ ...tractocamion, placa: 'R12345' });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('PLACA_FORMATO_INVALIDO');
    expect(res.body.mensaje).toContain('AAA999');
  });

  it.each([
    ['FURGON', 'FUR123', 'R12345'],
    ['CAMION', 'CAM456', 'S12345'],
    ['TRACTOCAMION', 'TRA789', 'TR7890'],
    ['REMOLQUE', 'R12345', 'ABC123'],
    ['SEMIRREMOLQUE', 'S12345', 'R12345'],
  ])('CA 3: %s acepta %s y rechaza %s', async (tipo, valida, invalida) => {
    expect((await registrar({ ...tractocamion, tipo, placa: valida })).status).toBe(201);
    expect((await registrar({ ...tractocamion, tipo, placa: invalida })).status).toBe(422);
  });

  it.each(['tkm-482', ' tkm 482 ', 'TKM-482', 'tKm482'])('CA 4: guarda "%s" normalizada como TKM482', async (placa) => {
    const res = await registrar({ ...tractocamion, placa });

    expect(res.status).toBe(201);
    expect(res.body.placa).toBe('TKM482');
  });

  it.each([
    [{ ...tractocamion, tipo: 'MOTO' }, 'tipo'],
    [{ ...tractocamion, placa: '' }, 'placa'],
    [{ ...tractocamion, marca: '  ' }, 'marca'],
    [{ ...tractocamion, numeroEjes: 0 }, 'numeroEjes'],
    [{ ...tractocamion, numeroEjes: 2.5 }, 'numeroEjes'],
    [{ ...tractocamion, capacidadCargaKg: -1 }, 'capacidadCargaKg'],
    [{ ...tractocamion, capacidadCargaKg: '34000' }, 'capacidadCargaKg'],
  ])('rechaza datos inválidos (%j)', async (cuerpo, campo) => {
    const res = await registrar(cuerpo);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    expect(res.body.mensaje).toContain(campo);
  });

  it('CA 10: dos solicitudes simultáneas con la misma placa crean un solo vehículo', async () => {
    const respuestas = await Promise.all([registrar(tractocamion), registrar(tractocamion), registrar(tractocamion)]);

    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409, 409]);
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM vehiculos');
    expect(rows[0].total).toBe(1);
  });
});

describe('Consulta', () => {
  beforeEach(async () => {
    await registrar(tractocamion);
    await registrar({ ...tractocamion, placa: 'R10001', tipo: 'REMOLQUE', marca: 'Randon' });
    await registrar({ ...tractocamion, placa: 'FUR100', tipo: 'FURGON', marca: 'JAC' });
  });

  const listar = (consulta = '') =>
    request(app).get(`/api/vehiculos${consulta}`).set('Authorization', `Bearer ${admin}`);

  it('lista los vehículos ordenados por placa', async () => {
    const res = await listar();
    expect(res.status).toBe(200);
    expect(res.body.map((v: { placa: string }) => v.placa)).toEqual(['FUR100', 'R10001', 'TKM482']);
  });

  it('filtra por tipo, estado y texto', async () => {
    expect((await listar('?tipo=REMOLQUE')).body).toHaveLength(1);
    expect((await listar('?estado=INACTIVO')).body).toHaveLength(0);
    expect((await listar('?q=kenworth')).body.map((v: { placa: string }) => v.placa)).toEqual(['TKM482']);
  });

  it('rechaza filtros inválidos', async () => {
    expect((await listar('?estado=BORRADO')).status).toBe(422);
  });

  it('consulta el detalle y responde 404 si no existe', async () => {
    const [vehiculo] = (await listar('?tipo=FURGON')).body;
    const detalle = await request(app).get(`/api/vehiculos/${vehiculo.id}`).set('Authorization', `Bearer ${admin}`);
    const inexistente = await request(app)
      .get('/api/vehiculos/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${admin}`);
    const malFormado = await request(app).get('/api/vehiculos/abc').set('Authorization', `Bearer ${admin}`);

    expect(detalle.body.placa).toBe('FUR100');
    expect(inexistente.status).toBe(404);
    expect(malFormado.status).toBe(404);
  });
});

describe('Edición y desactivación', () => {
  let id: string;

  beforeEach(async () => {
    id = (await registrar(tractocamion)).body.id;
    await registrar({ ...tractocamion, placa: 'OTR999' });
  });

  const editar = (vehiculoId: string, cuerpo: object) =>
    request(app).put(`/api/vehiculos/${vehiculoId}`).set('Authorization', `Bearer ${admin}`).send(cuerpo);
  const desactivar = (vehiculoId: string) =>
    request(app).patch(`/api/vehiculos/${vehiculoId}/desactivar`).set('Authorization', `Bearer ${admin}`);

  it('edita los datos del vehículo conservando su propia placa', async () => {
    const res = await editar(id, { ...tractocamion, modelo: 'T880', capacidadCargaKg: 36000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, placa: 'TKM482', modelo: 'T880', capacidadCargaKg: 36000 });
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(new Date(res.body.createdAt).getTime());
  });

  it('CA 5: rechaza cambiar la placa por una que pertenece a otro vehículo', async () => {
    const res = await editar(id, { ...tractocamion, placa: 'otr-999' });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('PLACA_DUPLICADA');
  });

  it('valida el formato de placa al editar y responde 404 si no existe', async () => {
    expect((await editar(id, { ...tractocamion, tipo: 'REMOLQUE' })).status).toBe(422);
    expect((await editar('00000000-0000-0000-0000-000000000000', tractocamion)).status).toBe(404);
  });

  it('CA 6: un vehículo desactivado sigue en el histórico con su estado actualizado', async () => {
    const res = await desactivar(id);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('INACTIVO');

    const lista = await request(app).get('/api/vehiculos').set('Authorization', `Bearer ${admin}`);
    expect(lista.body.find((v: { id: string }) => v.id === id)).toMatchObject({ placa: 'TKM482', estado: 'INACTIVO' });
    const inactivos = await request(app).get('/api/vehiculos?estado=INACTIVO').set('Authorization', `Bearer ${admin}`);
    expect(inactivos.body).toHaveLength(1);
  });

  it('desactivar dos veces devuelve el mismo resultado', async () => {
    await desactivar(id);
    const res = await desactivar(id);
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('INACTIVO');
  });

  it('CA 7: rechaza desactivar un vehículo que está en un viaje activo', async () => {
    registrarConsultaViajeActivo(async (vehiculoId) => vehiculoId === id);

    const res = await desactivar(id);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('VEHICULO_EN_VIAJE_ACTIVO');
    const detalle = await request(app).get(`/api/vehiculos/${id}`).set('Authorization', `Bearer ${admin}`);
    expect(detalle.body.estado).toBe('ACTIVO');
  });
});

describe('Seguridad (RS-04)', () => {
  it.each(['conductor@sgl.test', 'contador@sgl.test'])('%s recibe 403 en todas las operaciones', async (email) => {
    const token = await tokenDe(app, email);
    const id = '00000000-0000-0000-0000-000000000000';
    const auth = { Authorization: `Bearer ${token}` };

    const respuestas = await Promise.all([
      request(app).post('/api/vehiculos').set(auth).send(tractocamion),
      request(app).get('/api/vehiculos').set(auth),
      request(app).get(`/api/vehiculos/${id}`).set(auth),
      request(app).put(`/api/vehiculos/${id}`).set(auth).send(tractocamion),
      request(app).patch(`/api/vehiculos/${id}/desactivar`).set(auth),
    ]);

    respuestas.forEach((res) => expect(res.status).toBe(403));
    const { rows } = await pool.query('SELECT count(*)::int AS total FROM vehiculos');
    expect(rows[0].total).toBe(0);
  });

  it('sin sesión responde 401', async () => {
    expect((await request(app).get('/api/vehiculos')).status).toBe(401);
  });
});
