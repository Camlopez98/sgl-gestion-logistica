import { diaDeCalendarioColombia, formatearFecha, formatearFechaHora, formatearMoneda } from './formato';

describe('formato del historial', () => {
  it('muestra el valor en pesos colombianos con separador de miles', () => {
    expect(formatearMoneda(3_200_000)).toMatch(/3\.200\.000/);
    expect(formatearMoneda(3_200_000)).toContain('$');
  });

  it('conserva los centavos cuando existen', () => {
    expect(formatearMoneda(45_000.5)).toMatch(/45\.000,5/);
  });

  it('muestra las fechas en hora de Colombia (UTC-5)', () => {
    // 13:00 UTC son las 8:00 a. m. en Colombia.
    expect(formatearFechaHora('2026-10-10T13:00:00Z')).toMatch(/8:00/);
    expect(formatearFecha('2026-10-10T13:00:00Z')).toMatch(/10/);
  });

  it('calcula el día de calendario en hora de Colombia', () => {
    expect(diaDeCalendarioColombia('2026-10-06T04:59:59Z')).toBe('2026-10-05');
    expect(diaDeCalendarioColombia('2026-10-06T05:00:00Z')).toBe('2026-10-06');
    expect(diaDeCalendarioColombia('2026-10-01T04:59:59Z')).toBe('2026-09-30');
  });
});
