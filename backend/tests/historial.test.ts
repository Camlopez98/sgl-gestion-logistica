import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { crearApp } from '../src/app';
import { pool } from '../src/db/pool';
import { firmarToken } from '../src/shared/seguridad/token';
import { tokenDe } from './helpers/sesion';

const app = crearApp();

let carlos: string; // conductor@sgl.test
let ana: string;
let inactivo: string;
let tokenCarlos: string;
let tokenAna: string;
let tokenAdmin: string;
let tokenContador: string;
let tokenInactivo: string;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const ENDPOINT = '/api/conductores/me/viajes';
const listar = (token: string, consulta = '') => request(app).get(`${ENDPOINT}${consulta}`).set(auth(token));
const detalle = (token: string, id: string) => request(app).get(`${ENDPOINT}/${id}`).set(auth(token));

let vehiculo: string;
let remolque: string;

async function idDeUsuario(email: string): Promise<string> {
  const { rows } = await pool.query('SELECT id FROM usuarios WHERE email = $1', [email]);
  return rows[0].id;
}

async function crearConductor(n: number, nombre: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO usuarios (cedula, nombre_completo, email, password_hash, rol)
     VALUES ($1, $2, $3, 'sin-acceso', 'CONDUCTOR') RETURNING id`,
    [`30000000${n}`, nombre, `hist${n}@sgl.test`],
  );
  await pool.query(
    `INSERT INTO conductores (usuario_id, numero_licencia, categoria_licencia) VALUES ($1, $2, 'C3')`,
    [rows[0].id, `LIC-HIST-${n}`],
  );
  return rows[0].id;
}

async function crearVehiculo(placa: string, tipo: string): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO vehiculos (placa, tipo, marca, modelo, numero_ejes, capacidad_carga_kg)
     VALUES ($1, $2, 'Marca', 'Modelo', 3, 20000) RETURNING id`,
    [placa, tipo],
  );
  return rows[0].id;
}

interface DatosViaje {
  estado?: 'ACTIVO' | 'PENDIENTE_REVISION' | 'FINALIZADO';
  origen?: string;
  destino?: string;
  valorFlete?: number;
  fechaInicio?: string;
  fechaEntrega?: string | null;
  remolqueId?: string | null;
}

let contadorViajes = 0;

/** Inserta un viaje directamente: el registro de viajes pertenece a otra historia. */
async function crearViaje(conductorId: string, datos: DatosViaje = {}): Promise<string> {
  contadorViajes += 1;
  const { rows } = await pool.query<{ id: string }>(
    `INSERT INTO viajes (conductor_id, vehiculo_id, remolque_id, estado, origen, destino, valor_flete, fecha_inicio, fecha_entrega)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [
      conductorId,
      vehiculo,
      datos.remolqueId ?? null,
      datos.estado ?? 'FINALIZADO',
      datos.origen ?? `Origen ${contadorViajes}`,
      datos.destino ?? `Destino ${contadorViajes}`,
      datos.valorFlete ?? 1_000_000,
      datos.fechaInicio ?? new Date(Date.UTC(2026, 0, 1, 12, contadorViajes)).toISOString(),
      datos.fechaEntrega ?? null,
    ],
  );
  return rows[0].id;
}

async function crearManifiesto(viajeId: string): Promise<void> {
  await pool.query(
    `INSERT INTO manifiestos_carga (viaje_id, numero_manifiesto, url_imagen, tipo_mime, tamano_bytes, fecha_carga)
     VALUES ($1, 'MAN-0001', 'https://archivos.sgl.test/manifiestos/man-0001.jpg', 'image/jpeg', 204800, '2026-10-10T12:00:00Z')`,
    [viajeId],
  );
}

async function crearGasto(viajeId: string, tipo: string, monto: number, concepto: string, segundos: number): Promise<void> {
  await pool.query(
    `INSERT INTO gastos_ruta (viaje_id, tipo, monto, concepto, url_soporte, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [viajeId, tipo, monto, concepto, `https://archivos.sgl.test/soportes/${concepto}.jpg`, new Date(Date.UTC(2026, 9, 10, 15, 0, segundos))],
  );
}

/** Sigue los cursores hasta agotar el historial; devuelve los bloques recibidos. */
async function recorrer(token: string, consulta: string): Promise<{ items: { id: string }[]; siguienteCursor: string | null; total: number }[]> {
  const bloques = [];
  let cursor: string | null = null;
  do {
    const separador = consulta.includes('?') ? '&' : '?';
    const url: string = `${consulta}${cursor ? `${separador}cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await listar(token, url);
    expect(res.status).toBe(200);
    bloques.push(res.body);
    cursor = res.body.siguienteCursor;
    expect(bloques.length).toBeLessThan(100);
  } while (cursor);
  return bloques;
}

beforeAll(async () => {
  carlos = await idDeUsuario('conductor@sgl.test');
  inactivo = await idDeUsuario('inactivo@sgl.test');
  ana = await crearConductor(1, 'Ana Ruiz');

  tokenCarlos = await tokenDe(app, 'conductor@sgl.test');
  tokenAdmin = await tokenDe(app, 'admin@sgl.test');
  tokenContador = await tokenDe(app, 'contador@sgl.test');
  // Los conductores creados por la suite no tienen contraseña: se firma su token directamente.
  tokenAna = firmarToken({ id: ana, rol: 'CONDUCTOR' });
  tokenInactivo = firmarToken({ id: inactivo, rol: 'CONDUCTOR' });
});

beforeEach(async () => {
  await pool.query('TRUNCATE gastos_ruta, manifiestos_carga, viajes, asignaciones_vehiculo, vehiculos');
  vehiculo = await crearVehiculo('TKM482', 'TRACTOCAMION');
  remolque = await crearVehiculo('S12345', 'SEMIRREMOLQUE');
});

afterAll(async () => {
  await pool.query('TRUNCATE gastos_ruta, manifiestos_carga, viajes, asignaciones_vehiculo, vehiculos');
  await pool.query("DELETE FROM conductores WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'hist%@sgl.test')");
  await pool.query("DELETE FROM usuarios WHERE email LIKE 'hist%@sgl.test'");
});

// -------------------------------------------------------------------------------------------------
describe('Consulta del historial', () => {
  it('CA 1: muestra únicamente los viajes del conductor de la sesión', async () => {
    const deCarlos = [await crearViaje(carlos), await crearViaje(carlos), await crearViaje(carlos)];
    const deAna = [await crearViaje(ana), await crearViaje(ana)];

    const resCarlos = await listar(tokenCarlos);
    const resAna = await listar(tokenAna);

    expect(resCarlos.status).toBe(200);
    expect(resCarlos.body.items.map((v: { id: string }) => v.id).sort()).toEqual([...deCarlos].sort());
    expect(resCarlos.body.total).toBe(3);
    expect(resAna.body.items.map((v: { id: string }) => v.id).sort()).toEqual([...deAna].sort());
    expect(resAna.body.total).toBe(2);
  });

  it('CA 1: ignora cualquier identificador de conductor enviado por el cliente', async () => {
    const deCarlos = await crearViaje(carlos);
    await crearViaje(ana);

    for (const consulta of [`?conductorId=${ana}`, `?conductor_id=${ana}`, `?usuarioId=${ana}`]) {
      const res = await listar(tokenCarlos, consulta);
      expect(res.status).toBe(200);
      expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([deCarlos]);
    }
  });

  it('el listado trae los datos del historial: estado, origen, destino, flete, fecha, placa y gastos', async () => {
    const id = await crearViaje(carlos, {
      estado: 'PENDIENTE_REVISION',
      origen: 'Bogotá',
      destino: 'Cali',
      valorFlete: 3_200_000,
      fechaInicio: '2026-10-10T08:00:00Z',
    });
    await crearGasto(id, 'PEAJE', 45_000.5, 'peaje-1', 1);
    await crearGasto(id, 'COMBUSTIBLE', 300_000, 'combustible-1', 2);

    const res = await listar(tokenCarlos);

    expect(res.body.items).toEqual([
      {
        id,
        estado: 'PENDIENTE_REVISION',
        origen: 'Bogotá',
        destino: 'Cali',
        valorFlete: 3_200_000,
        fechaInicio: '2026-10-10T08:00:00.000Z',
        placaVehiculo: 'TKM482',
        totalGastos: 345_000.5,
      },
    ]);
  });

  it('CA 2: por defecto devuelve los 5 más recientes, del más nuevo al más antiguo, y avisa que hay más', async () => {
    const ids: string[] = [];
    for (let dia = 1; dia <= 12; dia++) {
      ids.push(await crearViaje(carlos, { fechaInicio: `2026-09-${String(dia).padStart(2, '0')}T15:00:00Z` }));
    }

    const res = await listar(tokenCarlos);

    expect(res.status).toBe(200);
    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([ids[11], ids[10], ids[9], ids[8], ids[7]]);
    expect(res.body.siguienteCursor).toEqual(expect.any(String));
    expect(res.body.total).toBe(12);
  });

  it('CA 2: con 5 viajes o menos no ofrece "ver más"', async () => {
    for (let i = 0; i < 5; i++) await crearViaje(carlos);

    const res = await listar(tokenCarlos);

    expect(res.body.items).toHaveLength(5);
    expect(res.body.siguienteCursor).toBeNull();
    expect(res.body.total).toBe(5);
  });

  it('CA 3: "ver más" agrega el siguiente bloque en orden descendente, sin repetir ni omitir viajes', async () => {
    const ids: string[] = [];
    for (let dia = 1; dia <= 12; dia++) {
      ids.push(await crearViaje(carlos, { fechaInicio: `2026-09-${String(dia).padStart(2, '0')}T15:00:00Z` }));
    }

    const bloques = await recorrer(tokenCarlos, '');

    expect(bloques.map((b) => b.items.length)).toEqual([5, 5, 2]);
    expect(bloques.map((b) => b.siguienteCursor === null)).toEqual([false, false, true]);
    expect(bloques.flatMap((b) => b.items.map((v) => v.id))).toEqual([...ids].reverse());
  });

  it('CA 3: viajes con la misma fecha de inicio se paginan sin repetirse ni perderse', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 7; i++) ids.push(await crearViaje(carlos, { fechaInicio: '2026-10-01T10:00:00Z' }));

    const bloques = await recorrer(tokenCarlos, '?limite=2');
    const recibidos = bloques.flatMap((b) => b.items.map((v) => v.id));

    expect(recibidos).toHaveLength(7);
    expect(new Set(recibidos).size).toBe(7);
    expect([...recibidos].sort()).toEqual([...ids].sort());
  });

  it('CA 3: viajes que difieren solo en microsegundos no se pierden al paginar', async () => {
    const a = await crearViaje(carlos, { fechaInicio: '2026-10-01T10:00:00.000001Z' });
    const b = await crearViaje(carlos, { fechaInicio: '2026-10-01T10:00:00.000002Z' });
    const c = await crearViaje(carlos, { fechaInicio: '2026-10-01T10:00:00.000003Z' });

    const bloques = await recorrer(tokenCarlos, '?limite=1');

    expect(bloques.flatMap((b2) => b2.items.map((v) => v.id))).toEqual([c, b, a]);
  });

  it('CA 3: un viaje nuevo registrado entre dos bloques no duplica ninguno de los ya mostrados', async () => {
    for (let dia = 1; dia <= 8; dia++) await crearViaje(carlos, { fechaInicio: `2026-09-${String(dia).padStart(2, '0')}T15:00:00Z` });

    const primero = await listar(tokenCarlos);
    await crearViaje(carlos, { fechaInicio: '2026-10-20T15:00:00Z' }); // más reciente que todo lo mostrado
    const segundo = await listar(tokenCarlos, `?cursor=${encodeURIComponent(primero.body.siguienteCursor)}`);

    const vistos = primero.body.items.map((v: { id: string }) => v.id);
    const siguientes = segundo.body.items.map((v: { id: string }) => v.id);
    expect(siguientes).toHaveLength(3);
    expect(siguientes.filter((id: string) => vistos.includes(id))).toEqual([]);
  });

  it('CA 3: el tamaño del bloque se puede indicar, con un máximo de 20', async () => {
    for (let i = 0; i < 25; i++) await crearViaje(carlos);

    expect((await listar(tokenCarlos, '?limite=3')).body.items).toHaveLength(3);
    expect((await listar(tokenCarlos, '?limite=20')).body.items).toHaveLength(20);
    for (const limite of ['0', '21', '-1', 'abc', '2.5']) {
      const res = await listar(tokenCarlos, `?limite=${limite}`);
      expect(res.status, `limite=${limite}`).toBe(422);
      expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    }
  });

  it('CA 3: rechaza un cursor que el servidor no emitió', async () => {
    const falsos = [
      'esto-no-es-un-cursor',
      Buffer.from('no es json').toString('base64url'),
      Buffer.from(JSON.stringify({ f: 'ayer', i: 'x' })).toString('base64url'),
      Buffer.from(JSON.stringify({ f: "2026-10-01T10:00:00.000000Z'; DROP TABLE viajes;--", i: carlos })).toString('base64url'),
    ];
    for (const cursor of falsos) {
      const res = await listar(tokenCarlos, `?cursor=${encodeURIComponent(cursor)}`);
      expect(res.status).toBe(422);
      expect(res.body.codigo).toBe('CURSOR_INVALIDO');
    }
    const { rows } = await pool.query("SELECT to_regclass('viajes') AS tabla");
    expect(rows[0].tabla).toBe('viajes');
  });

  it('CA 1 y 8: un cursor con la posición de un viaje ajeno no revela viajes de otro conductor', async () => {
    const deAna = await crearViaje(ana, { fechaInicio: '2026-10-05T10:00:00Z' });
    const deCarlos = await crearViaje(carlos, { fechaInicio: '2026-10-01T10:00:00Z' });
    await crearViaje(ana, { fechaInicio: '2026-09-01T10:00:00Z' });
    const paginaDeAna = await listar(tokenAna, '?limite=1');

    const res = await listar(tokenCarlos, `?cursor=${encodeURIComponent(paginaDeAna.body.siguienteCursor)}`);

    expect(res.status).toBe(200);
    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([deCarlos]);
    expect(JSON.stringify(res.body)).not.toContain(deAna);
  });

  it('CA 4: sin viajes responde una lista vacía con total 0 (la pantalla muestra el mensaje)', async () => {
    await crearViaje(ana);

    const res = await listar(tokenCarlos);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ items: [], siguienteCursor: null, total: 0 });
  });
});

// -------------------------------------------------------------------------------------------------
describe('Filtros', () => {
  it('CA 5: filtra por estado', async () => {
    const activo = await crearViaje(carlos, { estado: 'ACTIVO' });
    const revision = await crearViaje(carlos, { estado: 'PENDIENTE_REVISION' });
    const finalizado = await crearViaje(carlos, { estado: 'FINALIZADO' });
    await crearViaje(ana, { estado: 'ACTIVO' });

    const idsDe = async (estado: string) =>
      (await listar(tokenCarlos, `?estado=${estado}`)).body.items.map((v: { id: string }) => v.id);

    expect(await idsDe('ACTIVO')).toEqual([activo]);
    expect(await idsDe('PENDIENTE_REVISION')).toEqual([revision]);
    expect(await idsDe('FINALIZADO')).toEqual([finalizado]);
  });

  it('CA 5: filtra por rango de fechas incluyendo el día inicial y el final completos (hora de Colombia)', async () => {
    // Colombia es UTC-5: el 1 de octubre empieza a las 05:00Z y el 5 termina a las 04:59:59Z del día 6.
    await crearViaje(carlos, { fechaInicio: '2026-10-01T04:59:59.999Z' }); // 30 sep 23:59:59.999: fuera
    const inicio = await crearViaje(carlos, { fechaInicio: '2026-10-01T05:00:00Z' }); // 1 oct 00:00: dentro
    const medio = await crearViaje(carlos, { fechaInicio: '2026-10-03T17:00:00Z' });
    const fin = await crearViaje(carlos, { fechaInicio: '2026-10-06T04:59:59Z' }); // 5 oct 23:59:59: dentro
    await crearViaje(carlos, { fechaInicio: '2026-10-06T05:00:00Z' }); // 6 oct 00:00: fuera

    const res = await listar(tokenCarlos, '?desde=2026-10-01&hasta=2026-10-05');

    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([fin, medio, inicio]);
    expect(res.body.total).toBe(3);
  });

  it('CA 5: acepta solo la fecha inicial o solo la final', async () => {
    const antiguo = await crearViaje(carlos, { fechaInicio: '2026-08-10T15:00:00Z' });
    const nuevo = await crearViaje(carlos, { fechaInicio: '2026-10-10T15:00:00Z' });

    const desde = await listar(tokenCarlos, '?desde=2026-09-01');
    const hasta = await listar(tokenCarlos, '?hasta=2026-09-01');

    expect(desde.body.items.map((v: { id: string }) => v.id)).toEqual([nuevo]);
    expect(hasta.body.items.map((v: { id: string }) => v.id)).toEqual([antiguo]);
  });

  it('CA 5: combina estado y rango de fechas', async () => {
    await crearViaje(carlos, { estado: 'FINALIZADO', fechaInicio: '2026-09-10T15:00:00Z' });
    const buscado = await crearViaje(carlos, { estado: 'FINALIZADO', fechaInicio: '2026-10-10T15:00:00Z' });
    await crearViaje(carlos, { estado: 'ACTIVO', fechaInicio: '2026-10-11T15:00:00Z' });
    await crearViaje(ana, { estado: 'FINALIZADO', fechaInicio: '2026-10-10T15:00:00Z' });

    const res = await listar(tokenCarlos, '?estado=FINALIZADO&desde=2026-10-01&hasta=2026-10-31');

    expect(res.body.items.map((v: { id: string }) => v.id)).toEqual([buscado]);
    expect(res.body.total).toBe(1);
  });

  it('CA 5: el total y "ver más" respetan los filtros', async () => {
    for (let i = 0; i < 7; i++) await crearViaje(carlos, { estado: 'FINALIZADO' });
    for (let i = 0; i < 4; i++) await crearViaje(carlos, { estado: 'ACTIVO' });

    const bloques = await recorrer(tokenCarlos, '?estado=FINALIZADO');

    expect(bloques.map((b) => b.items.length)).toEqual([5, 2]);
    expect(bloques.every((b) => b.total === 7)).toBe(true);
  });

  it('CA 5: un filtro sin coincidencias devuelve la lista vacía', async () => {
    await crearViaje(carlos, { estado: 'FINALIZADO' });

    const res = await listar(tokenCarlos, '?estado=ACTIVO');

    expect(res.body).toEqual({ items: [], siguienteCursor: null, total: 0 });
  });

  it.each([
    ['estado=ENTREGADO', 'estado desconocido'],
    ['estado=finalizado', 'estado en minúsculas'],
    ['desde=01/10/2026', 'fecha con otro formato'],
    ['hasta=2026-13-40', 'fecha inexistente'],
    ['desde=2026-02-30', 'día que no existe'],
    ['desde=2026-10-10&hasta=2026-10-01', 'rango invertido'],
    ["estado=ACTIVO'%20OR%20'1'='1", 'intento de inyección en estado'],
    ["desde=2026-10-01';DROP%20TABLE%20viajes;--", 'intento de inyección en fecha'],
  ])('CA 5: rechaza %s (%s)', async (consulta) => {
    await crearViaje(carlos);

    const res = await listar(tokenCarlos, `?${consulta}`);

    expect(res.status).toBe(422);
    expect(res.body.codigo).toBe('DATOS_INVALIDOS');
    expect((await listar(tokenCarlos)).body.total).toBe(1);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Detalle del viaje', () => {
  it('CA 6: devuelve estado, origen, destino, flete, fechas, manifiesto y gastos de ruta', async () => {
    const id = await crearViaje(carlos, {
      estado: 'FINALIZADO',
      origen: 'Bogotá',
      destino: 'Cali',
      valorFlete: 3_200_000,
      fechaInicio: '2026-10-10T08:00:00Z',
      fechaEntrega: '2026-10-11T20:30:00Z',
      remolqueId: remolque,
    });
    await crearManifiesto(id);
    await crearGasto(id, 'COMBUSTIBLE', 300_000, 'combustible', 2);
    await crearGasto(id, 'PEAJE', 45_000.5, 'peaje', 1);

    const res = await detalle(tokenCarlos, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      id,
      estado: 'FINALIZADO',
      origen: 'Bogotá',
      destino: 'Cali',
      valorFlete: 3_200_000,
      fechaInicio: '2026-10-10T08:00:00.000Z',
      fechaEntrega: '2026-10-11T20:30:00.000Z',
      placaVehiculo: 'TKM482',
      placaRemolque: 'S12345',
      manifiesto: {
        numeroManifiesto: 'MAN-0001',
        urlImagen: 'https://archivos.sgl.test/manifiestos/man-0001.jpg',
        tipoMime: 'image/jpeg',
        fechaCarga: '2026-10-10T12:00:00.000Z',
      },
      totalGastos: 345_000.5,
    });
    // Los gastos salen en el orden en que se registraron.
    expect(res.body.gastos.map((g: { tipo: string }) => g.tipo)).toEqual(['PEAJE', 'COMBUSTIBLE']);
    expect(res.body.gastos[0]).toMatchObject({
      tipo: 'PEAJE',
      monto: 45_000.5,
      concepto: 'peaje',
      urlSoporte: 'https://archivos.sgl.test/soportes/peaje.jpg',
    });
  });

  it('CA 6: un viaje sin manifiesto, sin gastos y sin remolque se muestra con esos campos vacíos', async () => {
    const id = await crearViaje(carlos, { estado: 'ACTIVO' });

    const res = await detalle(tokenCarlos, id);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      estado: 'ACTIVO',
      fechaEntrega: null,
      placaRemolque: null,
      manifiesto: null,
      gastos: [],
      totalGastos: 0,
    });
  });

  it('CA 6: el total de gastos no acumula errores de decimales', async () => {
    const id = await crearViaje(carlos);
    await crearGasto(id, 'PEAJE', 0.1, 'a', 1);
    await crearGasto(id, 'PEAJE', 0.2, 'b', 2);

    expect((await detalle(tokenCarlos, id)).body.totalGastos).toBe(0.3);
  });

  it('CA 6: el detalle es de solo lectura: no existen rutas para crear, editar ni eliminar', async () => {
    const id = await crearViaje(carlos);
    await crearGasto(id, 'PEAJE', 1000, 'peaje', 1);

    const intentos = [
      request(app).post(ENDPOINT).set(auth(tokenCarlos)).send({ origen: 'X', destino: 'Y' }),
      request(app).put(`${ENDPOINT}/${id}`).set(auth(tokenCarlos)).send({ origen: 'X' }),
      request(app).patch(`${ENDPOINT}/${id}`).set(auth(tokenCarlos)).send({ origen: 'X' }),
      request(app).delete(`${ENDPOINT}/${id}`).set(auth(tokenCarlos)),
      request(app).delete(ENDPOINT).set(auth(tokenCarlos)),
    ];
    for (const res of await Promise.all(intentos)) {
      expect(res.status).toBe(404);
    }

    const { rows } = await pool.query('SELECT origen FROM viajes WHERE id = $1', [id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].origen).not.toBe('X');
    expect((await pool.query('SELECT 1 FROM gastos_ruta WHERE viaje_id = $1', [id])).rowCount).toBe(1);
  });
});

// -------------------------------------------------------------------------------------------------
describe('Seguridad', () => {
  it('CA 8: un viaje de otro conductor responde igual que uno inexistente y no revela nada', async () => {
    const ajeno = await crearViaje(ana, { origen: 'Origen secreto', destino: 'Destino secreto', valorFlete: 777_000 });
    await crearManifiesto(ajeno);
    await crearGasto(ajeno, 'PEAJE', 123_456, 'gasto-secreto', 1);

    const resAjeno = await detalle(tokenCarlos, ajeno);
    const resInexistente = await detalle(tokenCarlos, '3f2b8c1e-0b0e-4f55-9a55-0d6f6a3c9a11');

    expect(resAjeno.status).toBe(404);
    expect(resAjeno.body).toEqual({ codigo: 'VIAJE_NO_ENCONTRADO', mensaje: 'El viaje no existe.' });
    expect(resAjeno.body).toEqual(resInexistente.body);
    expect(resAjeno.status).toBe(resInexistente.status);
    const texto = JSON.stringify(resAjeno.body) + JSON.stringify(resAjeno.headers);
    for (const secreto of ['secreto', '777', 'MAN-0001', '123456', ajeno.slice(0, 8) + '-']) {
      expect(texto).not.toContain(secreto);
    }
  });

  it('CA 8: el dueño sí ve su viaje y el otro conductor sigue recibiendo 404 (validado con distintos usuarios)', async () => {
    const deAna = await crearViaje(ana);
    const deCarlos = await crearViaje(carlos);

    expect((await detalle(tokenAna, deAna)).status).toBe(200);
    expect((await detalle(tokenCarlos, deCarlos)).status).toBe(200);
    expect((await detalle(tokenCarlos, deAna)).status).toBe(404);
    expect((await detalle(tokenAna, deCarlos)).status).toBe(404);
  });

  it.each(['abc', '123', 'no-es-un-uuid', '00000000-0000-0000-0000-000000000000', "1'%20OR%20'1'='1"])(
    'CA 8: el identificador "%s" responde 404 sin error técnico',
    async (id) => {
      const res = await request(app).get(`${ENDPOINT}/${id}`).set(auth(tokenCarlos));

      expect(res.status).toBe(404);
      expect(res.body.codigo).toBe('VIAJE_NO_ENCONTRADO');
    },
  );

  it('CA 8: no existe una ruta para consultar el historial de otro conductor por su identificador', async () => {
    await crearViaje(ana);

    for (const ruta of [`/api/conductores/${ana}/viajes`, `/api/viajes?conductorId=${ana}`, `/api/conductores/${ana}/viajes/x`]) {
      const res = await request(app).get(ruta).set(auth(tokenCarlos));
      expect(res.status, ruta).toBe(404);
    }
  });

  it('exige sesión: sin token o con token inválido responde 401', async () => {
    const id = await crearViaje(carlos);

    expect((await request(app).get(ENDPOINT)).status).toBe(401);
    expect((await request(app).get(`${ENDPOINT}/${id}`)).status).toBe(401);
    expect((await listar('token-falso')).status).toBe(401);
  });

  it('solo el rol CONDUCTOR consulta este historial: Administrador y Contador reciben 403', async () => {
    const id = await crearViaje(carlos);

    for (const token of [tokenAdmin, tokenContador]) {
      const lista = await listar(token);
      const uno = await detalle(token, id);
      expect(lista.status).toBe(403);
      expect(lista.body.codigo).toBe('ACCESO_DENEGADO');
      expect(uno.status).toBe(403);
      expect(JSON.stringify(uno.body)).not.toContain('Origen');
    }
  });

  it('un conductor desactivado después de iniciar sesión pierde el acceso al historial', async () => {
    await crearViaje(inactivo);

    const res = await listar(tokenInactivo);

    expect(res.status).toBe(401);
    expect(res.body.codigo).toBe('CUENTA_INACTIVA');
  });

  it('las respuestas no se guardan en cachés compartidas ni del navegador (Cache-Control: private, no-store)', async () => {
    const id = await crearViaje(carlos);

    for (const res of [await listar(tokenCarlos), await detalle(tokenCarlos, id), await detalle(tokenCarlos, 'abc'), await listar('falso')]) {
      expect(res.headers['cache-control']).toBe('private, no-store');
    }
  });
});
