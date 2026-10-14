import { env } from '../../config/env';
import { AppError } from '../../shared/errors/app-error';
import { firmarToken } from '../../shared/seguridad/token';
import type { Rol } from '../../shared/types/rol';
import * as usuarioRepository from '../usuarios/usuario.repository';
import * as bitacoraRepository from './bitacora.repository';
import type { MotivoIntentoFallido } from './bitacora.repository';
import type { DatosLogin } from './auth.schemas';
import { generarHash, verificarPassword } from './password';

export interface ContextoLogin {
  ip?: string;
  userAgent?: string;
}

export interface RespuestaLogin {
  token: string;
  expiraEn: number;
  usuario: { id: string; nombreCompleto: string; rol: Rol };
}

const MENSAJE_CREDENCIALES_INVALIDAS = 'Credenciales incorrectas, inténtelo de nuevo.';
const MENSAJE_CUENTA_INACTIVA = 'Su cuenta está inactiva. Comuníquese con el administrador.';

// Hash usado cuando el correo no existe, para que la respuesta tarde lo mismo
// y no revele si el correo está registrado (HU-18, escenario 5).
let hashFicticio: Promise<string> | undefined;
function obtenerHashFicticio(): Promise<string> {
  hashFicticio ??= generarHash('contraseña-ficticia-para-igualar-tiempos');
  return hashFicticio;
}

export async function iniciarSesion(datos: DatosLogin, contexto: ContextoLogin): Promise<RespuestaLogin> {
  const usuario = await usuarioRepository.buscarPorEmailConPassword(datos.email);
  const passwordCorrecta = await verificarPassword(datos.password, usuario?.passwordHash ?? (await obtenerHashFicticio()));

  if (!usuario || !passwordCorrecta) {
    await registrarFallo(datos.email, 'CREDENCIALES_INVALIDAS', contexto);
    throw new AppError(401, 'CREDENCIALES_INVALIDAS', MENSAJE_CREDENCIALES_INVALIDAS);
  }

  if (!usuario.estadoActivo) {
    await registrarFallo(datos.email, 'CUENTA_INACTIVA', contexto);
    throw new AppError(403, 'CUENTA_INACTIVA', MENSAJE_CUENTA_INACTIVA);
  }

  return {
    token: firmarToken({ id: usuario.id, rol: usuario.rol }),
    expiraEn: env.JWT_EXPIRA_EN,
    usuario: { id: usuario.id, nombreCompleto: usuario.nombreCompleto, rol: usuario.rol },
  };
}

async function registrarFallo(email: string, motivo: MotivoIntentoFallido, contexto: ContextoLogin): Promise<void> {
  try {
    await bitacoraRepository.registrarIntentoFallido({ email, motivo, ...contexto });
  } catch (error) {
    // La falla de la bitácora no debe cambiar la respuesta al usuario, pero sí quedar registrada.
    console.error('No fue posible registrar el intento fallido en la bitácora', error);
  }
}
