/** Crea un JWT de prueba (sin firma válida) que vence en `segundos`. */
export function tokenDePrueba(segundos = 1800, rol = 'ADMINISTRADOR'): string {
  const base64Url = (objeto: object) =>
    btoa(JSON.stringify(objeto)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const exp = Math.floor(Date.now() / 1000) + segundos;
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url({ sub: 'u1', rol, exp })}.firma`;
}
