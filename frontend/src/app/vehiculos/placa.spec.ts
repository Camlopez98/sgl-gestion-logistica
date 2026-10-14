import { FormControl, FormGroup } from '@angular/forms';
import { normalizarPlaca, placaSegunTipo } from './placa';

describe('placa', () => {
  it.each([
    ['tkm-482', 'TKM482'],
    [' tkm 482 ', 'TKM482'],
    ['r-12345', 'R12345'],
  ])('CA 4: normaliza "%s" como %s', (entrada, esperada) => {
    expect(normalizarPlaca(entrada)).toBe(esperada);
  });

  function grupo(placa: string, tipo: string) {
    return new FormGroup(
      { placa: new FormControl(placa), tipo: new FormControl(tipo) },
      { validators: placaSegunTipo() },
    );
  }

  it.each([
    ['TKM482', 'TRACTOCAMION'],
    ['tkm-482', 'CAMION'],
    ['FUR123', 'FURGON'],
    ['R12345', 'REMOLQUE'],
    ['S12345', 'SEMIRREMOLQUE'],
  ])('acepta %s como %s', (placa, tipo) => {
    expect(grupo(placa, tipo).controls.placa.valid).toBe(true);
  });

  it('CA 3: rechaza R12345 como tractocamión e indica el formato esperado', () => {
    const errores = grupo('R12345', 'TRACTOCAMION').controls.placa.errors;
    expect(errores).toEqual({ placaFormato: { ejemplo: 'TKM482', descripcion: '3 letras y 3 números' } });
  });

  it('revalida al cambiar el tipo', () => {
    const formulario = grupo('R12345', 'REMOLQUE');
    expect(formulario.controls.placa.valid).toBe(true);

    formulario.controls.tipo.setValue('SEMIRREMOLQUE');
    expect(formulario.controls.placa.hasError('placaFormato')).toBe(true);
  });
});
