/**
 * HU-03, escenario 7: un vehículo en un viaje ACTIVO no se puede desactivar.
 *
 * La tabla de viajes pertenece a la historia de registro de viajes y todavía no existe.
 * Para no depender de ese módulo, vehículos pregunta a través de esta función y el módulo
 * de viajes registra su consulta al cargarse:
 *
 *   registrarConsultaViajeActivo((vehiculoId) => viajesRepository.vehiculoTieneViajeActivo(vehiculoId));
 *
 * PENDIENTE: mientras ningún módulo la registre, se asume que no hay viajes activos.
 */
export type ConsultaViajeActivo = (vehiculoId: string) => Promise<boolean>;

const sinViajesRegistrados: ConsultaViajeActivo = async () => false;

let consulta: ConsultaViajeActivo = sinViajesRegistrados;

export function registrarConsultaViajeActivo(nuevaConsulta: ConsultaViajeActivo): void {
  consulta = nuevaConsulta;
}

/** Restaura la consulta por defecto (uso en pruebas). */
export function restablecerConsultaViajeActivo(): void {
  consulta = sinViajesRegistrados;
}

export function vehiculoTieneViajeActivo(vehiculoId: string): Promise<boolean> {
  return consulta(vehiculoId);
}
