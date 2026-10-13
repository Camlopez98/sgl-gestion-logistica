import { HttpErrorResponse } from '@angular/common/http';
import { TimeoutError } from 'rxjs';
import {
  MENSAJE_ERROR_SERVIDOR,
  MENSAJE_SERVIDOR_NO_RESPONDE,
  MENSAJE_SIN_INTERNET,
  codigoDeError,
  mensajeDeError,
} from './mensaje-error';

describe('mensajeDeError', () => {
  afterEach(() => vi.restoreAllMocks());

  it('CA 14: informa que no hay conexión a internet', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toBe(MENSAJE_SIN_INTERNET);
  });

  it('CA 15: informa que el servidor no responde', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    expect(mensajeDeError(new HttpErrorResponse({ status: 0 }))).toBe(MENSAJE_SERVIDOR_NO_RESPONDE);
    expect(mensajeDeError(new TimeoutError())).toBe(MENSAJE_SERVIDOR_NO_RESPONDE);
  });

  it('CA 15: informa un error del servidor sin detalles técnicos', () => {
    const error = new HttpErrorResponse({ status: 500, error: { codigo: 'ERROR_INTERNO', mensaje: 'x' } });
    expect(mensajeDeError(error)).toBe(MENSAJE_ERROR_SERVIDOR);
  });

  it('usa el mensaje del formato común del backend', () => {
    const error = new HttpErrorResponse({ status: 409, error: { codigo: 'PLACA_DUPLICADA', mensaje: 'La placa ya existe.' } });
    expect(mensajeDeError(error)).toBe('La placa ya existe.');
    expect(codigoDeError(error)).toBe('PLACA_DUPLICADA');
  });
});
