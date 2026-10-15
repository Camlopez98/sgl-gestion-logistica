import { AppError } from '../../shared/errors/app-error';
import { formatoPlaca, placaCumpleFormato } from './placa';
import { vehiculoTieneViajeActivo } from './viajes-activos';
import * as vehiculosRepository from './vehiculos.repository';
import type { Vehiculo } from './vehiculos.repository';
import type { DatosVehiculo, FiltrosVehiculos } from './vehiculos.schemas';

const RESTRICCION_PLACA_UNICA = 'uq_vehiculos_placa';
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function registrar(datos: DatosVehiculo): Promise<Vehiculo> {
  validarPlaca(datos);
  await verificarPlacaDisponible(datos.placa);

  try {
    return await vehiculosRepository.crear(datos);
  } catch (error) {
    // Dos solicitudes simultáneas con la misma placa: la restricción UNIQUE rechaza la segunda (CA 10).
    throw traducirPlacaDuplicada(error, datos.placa);
  }
}

export function listar(filtros: FiltrosVehiculos): Promise<Vehiculo[]> {
  return vehiculosRepository.listar(filtros);
}

export async function obtener(id: string): Promise<Vehiculo> {
  const vehiculo = PATRON_UUID.test(id) ? await vehiculosRepository.buscarPorId(id) : null;
  if (!vehiculo) {
    throw errorNoEncontrado();
  }
  return vehiculo;
}

/** HU-03, escenario 5: al editar, la placa sigue siendo única y válida para su tipo. */
export async function editar(id: string, datos: DatosVehiculo): Promise<Vehiculo> {
  await obtener(id);
  validarPlaca(datos);
  await verificarPlacaDisponible(datos.placa, id);

  try {
    const actualizado = await vehiculosRepository.actualizar(id, datos);
    if (!actualizado) throw errorNoEncontrado();
    return actualizado;
  } catch (error) {
    throw traducirPlacaDuplicada(error, datos.placa);
  }
}

/**
 * HU-03, escenarios 6 y 7: la desactivación es lógica (el vehículo permanece en el histórico)
 * y se rechaza si el vehículo está en un viaje ACTIVO. Desactivar uno ya inactivo no es un error,
 * para que un reintento obtenga el mismo resultado.
 */
export async function desactivar(id: string): Promise<Vehiculo> {
  const vehiculo = await obtener(id);
  if (vehiculo.estado === 'INACTIVO') {
    return vehiculo;
  }

  if (await vehiculoTieneViajeActivo(id)) {
    throw new AppError(
      409,
      'VEHICULO_EN_VIAJE_ACTIVO',
      `El vehículo ${vehiculo.placa} está en un viaje activo y no se puede desactivar.`,
    );
  }

  const desactivado = await vehiculosRepository.cambiarEstado(id, 'INACTIVO');
  if (!desactivado) throw errorNoEncontrado();
  return desactivado;
}

/** HU-03, escenario 3: la placa debe cumplir el formato legal de su tipo. */
function validarPlaca(datos: DatosVehiculo): void {
  if (!placaCumpleFormato(datos.placa, datos.tipo)) {
    throw new AppError(
      422,
      'PLACA_FORMATO_INVALIDO',
      `La placa ${datos.placa} no corresponde a un ${datos.tipo}. Formato esperado: ${formatoPlaca(datos.tipo).descripcion}.`,
    );
  }
}

/** HU-03, escenarios 2 y 5: la placa no puede pertenecer a otro vehículo. */
async function verificarPlacaDisponible(placa: string, excluirId?: string): Promise<void> {
  if (await vehiculosRepository.buscarPorPlaca(placa, excluirId)) {
    throw errorPlacaDuplicada(placa);
  }
}

function errorNoEncontrado(): AppError {
  return new AppError(404, 'VEHICULO_NO_ENCONTRADO', 'El vehículo no existe.');
}

function errorPlacaDuplicada(placa: string): AppError {
  return new AppError(409, 'PLACA_DUPLICADA', `La placa ${placa} ya está registrada.`);
}

function traducirPlacaDuplicada(error: unknown, placa: string): unknown {
  const restriccion = (error as { constraint?: string } | null)?.constraint;
  return restriccion === RESTRICCION_PLACA_UNICA ? errorPlacaDuplicada(placa) : error;
}
