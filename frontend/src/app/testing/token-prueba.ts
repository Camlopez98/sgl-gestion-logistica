/**
 * Crea un JWT de prueba (sin firma válida) que vence en `segundos`.
 * `emitidoHace` indica cuántos segundos atrás se emitió (iat).
 */
export function tokenDePrueba(segundos = 1800, rol = 'ADMINISTRADOR', emitidoHace = 0): string {
  const base64Url = (objeto: object) =>
    btoa(JSON.stringify(objeto)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { sub: 'u1', rol, iat: ahora - emitidoHace, exp: ahora + segundos };
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(payload)}.firma`;
}
