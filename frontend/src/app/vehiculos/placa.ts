import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { TipoVehiculo } from './vehiculo.model';

interface FormatoPlaca {
  patron: RegExp;
  descripcion: string;
  ejemplo: string;
}

const AUTOMOTOR: FormatoPlaca = { patron: /^[A-Z]{3}[0-9]{3}$/, descripcion: '3 letras y 3 números', ejemplo: 'TKM482' };

/** Formato legal de placa por tipo (mismas reglas que valida el servidor, HU-03). */
const FORMATO_POR_TIPO: Record<TipoVehiculo, FormatoPlaca> = {
  FURGON: AUTOMOTOR,
  CAMION: AUTOMOTOR,
  TRACTOCAMION: AUTOMOTOR,
  REMOLQUE: { patron: /^R[0-9]{5}$/, descripcion: 'R y 5 números', ejemplo: 'R12345' },
  SEMIRREMOLQUE: { patron: /^S[0-9]{5}$/, descripcion: 'S y 5 números', ejemplo: 'S12345' },
};

/** Mayúsculas y sin espacios ni guiones: "tkm-482" → "TKM482". */
export function normalizarPlaca(placa: string): string {
  return placa.toUpperCase().replace(/[\s-]/g, '');
}

export function formatoPlaca(tipo: TipoVehiculo): FormatoPlaca {
  return FORMATO_POR_TIPO[tipo];
}

/**
 * Validador de grupo: la placa (normalizada) debe cumplir el formato del tipo seleccionado.
 * El error queda en el control "placa" como { placaFormato: { ejemplo, descripcion } }.
 */
export function placaSegunTipo(campoPlaca = 'placa', campoTipo = 'tipo'): ValidatorFn {
  return (grupo: AbstractControl): ValidationErrors | null => {
    const controlPlaca = grupo.get(campoPlaca);
    const tipo = grupo.get(campoTipo)?.value as TipoVehiculo | '' | null;
    if (!controlPlaca) return null;

    const placa = normalizarPlaca(String(controlPlaca.value ?? ''));
    const { placaFormato: _anterior, ...otrosErrores } = controlPlaca.errors ?? {};
    const formato = tipo ? FORMATO_POR_TIPO[tipo] : null;
    const invalida = !!placa && !!formato && !formato.patron.test(placa);

    const errores = invalida
      ? { ...otrosErrores, placaFormato: { ejemplo: formato!.ejemplo, descripcion: formato!.descripcion } }
      : otrosErrores;
    controlPlaca.setErrors(Object.keys(errores).length ? errores : null);
    return null;
  };
}
