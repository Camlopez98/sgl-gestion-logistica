import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { pool } from '../src/db/pool';
import {
  registrarConsultaViajeActivoDeConductor,
  restablecerConsultaViajeActivoDeConductor,
} from '../src/modules/asignaciones/viajes-conductor';
import { exigirVehiculoActivo } from '../src/modules/asignaciones/asignaciones.service';
import { AppError } from '../src/shared/errors/app-error';
import { tokenDe } from './helpers/sesion';

const app = crearApp();
let admin: string;
let conductorToken: string;

// Conductores: el de pruebas (conductor@sgl.test), el inactivo y dos más creados para esta suite.
let ana: string;
let beto: string;
let carlos: string; // conductor@sgl.test
let inactivo: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

let contadorVehiculos = 0;
const placaDe = (tipo: string): string => {
  contadorVehiculos += 1;
  const n = contadorVehiculos;
  if (tipo === 'REMOLQUE') return `R${String(n).padStart(5, '0')}`;
  if (tipo === 'SEMIRREMOLQUE') return `S${String(n).padStart(5, '0')}`;
  return `ABC${String(n).padStart(3, '0')}`;
};

async function crearVehiculo(tipo: string): Promise<string> {
  const res = await request(app)
    .post('/api/vehiculos')
    .set(auth(admin))
    .send({ placa: placaDe(tipo), tipo, marca: 'Marca', modelo: 'Modelo', numeroEjes: 3, capacidadCargaKg: 20000 });
  expect(res.status).toBe(201);
  return res.body.id;
}

const desactivarVehiculo = (id: string) => request(app).patch(`/api/vehiculos/${id}/desactivar`).set(auth(admin));

const habilitar = (conductorId: string, vehiculoId: string, token = admin) =>
  request(app).post('/api/asignaciones').set(auth(token)).send({ conductorId, vehiculoId });

const activar = (id: string, cuerpo: object = {}) =>
  request(app).patch(`/api/asignaciones/${id}/activar`).set(auth(admin)).send(cuerpo);

const finalizar = (id: string, cuerpo: object = {}) =>
  request(app).patch(`/api/asignaciones/${id}/finalizar`).set(auth(admin)).send(cuerpo);

/** Habilita y devuelve el id de la asignación. */
async function habilitada(conductorId: string, vehiculoId: string): Promise<string> {
  const res = await habilitar(conductorId, vehiculoId);
  expect(res.status).toBe(201);
  return res.body.id;
}

/** Habilita y activa, opcionalmente con remolque. Devuelve el id de la asignación. */
async function activa(conductorId: string, vehiculoId: string, idRemolque?: string): Promise<string> {
  const id = await habilitada(conductorId, vehiculoId);
  const res = await activar(id, idRemolque ? { idRemolque } : {});
  expect(res.status).toBe(200);
  return id;
}

async function asignacion(id: string) {
  const { rows } = await pool.query('SELECT * FROM asignaciones_vehiculo WHERE id = $1', [id]);
  return rows[0];
}

async function total(): Promise<number> {
  const { rows } = await pool.query('SELECT count(*)::int AS total FROM asignaciones_vehiculo');
  return rows[0].total;
}

async function idDeUsuario(email: string): Promise<string> {
  const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  return rows[0].id;
}

async function crearConductor(n: number, nombre: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (cedula, nombre_completo, email, password_hash, rol)
     VALUES ($1, $2, $3, 'sin-acceso', 'CONDUCTOR') RETURNING id`,
    [`20000000${n}`, nombre, `asig${n}@sgl.test`],
  );
  await pool.query(
    `INSERT INTO conductores (usuario_id, numero_licencia, categoria_licencia) VALUES ($1, $2, 'C3')`,
    [rows[0].id, `LIC-ASIG-${n}`],
  );
  return rows[0].id;
}

beforeAll(async () => {
  admin = await tokenDe(app, 'admin@sgl.test');
  conductorToken = await tokenDe(app, 'conductor@sgl.test');
  carlos = await idDeUsuario('conductor@sgl.test');
  inactivo = await idDeUsuario('inactivo@sgl.test');
  ana = await crearConductor(1, 'Ana Ruiz');
  beto = await crearConductor(2, 'Beto Gómez');
});

beforeEach(async () => {
  await pool.query('TRUNCATE solicitudes_idempotentes, asignaciones_vehiculo, vehiculos');
});

afterEach(() => restablecerConsultaViajeActivoDeConductor());

afterAll(async () => {
  await pool.query('TRUNCATE asignaciones_vehiculo');
  await pool.query("DELETE FROM conductores WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'asig%@sgl.test')");
  await pool.query("DELETE FROM usuarios WHERE email LIKE 'asig%@sgl.test'");
});

// -------------------------------------------------------------------------------------------------
describe('Habilitación y finalización', () => {
  it('CA 1: habilita un vehículo activo a un conductor activo en estado HABILITADA con su fecha de inicio', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const res = await habilitar(ana, vehiculoId);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      conductorId: ana,
      conductorNombre: 'Ana Ruiz',
      vehiculoId,
      remolqueId: null,
      estado: 'HABILITADA',
      fechaActivacion: null,
      fechaFinalizacion: null,
      version: 1,
    });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.fechaAsignacion).toEqual(expect.any(String));
  });

  it('CA 1: se pueden habilitar varios vehículos a un conductor y un vehículo a varios conductores', async () => {
    const v1 = await crearVehiculo('CAMION');
    const v2 = await crearVehiculo('TRACTOCAMION');

    expect((await habilitar(ana, v1)).status).toBe(201);
    expect((await habilitar(ana, v2)).status).toBe(201);
    expect((await habilitar(beto, v1)).status).toBe(201);
    expect(await total()).toBe(3);
  });

  it('CA 2: advierte que ya existe una asignación vigente y no la duplica', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    await habilitar(ana, vehiculoId);
    const res = await habilitar(ana, vehiculoId);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASIGNACION_DUPLICADA');
    expect(res.body.mensaje).toContain('Ana Ruiz');
    expect(await total()).toBe(1);
  });

  it('CA 2: también advierte si la asignación vigente ya está activa', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    await activa(ana, vehiculoId);

    expect((await habilitar(ana, vehiculoId)).status).toBe(409);
    expect(await total()).toBe(1);
  });

  it('CA 2: tras finalizar una asignación se puede habilitar de nuevo el mismo vehículo', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const id = await habilitada(ana, vehiculoId);
    await finalizar(id);

    expect((await habilitar(ana, vehiculoId)).status).toBe(201);
    expect(await total()).toBe(2);
  });

  it('CA 3: rechaza un vehículo inactivo e indica el motivo', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    await desactivarVehiculo(vehiculoId);
    const res = await habilitar(ana, vehiculoId);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('VEHICULO_INACTIVO');
    expect(res.body.mensaje).toContain('inactivo');
    expect(await total()).toBe(0);
  });

  it('CA 3: rechaza un conductor inactivo e indica el motivo', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const res = await habilitar(inactivo, vehiculoId);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('CONDUCTOR_INACTIVO');
    expect(res.body.mensaje).toContain('inactivo');
    expect(await total()).toBe(0);
  });

  it.each(['REMOLQUE', 'SEMIRREMOLQUE'])('solo se habilitan automotores: rechaza un %s', async (tipo) => {
    const res = await habilitar(ana, await crearVehiculo(tipo));

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('VEHICULO_NO_HABILITABLE');
  });

  it.each(['FURGON', 'CAMION', 'TRACTOCAMION'])('habilita un %s', async (tipo) => {
    expect((await habilitar(ana, await crearVehiculo(tipo))).status).toBe(201);
  });

  it('rechaza conductor o vehículo inexistentes y datos inválidos', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const inexistente = '11111111-1111-4111-8111-111111111111';

    expect((await habilitar(inexistente, vehiculoId)).body.codigo).toBe('CONDUCTOR_NO_ENCONTRADO');
    expect((await habilitar(ana, inexistente)).body.codigo).toBe('VEHICULO_NO_ENCONTRADO');
    // Un administrador no es conductor: no tiene perfil de conductor.
    expect((await habilitar(await idDeUsuario('admin@sgl.test'), vehiculoId)).status).toBe(404);
    const invalido = await request(app).post('/api/asignaciones').set(auth(admin)).send({ conductorId: 'x' });
    expect(invalido.status).toBe(422);
    expect(invalido.body.codigo).toBe('DATOS_INVALIDOS');
  });

  it('CA 4: finalizar registra la fecha de fin sin eliminar el registro histórico', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const id = await habilitada(ana, vehiculoId);
    const res = await finalizar(id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, estado: 'FINALIZADA' });
    expect(res.body.fechaFinalizacion).toEqual(expect.any(String));
    expect(await total()).toBe(1);
    expect((await asignacion(id)).fecha_finalizacion).not.toBeNull();
  });

  it('CA 4: finalizar una asignación activa conserva su vehículo, su remolque y sus fechas', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    const id = await activa(ana, tracto, semi);
    const res = await finalizar(id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'FINALIZADA', vehiculoId: tracto, remolqueId: semi });
    expect(res.body.fechaActivacion).toEqual(expect.any(String));
    expect(res.body.fechaFinalizacion).toEqual(expect.any(String));
  });

  it('finalizar una asignación ya finalizada devuelve el mismo resultado (reintento seguro)', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));
    const primera = await finalizar(id);
    const segunda = await finalizar(id);

    expect(segunda.status).toBe(200);
    expect(segunda.body).toEqual(primera.body);
  });

  it('CA 5: no finaliza la asignación activa de un conductor con un viaje activo', async () => {
    const id = await activa(ana, await crearVehiculo('CAMION'));
    registrarConsultaViajeActivoDeConductor(async (conductorId) => conductorId === ana);

    const res = await finalizar(id);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('VIAJE_ACTIVO');
    expect((await asignacion(id)).estado).toBe('ACTIVA');
    expect((await asignacion(id)).fecha_finalizacion).toBeNull();
  });

  it('CA 5: con un viaje activo sí se puede finalizar una asignación que no es la activa', async () => {
    const enUso = await activa(ana, await crearVehiculo('CAMION'));
    const otra = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));
    registrarConsultaViajeActivoDeConductor(async () => true);

    expect((await finalizar(otra)).status).toBe(200);
    expect((await finalizar(enUso)).status).toBe(409);
  });

  it('CA 5: una vez entregado el viaje se puede finalizar', async () => {
    const id = await activa(ana, await crearVehiculo('CAMION'));
    registrarConsultaViajeActivoDeConductor(async () => true);
    expect((await finalizar(id)).status).toBe(409);

    restablecerConsultaViajeActivoDeConductor();
    expect((await finalizar(id)).status).toBe(200);
  });

  it('CA 6: el historial del vehículo muestra todos los conductores con sus fechas de inicio y fin', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const deAna = await habilitada(ana, vehiculoId);
    await finalizar(deAna);
    await habilitada(beto, vehiculoId);
    await habilitada(carlos, await crearVehiculo('FURGON')); // de otro vehículo: no aparece

    const res = await request(app).get(`/api/vehiculos/${vehiculoId}/asignaciones`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const nombres = res.body.map((a: { conductorNombre: string }) => a.conductorNombre).sort();
    expect(nombres).toEqual(['Ana Ruiz', 'Beto Gómez']);
    const delHistorial = res.body.find((a: { id: string }) => a.id === deAna);
    expect(delHistorial).toMatchObject({ estado: 'FINALIZADA', rolEnAsignacion: 'VEHICULO' });
    expect(delHistorial.fechaAsignacion).toEqual(expect.any(String));
    expect(delHistorial.fechaFinalizacion).toEqual(expect.any(String));
  });

  it('CA 6: el historial de un remolque muestra los conductores que lo tuvieron acoplado', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    const id = await activa(ana, tracto, semi);
    await finalizar(id);

    const res = await request(app).get(`/api/vehiculos/${semi}/asignaciones`).set(auth(admin));

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ conductorNombre: 'Ana Ruiz', rolEnAsignacion: 'REMOLQUE' });
  });

  it('CA 6: historial de un vehículo inexistente o con id inválido devuelve 404', async () => {
    const inexistente = await request(app)
      .get('/api/vehiculos/11111111-1111-4111-8111-111111111111/asignaciones')
      .set(auth(admin));
    const invalido = await request(app).get('/api/vehiculos/abc/asignaciones').set(auth(admin));

    expect(inexistente.status).toBe(404);
    expect(invalido.status).toBe(404);
  });

  it('lista las asignaciones con filtros por conductor y estado', async () => {
    await habilitada(ana, await crearVehiculo('CAMION'));
    await activa(ana, await crearVehiculo('TRACTOCAMION'));
    await habilitada(beto, await crearVehiculo('FURGON'));

    const todas = await request(app).get('/api/asignaciones').set(auth(admin));
    const deAna = await request(app).get('/api/asignaciones').query({ conductorId: ana }).set(auth(admin));
    const activas = await request(app).get('/api/asignaciones').query({ estado: 'ACTIVA' }).set(auth(admin));
    const invalido = await request(app).get('/api/asignaciones').query({ estado: 'X' }).set(auth(admin));

    expect(todas.body).toHaveLength(3);
    expect(deAna.body).toHaveLength(2);
    expect(activas.body).toHaveLength(1);
    expect(invalido.status).toBe(422);
  });

  it('lista los conductores activos para el selector del administrador', async () => {
    const res = await request(app).get('/api/asignaciones/conductores').set(auth(admin));

    expect(res.status).toBe(200);
    const ids = res.body.map((c: { id: string }) => c.id);
    expect(ids).toEqual(expect.arrayContaining([ana, beto, carlos]));
    expect(ids).not.toContain(inactivo);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Activación', () => {
  it('CA 7: activa un vehículo con su fecha de activación y el activo anterior vuelve a HABILITADA', async () => {
    const primero = await activa(ana, await crearVehiculo('CAMION'));
    const segundo = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));

    const res = await activar(segundo);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ACTIVA');
    expect(res.body.fechaActivacion).toEqual(expect.any(String));
    expect((await asignacion(primero)).estado).toBe('HABILITADA');
    expect((await asignacion(segundo)).estado).toBe('ACTIVA');
    const { rows } = await pool.query("SELECT count(*)::int AS n FROM asignaciones_vehiculo WHERE estado = 'ACTIVA'");
    expect(rows[0].n).toBe(1);
  });

  it('CA 7: la asignación liberada suelta su remolque y conserva su historial', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    const primero = await activa(ana, tracto, semi);
    const segundo = await habilitada(ana, await crearVehiculo('CAMION'));

    await activar(segundo);

    const liberada = await asignacion(primero);
    expect(liberada.estado).toBe('HABILITADA');
    expect(liberada.remolque_id).toBeNull();
    expect(liberada.fecha_activacion).not.toBeNull();
    expect(await total()).toBe(2);
  });

  it('CA 7: el conductor puede volver a activar un vehículo que había liberado', async () => {
    const v1 = await activa(ana, await crearVehiculo('CAMION'));
    const v2 = await activa(ana, await crearVehiculo('TRACTOCAMION'));

    expect((await activar(v1)).status).toBe(200);
    expect((await asignacion(v1)).estado).toBe('ACTIVA');
    expect((await asignacion(v2)).estado).toBe('HABILITADA');
  });

  it('activar una asignación ya activa con los mismos datos no cambia nada (reintento seguro)', async () => {
    const id = await activa(ana, await crearVehiculo('CAMION'));
    const antes = await asignacion(id);

    const res = await activar(id);

    expect(res.status).toBe(200);
    expect(res.body.version).toBe(antes.version);
    expect(new Date(res.body.fechaActivacion).getTime()).toBe(antes.fecha_activacion.getTime());
  });

  it('CA 8: rechaza activar un vehículo que está activo con otro conductor e indica con cuál', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    await activa(ana, vehiculoId);
    const deBeto = await habilitada(beto, vehiculoId);

    const res = await activar(deBeto);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('VEHICULO_ACTIVO_CON_OTRO_CONDUCTOR');
    expect(res.body.mensaje).toContain('Ana Ruiz');
    expect((await asignacion(deBeto)).estado).toBe('HABILITADA');
  });

  it('CA 8: tras liberarlo (o finalizar), el vehículo se puede activar para otro conductor', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const deAna = await activa(ana, vehiculoId);
    const deBeto = await habilitada(beto, vehiculoId);

    await finalizar(deAna);

    expect((await activar(deBeto)).status).toBe(200);
  });

  it('CA 9: rechaza cambiar el vehículo activo de un conductor con un viaje activo', async () => {
    const enViaje = await activa(ana, await crearVehiculo('CAMION'));
    const otro = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));
    registrarConsultaViajeActivoDeConductor(async (conductorId) => conductorId === ana);

    const res = await activar(otro);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('VIAJE_ACTIVO');
    expect((await asignacion(enViaje)).estado).toBe('ACTIVA');
    expect((await asignacion(otro)).estado).toBe('HABILITADA');
  });

  it('CA 9: tampoco cambia el remolque acoplado durante un viaje activo', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi1 = await crearVehiculo('SEMIRREMOLQUE');
    const semi2 = await crearVehiculo('SEMIRREMOLQUE');
    const id = await activa(ana, tracto, semi1);
    registrarConsultaViajeActivoDeConductor(async () => true);

    const res = await activar(id, { idRemolque: semi2 });

    expect(res.status).toBe(409);
    expect((await asignacion(id)).remolque_id).toBe(semi1);
  });

  it('CA 9: un viaje activo de otro conductor no impide el cambio', async () => {
    await activa(ana, await crearVehiculo('CAMION'));
    const deBeto = await activa(beto, await crearVehiculo('TRACTOCAMION'));
    const otroDeBeto = await habilitada(beto, await crearVehiculo('FURGON'));
    registrarConsultaViajeActivoDeConductor(async (conductorId) => conductorId === ana);

    expect((await activar(otroDeBeto)).status).toBe(200);
    expect((await asignacion(deBeto)).estado).toBe('HABILITADA');
  });

  it('CA 9: una vez reportado el viaje como entregado se puede cambiar el vehículo', async () => {
    await activa(ana, await crearVehiculo('CAMION'));
    const otro = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));
    registrarConsultaViajeActivoDeConductor(async () => true);
    expect((await activar(otro)).status).toBe(409);

    restablecerConsultaViajeActivoDeConductor();
    expect((await activar(otro)).status).toBe(200);
  });

  it('no activa una asignación finalizada', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));
    await finalizar(id);

    const res = await activar(id);

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASIGNACION_FINALIZADA');
  });

  it('no activa un vehículo desactivado después de habilitarlo', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const id = await habilitada(ana, vehiculoId);
    await desactivarVehiculo(vehiculoId);

    const res = await activar(id);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('VEHICULO_INACTIVO');
  });

  it('no activa la asignación de un conductor desactivado después de habilitarla', async () => {
    const id = await habilitada(beto, await crearVehiculo('CAMION'));
    await pool.query('UPDATE usuarios SET estado_activo = false WHERE id = $1', [beto]);
    try {
      const res = await activar(id);

      expect(res.status).toBe(422);
      expect(res.body.codigo).toBe('CONDUCTOR_INACTIVO');
    } finally {
      await pool.query('UPDATE usuarios SET estado_activo = true WHERE id = $1', [beto]);
    }
  });

  it('asignación inexistente o con id inválido devuelve 404', async () => {
    const inexistente = await activar('11111111-1111-4111-8111-111111111111');
    const invalido = await activar('abc');

    expect(inexistente.status).toBe(404);
    expect(inexistente.body.codigo).toBe('ASIGNACION_NO_ENCONTRADA');
    expect(invalido.status).toBe(404);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Remolques y semirremolques', () => {
  it('CA 10: acopla un semirremolque disponible a un tractocamión y ambos quedan en la asignación activa', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    const id = await habilitada(ana, tracto);

    const res = await activar(id, { idRemolque: semi });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ estado: 'ACTIVA', vehiculoId: tracto, remolqueId: semi });
    expect(res.body.remolquePlaca).toMatch(/^S\d{5}$/);
  });

  it('acopla un remolque a un camión', async () => {
    const camion = await crearVehiculo('CAMION');
    const remolque = await crearVehiculo('REMOLQUE');
    const res = await activar(await habilitada(ana, camion), { idRemolque: remolque });

    expect(res.status).toBe(200);
    expect(res.body.remolqueId).toBe(remolque);
  });

  it('CA 11: rechaza acoplar un semirremolque a un camión, porque solo admite remolque', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));

    const res = await activar(id, { idRemolque: await crearVehiculo('SEMIRREMOLQUE') });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('ACOPLE_INCOMPATIBLE');
    expect(res.body.mensaje).toContain('solo admite remolque');
    expect((await asignacion(id)).estado).toBe('HABILITADA');
  });

  it('rechaza acoplar un remolque a un tractocamión (solo admite semirremolque)', async () => {
    const id = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));

    const res = await activar(id, { idRemolque: await crearVehiculo('REMOLQUE') });

    expect(res.status).toBe(422);
    expect(res.body.mensaje).toContain('solo admite semirremolque');
  });

  it('rechaza acoplar cualquier remolque a un furgón', async () => {
    const id = await habilitada(ana, await crearVehiculo('FURGON'));

    const res = await activar(id, { idRemolque: await crearVehiculo('REMOLQUE') });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('ACOPLE_INCOMPATIBLE');
  });

  it('rechaza acoplar como remolque un vehículo automotor', async () => {
    const id = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));

    const res = await activar(id, { idRemolque: await crearVehiculo('CAMION') });

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('ACOPLE_INCOMPATIBLE');
  });

  it('rechaza un remolque inexistente o inactivo', async () => {
    const id = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));
    const inactivoId = await crearVehiculo('SEMIRREMOLQUE');
    await desactivarVehiculo(inactivoId);

    const inexistente = await activar(id, { idRemolque: '11111111-1111-4111-8111-111111111111' });
    const desactivado = await activar(id, { idRemolque: inactivoId });

    expect(inexistente.status).toBe(404);
    expect(inexistente.body.codigo).toBe('REMOLQUE_NO_ENCONTRADO');
    expect(desactivado.status).toBe(422);
    expect(desactivado.body.codigo).toBe('VEHICULO_INACTIVO');
  });

  it('CA 12: rechaza acoplar un semirremolque que ya está en la asignación activa de otro tractocamión', async () => {
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    await activa(ana, await crearVehiculo('TRACTOCAMION'), semi);
    const deBeto = await habilitada(beto, await crearVehiculo('TRACTOCAMION'));

    const res = await activar(deBeto, { idRemolque: semi });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('REMOLQUE_OCUPADO');
    expect(res.body.mensaje).toContain('Ana Ruiz');
    expect((await asignacion(deBeto)).estado).toBe('HABILITADA');
  });

  it('CA 12: un remolque liberado queda disponible para otro tractocamión', async () => {
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    const deAna = await activa(ana, await crearVehiculo('TRACTOCAMION'), semi);
    const deBeto = await habilitada(beto, await crearVehiculo('TRACTOCAMION'));

    await finalizar(deAna);

    expect((await activar(deBeto, { idRemolque: semi })).status).toBe(200);
  });

  it('el mismo conductor puede llevar su remolque al nuevo vehículo que activa', async () => {
    const remolque = await crearVehiculo('REMOLQUE');
    const primero = await activa(ana, await crearVehiculo('CAMION'), remolque);
    const segundo = await habilitada(ana, await crearVehiculo('CAMION'));

    const res = await activar(segundo, { idRemolque: remolque });

    expect(res.status).toBe(200);
    expect(res.body.remolqueId).toBe(remolque);
    expect((await asignacion(primero)).remolque_id).toBeNull();
  });

  it('cambia el remolque de la asignación activa cuando no hay viaje activo', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi1 = await crearVehiculo('SEMIRREMOLQUE');
    const semi2 = await crearVehiculo('SEMIRREMOLQUE');
    const id = await activa(ana, tracto, semi1);

    const res = await activar(id, { idRemolque: semi2 });

    expect(res.status).toBe(200);
    expect(res.body.remolqueId).toBe(semi2);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Selector del conductor', () => {
  const vehiculoActivo = (token = conductorToken) =>
    request(app).get('/api/conductores/me/vehiculo-activo').set(auth(token));

  it('CA 13: muestra solo el vehículo activo y su remolque acoplado', async () => {
    const tracto = await crearVehiculo('TRACTOCAMION');
    const semi = await crearVehiculo('SEMIRREMOLQUE');
    await habilitada(carlos, await crearVehiculo('FURGON')); // habilitado, pero no activo: no se muestra
    const id = await activa(carlos, tracto, semi);

    const res = await vehiculoActivo();

    expect(res.status).toBe(200);
    expect(res.body.asignacionId).toBe(id);
    expect(res.body.vehiculo).toMatchObject({ id: tracto, tipo: 'TRACTOCAMION' });
    expect(res.body.remolque).toMatchObject({ id: semi, tipo: 'SEMIRREMOLQUE' });
  });

  it('CA 13: sin remolque acoplado, el remolque es nulo', async () => {
    await activa(carlos, await crearVehiculo('CAMION'));

    const res = await vehiculoActivo();

    expect(res.status).toBe(200);
    expect(res.body.remolque).toBeNull();
  });

  it('CA 13: el conductor solo ve su propio vehículo activo', async () => {
    await activa(ana, await crearVehiculo('CAMION'));

    expect((await vehiculoActivo()).status).toBe(404);
  });

  it('CA 14: sin vehículo activo no puede iniciar un manifiesto e indica que necesita uno asignado', async () => {
    const res = await vehiculoActivo();

    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('SIN_VEHICULO_ACTIVO');
    expect(res.body.mensaje).toContain('vehículo asignado');
  });

  it('CA 14: con vehículos habilitados pero ninguno activo tampoco puede iniciarlo', async () => {
    await habilitada(carlos, await crearVehiculo('CAMION'));

    expect((await vehiculoActivo()).status).toBe(404);
  });

  it('CA 14: si el vehículo activo fue desactivado, ya no puede iniciar un manifiesto', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    await activa(carlos, vehiculoId);
    expect((await vehiculoActivo()).status).toBe(200);

    await desactivarVehiculo(vehiculoId);

    const res = await vehiculoActivo();
    expect(res.status).toBe(404);
    expect(res.body.codigo).toBe('SIN_VEHICULO_ACTIVO');
  });

  it('CA 14: al finalizar la asignación activa deja de tener vehículo activo', async () => {
    const id = await activa(carlos, await crearVehiculo('CAMION'));
    await finalizar(id);

    expect((await vehiculoActivo()).status).toBe(404);
  });

  it('el selector es solo del conductor: administrador y sin sesión no entran', async () => {
    expect((await vehiculoActivo(admin)).status).toBe(403);
    expect((await request(app).get('/api/conductores/me/vehiculo-activo')).status).toBe(401);
  });

  describe('CA 15: validación del servidor al registrar un manifiesto', () => {
    const rechazo = async (llamada: Promise<void>) => {
      const error = await llamada.then(
        () => null,
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(AppError);
      expect(error).toMatchObject({ status: 403, codigo: 'VEHICULO_NO_ACTIVADO' });
    };

    it('acepta el vehículo activo del conductor, con su remolque si lo tiene', async () => {
      const tracto = await crearVehiculo('TRACTOCAMION');
      const semi = await crearVehiculo('SEMIRREMOLQUE');
      await activa(carlos, tracto, semi);

      await expect(exigirVehiculoActivo(carlos, tracto, semi)).resolves.toBeUndefined();
    });

    it('rechaza un vehículo que el conductor no tiene activado', async () => {
      await activa(carlos, await crearVehiculo('CAMION'));
      const ajeno = await crearVehiculo('FURGON');

      await rechazo(exigirVehiculoActivo(carlos, ajeno));
    });

    it('rechaza un vehículo habilitado pero no activo', async () => {
      await activa(carlos, await crearVehiculo('CAMION'));
      const habilitado = await crearVehiculo('FURGON');
      await habilitada(carlos, habilitado);

      await rechazo(exigirVehiculoActivo(carlos, habilitado));
    });

    it('rechaza el vehículo activo de otro conductor', async () => {
      const deAna = await crearVehiculo('CAMION');
      await activa(ana, deAna);

      await rechazo(exigirVehiculoActivo(carlos, deAna));
    });

    it('rechaza a un conductor sin ningún vehículo activo', async () => {
      await rechazo(exigirVehiculoActivo(carlos, await crearVehiculo('CAMION')));
    });

    it('rechaza un remolque distinto al acoplado, o enviar uno cuando no hay acople', async () => {
      const tracto = await crearVehiculo('TRACTOCAMION');
      const semi = await crearVehiculo('SEMIRREMOLQUE');
      const otroSemi = await crearVehiculo('SEMIRREMOLQUE');
      await activa(carlos, tracto, semi);

      await rechazo(exigirVehiculoActivo(carlos, tracto, otroSemi));
      await rechazo(exigirVehiculoActivo(carlos, tracto));
    });

    it('rechaza el vehículo activo si fue desactivado', async () => {
      const vehiculoId = await crearVehiculo('CAMION');
      await activa(carlos, vehiculoId);
      await desactivarVehiculo(vehiculoId);

      await rechazo(exigirVehiculoActivo(carlos, vehiculoId));
    });
  });
});

// -------------------------------------------------------------------------------------------------
describe('Seguridad (RS-04)', () => {
  it('solo el administrador gestiona asignaciones', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const id = await habilitada(ana, vehiculoId);

    expect((await habilitar(ana, vehiculoId, conductorToken)).status).toBe(403);
    expect((await request(app).patch(`/api/asignaciones/${id}/activar`).set(auth(conductorToken)).send({})).status).toBe(403);
    expect((await request(app).patch(`/api/asignaciones/${id}/finalizar`).set(auth(conductorToken)).send({})).status).toBe(403);
    expect((await request(app).get('/api/asignaciones').set(auth(conductorToken))).status).toBe(403);
    expect((await request(app).get(`/api/vehiculos/${vehiculoId}/asignaciones`).set(auth(conductorToken))).status).toBe(403);
  });

  it('sin sesión se responde 401', async () => {
    expect((await request(app).post('/api/asignaciones').send({})).status).toBe(401);
    expect((await request(app).get('/api/asignaciones')).status).toBe(401);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Fallas de red y concurrencia', () => {
  it('CA 16: si la operación falla no queda una asignación parcial (todo o nada)', async () => {
    const primero = await activa(ana, await crearVehiculo('CAMION'));
    const segundo = await habilitada(ana, await crearVehiculo('CAMION'));

    // El acople es inválido: la activación se rechaza y la asignación activa anterior no se toca.
    const res = await activar(segundo, { idRemolque: await crearVehiculo('SEMIRREMOLQUE') });

    expect(res.status).toBe(422);
    expect((await asignacion(primero)).estado).toBe('ACTIVA');
    expect((await asignacion(segundo)).estado).toBe('HABILITADA');
    expect((await asignacion(primero)).version).toBe(2);
  });

  it('CA 17: tras un fallo del servidor, el reintento con la misma clave crea una sola asignación', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const solicitud = () =>
      request(app)
        .post('/api/asignaciones')
        .set(auth(admin))
        .set('Idempotency-Key', 'clave-habilitar-1')
        .send({ conductorId: ana, vehiculoId });

    // Se simula un fallo real de la base de datos en el INSERT de la primera solicitud.
    await pool.query(`
      CREATE FUNCTION fn_falla_prueba() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'falla simulada'; END;
      $$ LANGUAGE plpgsql`);
    await pool.query(`
      CREATE TRIGGER trg_falla_prueba BEFORE INSERT ON asignaciones_vehiculo
      FOR EACH ROW EXECUTE FUNCTION fn_falla_prueba()`);
    let fallida;
    try {
      fallida = await solicitud();
    } finally {
      await pool.query('DROP TRIGGER trg_falla_prueba ON asignaciones_vehiculo');
      await pool.query('DROP FUNCTION fn_falla_prueba()');
    }

    expect(fallida.status).toBe(500);
    expect(await total()).toBe(0);

    const reintento = await solicitud();
    const otroReintento = await solicitud();

    expect(reintento.status).toBe(201);
    expect(otroReintento.status).toBe(201);
    expect(otroReintento.body.id).toBe(reintento.body.id);
    expect(otroReintento.headers['idempotent-replayed']).toBe('true');
    expect(await total()).toBe(1);
  });

  it('CA 17: reenviar la misma solicitud tras un corte de red no duplica la asignación', async () => {
    const vehiculoId = await crearVehiculo('CAMION');
    const enviar = () =>
      request(app)
        .post('/api/asignaciones')
        .set(auth(admin))
        .set('Idempotency-Key', 'clave-habilitar-2')
        .send({ conductorId: ana, vehiculoId });

    const primera = await enviar();
    const reenvio = await enviar();

    expect(primera.status).toBe(201);
    expect(reenvio.status).toBe(201);
    expect(reenvio.body.id).toBe(primera.body.id);
    expect(await total()).toBe(1);
  });

  it('CA 17: dos solicitudes simultáneas iguales crean una sola asignación', async () => {
    const vehiculoId = await crearVehiculo('CAMION');

    const [a, b] = await Promise.all([habilitar(ana, vehiculoId), habilitar(ana, vehiculoId)]);

    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find((r) => r.status === 409)?.body.codigo).toBe('ASIGNACION_DUPLICADA');
    expect(await total()).toBe(1);
  });

  it('CA 18: dos administradores activan el mismo vehículo para conductores distintos: solo se aplica la primera', async () => {
    // Se repite varias veces para ejercitar distintos intercalados de las dos transacciones.
    for (let ronda = 0; ronda < 8; ronda++) {
      await pool.query('TRUNCATE asignaciones_vehiculo, vehiculos');
      const vehiculoId = await crearVehiculo('CAMION');
      const deAna = await habilitada(ana, vehiculoId);
      const deBeto = await habilitada(beto, vehiculoId);

      const [a, b] = await Promise.all([activar(deAna), activar(deBeto)]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      const perdedora = a.status === 409 ? a : b;
      expect(perdedora.body.codigo).toBe('VEHICULO_ACTIVO_CON_OTRO_CONDUCTOR');
      expect(perdedora.body.mensaje).toMatch(/Ana Ruiz|Beto Gómez/);

      const { rows } = await pool.query(
        "SELECT count(*)::int AS n FROM asignaciones_vehiculo WHERE vehiculo_id = $1 AND estado = 'ACTIVA'",
        [vehiculoId],
      );
      expect(rows[0].n).toBe(1);
    }
  });

  it('CA 18: dos administradores acoplan el mismo semirremolque a tractocamiones distintos: solo se aplica la primera', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      await pool.query('TRUNCATE asignaciones_vehiculo, vehiculos');
      const semi = await crearVehiculo('SEMIRREMOLQUE');
      const deAna = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));
      const deBeto = await habilitada(beto, await crearVehiculo('TRACTOCAMION'));

      const [a, b] = await Promise.all([activar(deAna, { idRemolque: semi }), activar(deBeto, { idRemolque: semi })]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect((a.status === 409 ? a : b).body.codigo).toBe('REMOLQUE_OCUPADO');
    }
  });

  it('dos administradores activan a la vez dos vehículos del mismo conductor: queda uno solo activo', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      await pool.query('TRUNCATE asignaciones_vehiculo, vehiculos');
      const uno = await habilitada(ana, await crearVehiculo('CAMION'));
      const dos = await habilitada(ana, await crearVehiculo('TRACTOCAMION'));

      const [a, b] = await Promise.all([activar(uno), activar(dos)]);

      expect([a.status, b.status]).toEqual([200, 200]); // se aplican una tras otra, sin dejar dos activas
      const { rows } = await pool.query(
        "SELECT count(*)::int AS n FROM asignaciones_vehiculo WHERE conductor_id = $1 AND estado = 'ACTIVA'",
        [ana],
      );
      expect(rows[0].n).toBe(1);
    }
  });

  it('CA 19: si otro administrador ya modificó la asignación, el segundo cambio se rechaza y se pide recargar', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));
    const cargada = (await request(app).get('/api/asignaciones').query({ conductorId: ana }).set(auth(admin))).body[0];
    expect(cargada.version).toBe(1);

    // El primer administrador activa; el segundo todavía tiene la versión 1 en pantalla.
    expect((await activar(id, { version: 1 })).status).toBe(200);
    const res = await finalizar(id, { version: 1 });

    expect(res.status).toBe(409);
    expect(res.body.codigo).toBe('ASIGNACION_MODIFICADA');
    expect(res.body.mensaje).toContain('Recargue');
    expect((await asignacion(id)).estado).toBe('ACTIVA');
  });

  it('CA 19: con la versión actual el cambio se aplica y la versión avanza', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));

    const activada = await activar(id, { version: 1 });
    const finalizada = await finalizar(id, { version: activada.body.version });

    expect(activada.body.version).toBe(2);
    expect(finalizada.status).toBe(200);
    expect(finalizada.body.version).toBe(3);
  });

  it('CA 19: dos modificaciones simultáneas con la misma versión: solo se aplica la primera', async () => {
    for (let ronda = 0; ronda < 5; ronda++) {
      await pool.query('TRUNCATE asignaciones_vehiculo, vehiculos');
      const tracto = await crearVehiculo('TRACTOCAMION');
      const semi1 = await crearVehiculo('SEMIRREMOLQUE');
      const semi2 = await crearVehiculo('SEMIRREMOLQUE');
      const id = await habilitada(ana, tracto);

      const [a, b] = await Promise.all([
        activar(id, { idRemolque: semi1, version: 1 }),
        activar(id, { idRemolque: semi2, version: 1 }),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect((a.status === 409 ? a : b).body.codigo).toBe('ASIGNACION_MODIFICADA');
      expect((await asignacion(id)).version).toBe(2);
    }
  });

  it('CA 19: la versión debe ser un entero positivo', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));

    expect((await activar(id, { version: 0 })).status).toBe(422);
    expect((await finalizar(id, { version: 'x' })).status).toBe(422);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Integridad en la base de datos (DoD)', () => {
  it('ninguna asignación se elimina físicamente', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));

    await expect(pool.query('DELETE FROM asignaciones_vehiculo WHERE id = $1', [id])).rejects.toThrow(/no se eliminan/);
    await expect(pool.query('DELETE FROM asignaciones_vehiculo')).rejects.toThrow(/no se eliminan/);
    expect(await total()).toBe(1);

    await finalizar(id);
    await expect(pool.query('DELETE FROM asignaciones_vehiculo WHERE id = $1', [id])).rejects.toThrow(/no se eliminan/);
    expect(await total()).toBe(1);
  });

  it('no existe ningún endpoint para eliminar asignaciones', async () => {
    const id = await habilitada(ana, await crearVehiculo('CAMION'));

    const res = await request(app).delete(`/api/asignaciones/${id}`).set(auth(admin));

    expect(res.status).toBe(404);
    expect(await total()).toBe(1);
  });

  it('las invariantes también las impone la base de datos, sin pasar por el servicio', async () => {
    const camion = await crearVehiculo('CAMION');
    const otroCamion = await crearVehiculo('CAMION');
    const remolque = await crearVehiculo('REMOLQUE');
    const insertarActiva = (conductor: string, vehiculo: string, remolqueId: string | null = null) =>
      pool.query(
        `INSERT INTO asignaciones_vehiculo (conductor_id, vehiculo_id, remolque_id, estado, fecha_activacion)
         VALUES ($1, $2, $3, 'ACTIVA', now())`,
        [conductor, vehiculo, remolqueId],
      );

    await insertarActiva(ana, camion, remolque);

    // Invariante 2: el mismo vehículo, o el mismo remolque, en otra asignación activa.
    await expect(insertarActiva(beto, camion)).rejects.toMatchObject({ constraint: 'uq_asignaciones_activa_vehiculo' });
    await expect(insertarActiva(beto, otroCamion, remolque)).rejects.toMatchObject({
      constraint: 'uq_asignaciones_activa_remolque',
    });
    // Invariante 1: el mismo conductor con dos asignaciones activas.
    await expect(insertarActiva(ana, otroCamion)).rejects.toMatchObject({ constraint: 'uq_asignaciones_activa_conductor' });
    // Una asignación activa debe tener fecha de activación; una finalizada, fecha de fin.
    await expect(
      pool.query("INSERT INTO asignaciones_vehiculo (conductor_id, vehiculo_id, estado) VALUES ($1, $2, 'ACTIVA')", [beto, otroCamion]),
    ).rejects.toMatchObject({ constraint: 'ck_asignaciones_estado_fechas' });
    await expect(
      pool.query("INSERT INTO asignaciones_vehiculo (conductor_id, vehiculo_id, estado) VALUES ($1, $2, 'FINALIZADA')", [beto, otroCamion]),
    ).rejects.toMatchObject({ constraint: 'ck_asignaciones_estado_fechas' });
  });
});
