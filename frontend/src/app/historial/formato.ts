/** Las fechas se muestran y se filtran en hora de Colombia, que es la de la operación. */
const ZONA_HORARIA = 'America/Bogota';

const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const fechaHora = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: ZONA_HORARIA });
const soloFecha = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: ZONA_HORARIA });
const diaDeCalendario = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_HORARIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function formatearMoneda(valor: number): string {
  return moneda.format(valor);
}

/** "10 oct 2026, 8:00 a. m." */
export function formatearFechaHora(fecha: string | Date): string {
  return fechaHora.format(new Date(fecha));
}

/** "10 oct 2026" */
export function formatearFecha(fecha: string | Date): string {
  return soloFecha.format(new Date(fecha));
}

/** Día de calendario en hora de Colombia como AAAA-MM-DD (para filtrar datos guardados). */
export function diaDeCalendarioColombia(fecha: string | Date): string {
  return diaDeCalendario.format(new Date(fecha));
}
