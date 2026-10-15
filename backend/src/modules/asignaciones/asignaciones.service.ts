import type { PoolClient } from 'pg';
import { enTransaccion } from '../../db/transaccion';
import { AppError } from '../../shared/errors/app-error';
import type { TipoVehiculo } from '../vehiculos/placa';
import * as vehiculosRepository from '../vehiculos/vehiculos.repository';
import * as asignacionesRepository from './asignaciones.repository';
import type { Asignacion, AsignacionDeHistorial, ConductorHabilitable } from './asignaciones.repository';
import type { DatosActivar, DatosFinalizar, DatosHabilitar, FiltrosAsignaciones } from './asignaciones.schemas';
import { conductorTieneViajeActivo } from './viajes-conductor';

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo se habilitan vehículos automotores; el remolque se acopla al activar. */
const AUTOMOTORES: readonly TipoVehiculo[] = ['FURGON', 'CAMION', 'TRACTOCAMION'];

/** Qué admite acoplar cada automotor: el camión, remolque; el tractocamión, semirremolque. */
const ACOPLE_ADMITIDO: Partial<Record<TipoVehiculo, TipoVehiculo>> = {
  CAMION: 'REMOLQUE',
  TRACTOCAMION: 'SEMIRREMOLQUE',
};

const NOMBRE_TIPO: Record<TipoVehiculo, string> = {
  FURGON: 'furgón',
  CAMION: 'camión',
  TRACTOCAMION: 'tractocamión',
  REMOLQUE: 'remolque',
  SEMIRREMOLQUE: 'semirremolque',
};

/** Restricciones únicas de la migración y el conflicto de negocio que representan. */
const RESTRICCION_VIGENTE = 'uq_asignaciones_vigente_conductor_vehiculo';
const RESTRICCION_ACTIVA_CONDUCTOR = 'uq_asignaciones_activa_conductor';
const RESTRICCION_ACTIVA_VEHICULO = 'uq_asignaciones_activa_vehiculo';
const RESTRICCION_ACTIVA_REMOLQUE = 'uq_asignaciones_activa_remolque';

// ---------------------------------------------------------------------------------------------
// Habilitación (CA 1, 2, 3)
// ---------------------------------------------------------------------------------------------

export async function habilitar(datos: DatosHabilitar): Promise<Asignacion> {
  try {
    return await enTransaccion(async (cliente) => {
      const conductor = await asignacionesRepository.buscarConductor(datos.conductorId, cliente);
      if (!conductor) {
        throw new AppError(404, 'CONDUCTOR_NO_ENCONTRADO', 'El conductor no existe.');
      }
      if (!conductor.estadoActivo) {
        throw new AppError(422, 'CONDUCTOR_INACTIVO', `El conductor ${conductor.nombreCompleto} está inactivo y no se le pueden habilitar vehículos.`);
      }

      const vehiculo = await asignacionesRepository.buscarVehiculo(datos.vehiculoId, cliente);
      if (!vehiculo) {
        throw errorVehiculoNoEncontrado();
      }
      if (vehiculo.estado !== 'ACTIVO') {
        throw errorVehiculoInactivo(vehiculo.placa);
      }
      if (!AUTOMOTORES.includes(vehiculo.tipo)) {
        throw new AppError(
          422,
          'VEHICULO_NO_HABILITABLE',
          `Un ${NOMBRE_TIPO[vehiculo.tipo]} no se habilita a un conductor: se acopla a un camión o tractocamión al activarlo.`,
        );
      }

      if (await asignacionesRepository.existeVigente(conductor.id, vehiculo.id, cliente)) {
        throw errorAsignacionDuplicada(conductor, vehiculo.placa);
      }
      // Si dos solicitudes iguales llegan a la vez, ambas pasan esta verificación y el índice único rechaza la segunda.

      const id = await asignacionesRepository.insertar(conductor.id, vehiculo.id, cliente);
      return await obtenerEnTransaccion(id, cliente);
    });
  } catch (error) {
    // Dos solicitudes simultáneas iguales: el índice único rechaza la segunda (CA 2 y 17).
    if (restriccionDe(error) === RESTRICCION_VIGENTE) {
      const conductor = await asignacionesRepository.buscarConductor(datos.conductorId);
      const vehiculo = await vehiculosRepository.buscarPorId(datos.vehiculoId);
      throw errorAsignacionDuplicada(conductor, vehiculo?.placa ?? null);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------------------------
// Activación (CA 7 a 12, 18, 19)
// ---------------------------------------------------------------------------------------------

/**
 * Activa la asignación para el viaje actual, con su remolque o semirremolque si aplica.
 * La asignación que el conductor tenía activa vuelve a HABILITADA. Todo ocurre en una transacción:
 * o se aplican todos los cambios o ninguno.
 */
export async function activar(id: string, datos: DatosActivar): Promise<Asignacion> {
  try {
    return await enTransaccion(async (cliente) => {
      const asignacion = await bloquearAsignacion(id, cliente);
      if (asignacion.estado === 'FINALIZADA') {
        throw errorAsignacionFinalizada();
      }
      exigirVersion(asignacion, datos.version);

      const conductor = await asignacionesRepository.buscarConductor(asignacion.conductorId, cliente);
      if (!conductor?.estadoActivo) {
        throw new AppError(422, 'CONDUCTOR_INACTIVO', `El conductor ${asignacion.conductorNombre} está inactivo y no se le pueden activar vehículos.`);
      }

      const vehiculo = await asignacionesRepository.buscarVehiculo(asignacion.vehiculoId, cliente);
      if (!vehiculo || vehiculo.estado !== 'ACTIVO') {
        throw errorVehiculoInactivo(asignacion.vehiculoPlaca);
      }

      const remolqueId = datos.idRemolque ?? null;
      if (remolqueId) {
        await validarAcople(vehiculo.tipo, vehiculo.placa, remolqueId, cliente);
      }

      // Repetir la misma activación (por ejemplo, un reintento) no cambia nada.
      if (asignacion.estado === 'ACTIVA' && asignacion.remolqueId === remolqueId) {
        return asignacion;
      }

      // Invariante 3 (CA 9): con un viaje activo no se cambia el vehículo ni el acople del conductor.
      const activaDelConductor = await buscarActivaDelConductor(asignacion.conductorId, cliente);
      if (activaDelConductor && (await conductorTieneViajeActivo(asignacion.conductorId))) {
        throw errorViajeActivo(
          'El conductor tiene un viaje activo: no se puede cambiar su vehículo hasta que el viaje se reporte como entregado.',
        );
      }

      // Invariante 2 (CA 8 y 12): el vehículo y el remolque están en máximo una asignación activa.
      await exigirDisponibles(asignacion, remolqueId, cliente);

      // Invariante 1 (CA 7): la asignación activa anterior del conductor vuelve a HABILITADA.
      if (activaDelConductor && activaDelConductor !== asignacion.id) {
        await asignacionesRepository.liberar(activaDelConductor, cliente);
      }
      await asignacionesRepository.activar(asignacion.id, remolqueId, cliente);

      return await obtenerEnTransaccion(asignacion.id, cliente);
    });
  } catch (error) {
    throw await traducirConflicto(error, id);
  }
}

// ---------------------------------------------------------------------------------------------
// Finalización (CA 4, 5)
// ---------------------------------------------------------------------------------------------

/**
 * Finaliza la asignación registrando su fecha de fin; el registro se conserva para el historial.
 * Finalizar una asignación ya finalizada devuelve el mismo resultado, para que un reintento no falle.
 */
export async function finalizar(id: string, datos: DatosFinalizar): Promise<Asignacion> {
  try {
    return await enTransaccion(async (cliente) => {
      const asignacion = await bloquearAsignacion(id, cliente);
      if (asignacion.estado === 'FINALIZADA') {
        return asignacion;
      }
      exigirVersion(asignacion, datos.version);

      // Invariante 3 (CA 5): la asignación activa con un viaje activo no se finaliza.
      if (asignacion.estado === 'ACTIVA' && (await conductorTieneViajeActivo(asignacion.conductorId))) {
        throw errorViajeActivo(
          `El conductor tiene un viaje activo con el vehículo ${asignacion.vehiculoPlaca}: no se puede finalizar la asignación hasta que el viaje se reporte como entregado.`,
        );
      }

      await asignacionesRepository.finalizar(asignacion.id, cliente);
      return await obtenerEnTransaccion(asignacion.id, cliente);
    });
  } catch (error) {
    throw await traducirConflicto(error, id);
  }
}

// ---------------------------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------------------------

export function listar(filtros: FiltrosAsignaciones): Promise<Asignacion[]> {
  return asignacionesRepository.listar(filtros);
}

export function conductoresActivos(): Promise<ConductorHabilitable[]> {
  return asignacionesRepository.conductoresActivos();
}

/** CA 6: conductores que han tenido el vehículo asignado, con sus fechas de inicio y fin. */
export async function historialDeVehiculo(vehiculoId: string): Promise<AsignacionDeHistorial[]> {
  const vehiculo = PATRON_UUID.test(vehiculoId) ? await vehiculosRepository.buscarPorId(vehiculoId) : null;
  if (!vehiculo) {
    throw errorVehiculoNoEncontrado();
  }
  return asignacionesRepository.historialDeVehiculo(vehiculoId);
}

// ---------------------------------------------------------------------------------------------
// Selector del conductor (CA 13, 14, 15)
// ---------------------------------------------------------------------------------------------

export interface VehiculoActivo {
  asignacionId: string;
  vehiculo: { id: string; placa: string; tipo: TipoVehiculo; marca: string; modelo: string };
  remolque: { id: string; placa: string; tipo: TipoVehiculo; marca: string; modelo: string } | null;
}

/**
 * CA 13: el único vehículo que el conductor puede seleccionar, con su remolque acoplado si lo tiene.
 * CA 14: sin vehículo activo (o con el vehículo desactivado) no puede iniciar un manifiesto.
 */
export async function vehiculoActivoDelConductor(conductorId: string): Promise<VehiculoActivo> {
  const activa = await asignacionesRepository.buscarActivaDeConductor(conductorId);
  if (!activa) {
    throw new AppError(
      404,
      'SIN_VEHICULO_ACTIVO',
      'Necesita un vehículo asignado para iniciar un manifiesto. Comuníquese con el administrador.',
    );
  }

  return {
    asignacionId: activa.asignacionId,
    vehiculo: {
      id: activa.vehiculoId,
      placa: activa.vehiculoPlaca,
      tipo: activa.vehiculoTipo,
      marca: activa.vehiculoMarca,
      modelo: activa.vehiculoModelo,
    },
    remolque:
      activa.remolqueId && activa.remolquePlaca && activa.remolqueTipo && activa.remolqueMarca && activa.remolqueModelo
        ? {
            id: activa.remolqueId,
            placa: activa.remolquePlaca,
            tipo: activa.remolqueTipo,
            marca: activa.remolqueMarca,
            modelo: activa.remolqueModelo,
          }
        : null,
  };
}

/**
 * CA 15 (RS-04): validación del servidor para el módulo de manifiestos. Un conductor solo puede
 * registrar un manifiesto con su vehículo activo y su remolque acoplado; cualquier otra combinación,
 * aunque la envíe directamente al servidor, se rechaza con un error de autorización (403).
 *
 *   await exigirVehiculoActivo(usuario.id, cuerpo.vehiculoId, cuerpo.remolqueId);
 */
export async function exigirVehiculoActivo(
  conductorId: string,
  vehiculoId: string,
  remolqueId?: string | null,
): Promise<void> {
  const activa = await asignacionesRepository.buscarActivaDeConductor(conductorId);
  if (!activa || activa.vehiculoId !== vehiculoId || activa.remolqueId !== (remolqueId ?? null)) {
    throw new AppError(
      403,
      'VEHICULO_NO_ACTIVADO',
      'El vehículo seleccionado no es su vehículo activo. Solo puede registrar manifiestos con el vehículo que el administrador le activó.',
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Apoyo
// ---------------------------------------------------------------------------------------------

/** Lee la asignación y bloquea las vigentes de su conductor para serializar los cambios (CA 18 y 19). */
async function bloquearAsignacion(id: string, cliente: PoolClient): Promise<Asignacion> {
  const previa = PATRON_UUID.test(id) ? await asignacionesRepository.buscarPorId(id, cliente) : null;
  if (!previa) {
    throw errorAsignacionNoEncontrada();
  }

  await asignacionesRepository.bloquearVigentesDelConductor(previa.conductorId, cliente);
  // Se vuelve a leer ya con el bloqueo: otro administrador pudo modificarla mientras esperábamos.
  return obtenerEnTransaccion(id, cliente);
}

async function obtenerEnTransaccion(id: string, cliente: PoolClient): Promise<Asignacion> {
  const asignacion = await asignacionesRepository.buscarPorId(id, cliente);
  if (!asignacion) {
    throw errorAsignacionNoEncontrada();
  }
  return asignacion;
}

/** CA 19: si la asignación cambió desde que el administrador la cargó, se rechaza el cambio. */
function exigirVersion(asignacion: Asignacion, versionEsperada: number | undefined): void {
  if (versionEsperada !== undefined && versionEsperada !== asignacion.version) {
    throw errorAsignacionModificada();
  }
}

/** CA 10, 11 y 12: el automotor solo admite el tipo de remolque que le corresponde y debe estar disponible. */
async function validarAcople(
  tipoAutomotor: TipoVehiculo,
  placaAutomotor: string,
  remolqueId: string,
  cliente: PoolClient,
): Promise<void> {
  const tipoAdmitido = ACOPLE_ADMITIDO[tipoAutomotor];
  if (!tipoAdmitido) {
    throw new AppError(422, 'ACOPLE_INCOMPATIBLE', `Un ${NOMBRE_TIPO[tipoAutomotor]} no admite remolque ni semirremolque.`);
  }

  const remolque = await asignacionesRepository.buscarVehiculo(remolqueId, cliente);
  if (!remolque) {
    throw new AppError(404, 'REMOLQUE_NO_ENCONTRADO', 'El remolque o semirremolque no existe.');
  }
  if (remolque.tipo !== tipoAdmitido) {
    throw new AppError(
      422,
      'ACOPLE_INCOMPATIBLE',
      `Un ${NOMBRE_TIPO[tipoAutomotor]} solo admite ${NOMBRE_TIPO[tipoAdmitido]}, no ${NOMBRE_TIPO[remolque.tipo]} (${placaAutomotor} y ${remolque.placa}).`,
    );
  }
  if (remolque.estado !== 'ACTIVO') {
    throw errorVehiculoInactivo(remolque.placa);
  }
}

/** Id de la asignación ACTIVA del conductor (si tiene una), ya bloqueada por la transacción. */
async function buscarActivaDelConductor(conductorId: string, cliente: PoolClient): Promise<string | null> {
  const { rows } = await cliente.query<{ id: string }>(
    `SELECT id FROM asignaciones_vehiculo WHERE conductor_id = $1 AND estado = 'ACTIVA'`,
    [conductorId],
  );
  return rows[0]?.id ?? null;
}

/**
 * Invariante 2: ningún otro conductor tiene activo el vehículo ni el remolque.
 * Si es el mismo conductor (su asignación activa anterior), el remolque se libera al cambiar.
 */
async function exigirDisponibles(asignacion: Asignacion, remolqueId: string | null, cliente: PoolClient): Promise<void> {
  const ids = remolqueId ? [asignacion.vehiculoId, remolqueId] : [asignacion.vehiculoId];
  const ocupantes = await asignacionesRepository.buscarActivasQueUsan(ids, cliente);

  for (const ocupante of ocupantes) {
    if (ocupante.conductorId === asignacion.conductorId) continue;
    if (ocupante.vehiculoId === asignacion.vehiculoId) {
      throw errorVehiculoActivoConOtro(asignacion.vehiculoPlaca, ocupante.conductorNombre);
    }
    throw errorRemolqueOcupado(ocupante.conductorNombre);
  }
}

function restriccionDe(error: unknown): string | undefined {
  return (error as { constraint?: string } | null)?.constraint;
}

/**
 * Dos administradores simultáneos pasan las verificaciones a la vez: el índice único de la base
 * deja pasar solo a la primera transacción y la segunda llega aquí (CA 18). Se traduce al mismo
 * conflicto de negocio que habría recibido si hubiera llegado después.
 */
async function traducirConflicto(error: unknown, asignacionId: string): Promise<unknown> {
  switch (restriccionDe(error)) {
    case RESTRICCION_ACTIVA_VEHICULO: {
      const asignacion = await asignacionesRepository.buscarPorId(asignacionId);
      const ocupantes = asignacion ? await asignacionesRepository.buscarActivasQueUsan([asignacion.vehiculoId]) : [];
      const otro = ocupantes.find((o) => o.conductorId !== asignacion?.conductorId && o.vehiculoId === asignacion?.vehiculoId);
      return errorVehiculoActivoConOtro(asignacion?.vehiculoPlaca ?? 'seleccionado', otro?.conductorNombre ?? 'otro conductor');
    }
    case RESTRICCION_ACTIVA_REMOLQUE:
      return errorRemolqueOcupado('otro conductor');
    case RESTRICCION_ACTIVA_CONDUCTOR:
      return errorAsignacionModificada();
    default:
      return error;
  }
}

function errorVehiculoNoEncontrado(): AppError {
  return new AppError(404, 'VEHICULO_NO_ENCONTRADO', 'El vehículo no existe.');
}

function errorVehiculoInactivo(placa: string): AppError {
  return new AppError(422, 'VEHICULO_INACTIVO', `El vehículo ${placa} está inactivo y no se puede habilitar ni activar.`);
}

function errorAsignacionNoEncontrada(): AppError {
  return new AppError(404, 'ASIGNACION_NO_ENCONTRADA', 'La asignación no existe.');
}

function errorAsignacionFinalizada(): AppError {
  return new AppError(409, 'ASIGNACION_FINALIZADA', 'La asignación está finalizada y no se puede activar. Habilite el vehículo de nuevo.');
}

function errorAsignacionDuplicada(conductor: ConductorHabilitable | null, placa: string | null): AppError {
  const vehiculo = placa ? `el vehículo ${placa}` : 'ese vehículo';
  const quien = conductor ? ` a ${conductor.nombreCompleto}` : ' a ese conductor';
  return new AppError(409, 'ASIGNACION_DUPLICADA', `Ya existe una asignación vigente de ${vehiculo}${quien}.`);
}

function errorAsignacionModificada(): AppError {
  return new AppError(
    409,
    'ASIGNACION_MODIFICADA',
    'La asignación fue modificada por otro administrador. Recargue la información e intente de nuevo.',
  );
}

function errorViajeActivo(mensaje: string): AppError {
  return new AppError(409, 'VIAJE_ACTIVO', mensaje);
}

function errorVehiculoActivoConOtro(placa: string, conductorNombre: string): AppError {
  return new AppError(
    409,
    'VEHICULO_ACTIVO_CON_OTRO_CONDUCTOR',
    `El vehículo ${placa} ya está activo con ${conductorNombre}.`,
  );
}

function errorRemolqueOcupado(conductorNombre: string): AppError {
  return new AppError(409, 'REMOLQUE_OCUPADO', `El remolque o semirremolque ya está acoplado en la asignación activa de ${conductorNombre}.`);
}
