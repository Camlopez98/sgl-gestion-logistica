import { AppError } from '../../shared/errors/app-error';
import * as historialRepository from './historial.repository';
import type { GastoDeViaje, ManifiestoDeViaje, PosicionCursor, ViajeDeLista, ViajeDetalle } from './historial.repository';
import type { FiltrosHistorial } from './historial.schemas';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MARCA_DE_CURSOR = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

export type ViajeDeHistorial = Omit<ViajeDeLista, 'marcaCursor'>;

export interface PaginaDeHistorial {
  items: ViajeDeHistorial[];
  /** Cursor para pedir el siguiente bloque; null cuando ya no hay más viajes. */
  siguienteCursor: string | null;
  /** Viajes del conductor que cumplen los filtros, sin contar el cursor. */
  total: number;
}

export interface DetalleDeViaje extends ViajeDetalle {
  manifiesto: ManifiestoDeViaje | null;
  gastos: GastoDeViaje[];
  totalGastos: number;
}

/**
 * HU-05, CA 1 a 5. El conductor siempre viene de la sesión: ningún dato del cliente puede
 * apuntar al historial de otra persona.
 */
export async function listar(conductorId: string, filtros: FiltrosHistorial): Promise<PaginaDeHistorial> {
  const cursor = filtros.cursor ? decodificarCursor(filtros.cursor) : null;

  // Se pide uno de más: si llega, hay otro bloque y el último de la página marca dónde seguir.
  const [filas, total] = await Promise.all([
    historialRepository.listar(conductorId, filtros, cursor, filtros.limite + 1),
    historialRepository.contar(conductorId, filtros),
  ]);

  const hayMas = filas.length > filtros.limite;
  const pagina = hayMas ? filas.slice(0, filtros.limite) : filas;
  const ultimo = pagina.at(-1);

  return {
    items: pagina.map(({ marcaCursor: _marca, ...viaje }) => viaje),
    siguienteCursor: hayMas && ultimo ? codificarCursor({ marca: ultimo.marcaCursor, id: ultimo.id }) : null,
    total,
  };
}

/** HU-05, CA 6 y 8: el detalle de un viaje ajeno responde igual que uno inexistente. */
export async function detalle(conductorId: string, viajeId: string): Promise<DetalleDeViaje> {
  const viaje = UUID.test(viajeId) ? await historialRepository.buscarDeConductor(conductorId, viajeId) : null;
  if (!viaje) {
    throw new AppError(404, 'VIAJE_NO_ENCONTRADO', 'El viaje no existe.');
  }

  const [manifiesto, gastos] = await Promise.all([
    historialRepository.manifiestoDelViaje(viaje.id),
    historialRepository.gastosDelViaje(viaje.id),
  ]);
  const totalCentavos = gastos.reduce((suma, gasto) => suma + Math.round(gasto.monto * 100), 0);

  return { ...viaje, manifiesto, gastos, totalGastos: totalCentavos / 100 };
}

function codificarCursor(posicion: PosicionCursor): string {
  return Buffer.from(JSON.stringify({ f: posicion.marca, i: posicion.id })).toString('base64url');
}

function decodificarCursor(cursor: string): PosicionCursor {
  try {
    const { f, i } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { f?: unknown; i?: unknown };
    if (typeof f === 'string' && typeof i === 'string' && MARCA_DE_CURSOR.test(f) && UUID.test(i)) {
      return { marca: f, id: i };
    }
  } catch {
    // Se informa abajo como cursor inválido.
  }
  throw new AppError(422, 'CURSOR_INVALIDO', 'El cursor de paginación no es válido. Cargue el historial desde el inicio.');
}
