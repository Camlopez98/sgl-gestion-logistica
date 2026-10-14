/**
 * HU-04, criterios 5 y 9 (invariante 3): no se cambia ni se finaliza la asignación activa
 * de un conductor que tiene un viaje ACTIVO.
 *
 * La tabla de viajes pertenece a la historia de registro de viajes y todavía no existe.
 * Para no depender de ese módulo, asignaciones pregunta a través de esta función y el módulo
 * de viajes registra su consulta al cargarse (mismo patrón de `vehiculos/viajes-activos.ts`):
 *
 *   registrarConsultaViajeActivoDeConductor((conductorId) => viajesRepository.conductorTieneViajeActivo(conductorId));
 *
 * PENDIENTE: mientras ningún módulo la registre, se asume que no hay viajes activos.
 */
export type ConsultaViajeActivoDeConductor = (conductorId: string) => Promise<boolean>;

const sinViajesRegistrados: ConsultaViajeActivoDeConductor = async () => false;

let consulta: ConsultaViajeActivoDeConductor = sinViajesRegistrados;

export function registrarConsultaViajeActivoDeConductor(nuevaConsulta: ConsultaViajeActivoDeConductor): void {
  consulta = nuevaConsulta;
}

/** Restaura la consulta por defecto (uso en pruebas). */
export function restablecerConsultaViajeActivoDeConductor(): void {
  consulta = sinViajesRegistrados;
}

export function conductorTieneViajeActivo(conductorId: string): Promise<boolean> {
  return consulta(conductorId);
}
