import type { DetalleDeViaje, ViajeDeLista } from './viaje.model';

/**
 * Almacenamiento local del historial para consultarlo sin conexión (HU-05, CA 10 a 13).
 *
 * Estrategia: localStorage, una entrada por usuario (`sgl.historial.<id del usuario>`). Se guarda la última
 * lista sin filtros y los últimos detalles abiertos. Se borra todo al cerrar o descartar la sesión
 * (AuthService.descartarSesion), y una entrada solo se lee si pertenece al usuario de la sesión (CA 9).
 *
 * Este archivo no depende de Angular para que AuthService pueda borrar los datos sin ciclos de importación.
 */
export const PREFIJO_ALMACEN = 'sgl.historial.';

export interface ListaGuardada {
  /** Momento en que se guardó: es la "última actualización" que ve el conductor. */
  actualizadoEn: string;
  items: ViajeDeLista[];
  total: number;
  siguienteCursor: string | null;
}

export interface DetalleGuardado {
  actualizadoEn: string;
  detalle: DetalleDeViaje;
}

export interface AlmacenDeUsuario {
  usuarioId: string;
  lista: ListaGuardada | null;
  /** Del más reciente al más antiguo. */
  detalles: DetalleGuardado[];
}

export function leerAlmacen(usuarioId: string): AlmacenDeUsuario | null {
  const clave = PREFIJO_ALMACEN + usuarioId;
  try {
    const texto = localStorage.getItem(clave);
    if (!texto) return null;
    const almacen = JSON.parse(texto) as Partial<AlmacenDeUsuario> | null;
    if (almacen?.usuarioId !== usuarioId || !Array.isArray(almacen.detalles)) {
      localStorage.removeItem(clave);
      return null;
    }
    return almacen as AlmacenDeUsuario;
  } catch {
    return null;
  }
}

export function escribirAlmacen(almacen: AlmacenDeUsuario): void {
  try {
    localStorage.setItem(PREFIJO_ALMACEN + almacen.usuarioId, JSON.stringify(almacen));
  } catch {
    // Sin almacenamiento o sin espacio: el historial sigue funcionando, solo que sin copia sin conexión.
  }
}

/** Borra los datos guardados de todos los usuarios de este dispositivo. */
export function borrarDatosGuardados(): void {
  borrarClaves(() => true);
}

/** Borra los datos de cualquier usuario distinto al indicado (sesión anterior que no se cerró bien). */
export function borrarDatosDeOtrosUsuarios(usuarioId: string): void {
  borrarClaves((clave) => clave !== PREFIJO_ALMACEN + usuarioId);
}

function borrarClaves(debeBorrar: (clave: string) => boolean): void {
  try {
    const claves: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const clave = localStorage.key(i);
      if (clave?.startsWith(PREFIJO_ALMACEN) && debeBorrar(clave)) claves.push(clave);
    }
    for (const clave of claves) localStorage.removeItem(clave);
  } catch {
    // Nada que borrar.
  }
}
