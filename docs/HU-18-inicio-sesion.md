# HU-18 Como usuario del sistema, quiero iniciar sesión con mis credenciales para acceder al módulo de mi rol.

**Azure DevOps:** Product Backlog Item 38 · Prioridad 1 · Área: Arquitectura de software
**Requisitos del SRS:** RF-22, RF-23, RNF-11, RNF-13, RS-03, RS-04, RS-07

## Descripción

El sistema debe validar la identidad de todo usuario (Conductor, Administrador o Contador) mediante su correo y contraseña antes de permitir el acceso a cualquier funcionalidad. Tras autenticarse, lo dirige automáticamente al módulo de su rol: el Conductor a "Mis viajes en curso", el Administrador al dashboard administrativo y el Contador al visor de reportes. El servidor verifica el rol en cada solicitud (RBAC), no solo la interfaz. Las contraseñas se almacenan con hash, los intentos fallidos quedan en bitácora, los usuarios inactivos no pueden ingresar y la sesión expira tras un período de inactividad.

## Definition of Ready

- Matriz de roles y permisos (RBAC) documentada: módulo de destino y funciones permitidas para cada rol.
- Pantalla de inicio de sesión diseñada y pantalla de destino definida para cada rol.
- Identificador de acceso (correo) y tiempo de expiración de la sesión por inactividad acordados.
- Mensajes de error definidos.

## Definition of Done

- Las contraseñas se almacenan con una función de hash con salt (por ejemplo, bcrypt), nunca en texto plano ni con cifrado reversible.
- La autenticación usa tokens firmados (por ejemplo, JWT) con expiración, y la sesión expira tras el período de inactividad configurado.
- La redirección por rol fue probada para los tres roles.
- El control de acceso fue probado en el servidor: una petición directa de un rol no autorizado recibe error de autorización.
- Los intentos fallidos quedan registrados en bitácora.
- Se probaron los escenarios de credenciales incorrectas, usuario inactivo y fallas de red.

## Criterios de aceptación

### Inicio de sesión
1. Dado que un usuario tiene el rol "Conductor", Cuando ingresa credenciales válidas, Entonces el sistema le permite el acceso y lo lleva a la pantalla "Mis viajes en curso".
2. Dado que un usuario tiene el rol "Administrador", Cuando ingresa credenciales válidas, Entonces el sistema le permite el acceso y lo lleva al dashboard administrativo.
3. Dado que un usuario tiene el rol "Contador", Cuando ingresa credenciales válidas, Entonces el sistema le permite el acceso y lo lleva al visor de reportes, sin opciones de creación, edición ni borrado.
4. Dado que un usuario ingresa su correo, Cuando escribe una contraseña equivocada, Entonces el sistema no permite el ingreso y muestra en rojo "Credenciales incorrectas, inténtelo de nuevo".
5. Dado que una persona ingresa un correo que no está registrado, Cuando intenta iniciar sesión, Entonces el sistema muestra el mismo mensaje del escenario 4, sin revelar si el correo existe.
6. Dado que el usuario deja un campo vacío o escribe un correo con formato inválido, Cuando intenta iniciar sesión, Entonces el sistema no envía la solicitud y señala el campo con error.
7. Dado que la cuenta de un usuario fue desactivada por el administrador, Cuando ingresa credenciales correctas, Entonces el sistema no permite el ingreso e indica que la cuenta está inactiva.

### Control de acceso
8. Dado que un conductor tiene una sesión activa, Cuando intenta abrir la dirección del dashboard administrativo, Entonces el sistema le niega el acceso y lo devuelve a su módulo.
9. Dado que un contador tiene una sesión activa, Cuando envía directamente al servidor una solicitud de escritura, Entonces el servidor la rechaza con un error de autorización.
10. Dado que una persona no ha iniciado sesión, Cuando intenta abrir cualquier pantalla interna del sistema, Entonces el sistema la redirige al inicio de sesión.

### Sesión y auditoría
11. Dado que un usuario dejó la sesión inactiva más tiempo del configurado, Cuando intenta realizar una acción, Entonces el sistema le indica que la sesión expiró y lo lleva al inicio de sesión.
12. Dado que un usuario cierra sesión, Cuando intenta volver con el botón "atrás" del navegador, Entonces el sistema no le muestra contenido protegido.
13. Dado que alguien falla un intento de inicio de sesión, Cuando el sistema rechaza el ingreso, Entonces debe registrar en la bitácora la fecha, la hora y el correo utilizado.

### Fallas de red y servidor
14. Dado que el usuario no tiene conexión a internet, Cuando intenta iniciar sesión, Entonces el sistema le informa que no hay conexión.
15. Dado que el servidor no responde o devuelve un error, Cuando el usuario intenta iniciar sesión, Entonces el sistema muestra un mensaje de error claro y permite reintentar.

## Contrato de API (propuesta)

| Método | Endpoint | Uso | Respuestas clave |
|---|---|---|---|
| POST | `/api/auth/login` | Iniciar sesión | 200 token + rol · 401 credenciales incorrectas · 403 cuenta inactiva |
| POST | `/api/auth/logout` | Cerrar sesión | 204 |
| GET | `/api/auth/me` | Usuario de la sesión actual | 200 · 401 sesión expirada |

```json
// POST /api/auth/login (petición)
{ "email": "conductor@empresa.com", "password": "********" }

// 200 (respuesta)
{ "token": "eyJhbGciOi...", "expiraEn": 1800,
  "usuario": { "id": "6f1c2e7a-...", "nombreCompleto": "Carlos Méndez", "rol": "CONDUCTOR" } }

// 401 (respuesta)
{ "codigo": "CREDENCIALES_INVALIDAS", "mensaje": "Credenciales incorrectas, inténtelo de nuevo." }
```

## División del trabajo

- **Backend:** endpoint de login con verificación del hash, emisión de token con expiración, middleware que valida token y rol en cada endpoint, rechazo de usuarios inactivos y bitácora de intentos fallidos.
- **Frontend (`develop-camilo`):** pantalla de login con validación de campos, `AuthService` (login, logout, guardar token y rol), interceptor HTTP que agrega el token y maneja 401/403, *guards* de rutas por rol y redirección al módulo de cada rol.
- Commits con `AB#38` para enlazarlos al ítem de Azure DevOps.

## Definiciones acordadas (Definition of Ready)

### Roles y pantallas de destino

La matriz completa de roles y permisos está en `docs/MATRIZ-RBAC.md`.

| Rol | Pantalla de destino | Ruta |
|---|---|---|
| Conductor | Mis viajes en curso | `/conductor/viajes-en-curso` |
| Administrador | Dashboard administrativo | `/admin/dashboard` |
| Contador | Visor de reportes (solo lectura) | `/contador/reportes` |

### Identificador de acceso y sesión

| Aspecto | Definición |
|---|---|
| Identificador | Correo electrónico, único sin distinguir mayúsculas; se normaliza (sin espacios, en minúsculas). |
| Expiración por inactividad | 30 minutos (`JWT_EXPIRA_EN=1800`). Mientras el usuario interactúa, el token se renueva cuando le queda menos de la mitad de su vida; tras 30 minutos sin actividad expira y se muestra "Su sesión expiró por inactividad". |
| Almacenamiento de la sesión | `sessionStorage` del navegador: se borra al cerrar el navegador y al cerrar sesión. |

### Mensajes de error

| Situación | Código | Mensaje mostrado |
|---|---|---|
| Correo vacío | — (formulario) | El correo es obligatorio. |
| Correo con formato inválido | — (formulario) | Ingrese un correo con formato válido. |
| Contraseña vacía | — (formulario) | La contraseña es obligatoria. |
| Contraseña equivocada o correo no registrado | `401 CREDENCIALES_INVALIDAS` | Credenciales incorrectas, inténtelo de nuevo. (en rojo) |
| Cuenta desactivada | `403 CUENTA_INACTIVA` | Su cuenta está inactiva. Comuníquese con el administrador. |
| Sin conexión a internet | — (red) | No hay conexión a internet. Verifique su conexión e inténtelo de nuevo. |
| Servidor sin respuesta | — (red) | El servidor no responde. Inténtelo de nuevo en unos momentos. |
| Error del servidor (5xx) | `500 ERROR_INTERNO` | El servidor presentó un error. Inténtelo de nuevo en unos momentos. |
| Sesión expirada por inactividad | `401 SESION_EXPIRADA` | Su sesión expiró por inactividad. Inicie sesión nuevamente. |
| Cuenta desactivada durante la sesión | `401 CUENTA_INACTIVA` | Su cuenta está inactiva. Comuníquese con el administrador. |
| Sesión inválida | `401 TOKEN_INVALIDO` | Su sesión ya no es válida. Inicie sesión nuevamente. |
| Acceso a una función de otro rol | `403 ACCESO_DENEGADO` | No tiene permisos para realizar esta acción. (se devuelve al usuario a su módulo) |
| Cierre de sesión voluntario | — | Cerró sesión correctamente. |

## Estado de cumplimiento

### Definition of Ready

| Ítem | Estado | Evidencia |
|---|---|---|
| Matriz de roles y permisos documentada | Cumplido | `docs/MATRIZ-RBAC.md` |
| Pantalla de inicio de sesión diseñada y destino por rol | Cumplido | `frontend/src/app/pages/login-page/`; tabla "Roles y pantallas de destino" |
| Identificador y tiempo de expiración acordados | Cumplido | Tabla "Identificador de acceso y sesión" |
| Mensajes de error definidos | Cumplido | Tabla "Mensajes de error" |

### Definition of Done

| Ítem | Estado | Evidencia |
|---|---|---|
| Contraseñas con hash y salt (bcrypt) | Cumplido | `backend/src/modules/auth/password.ts`; prueba "guarda las contraseñas con hash bcrypt" en `backend/tests/auth.login.test.ts` |
| Tokens firmados con expiración y sesión por inactividad | Cumplido | `backend/src/shared/seguridad/token.ts`, `autenticar.ts`; `AuthService.registrarActividad`; pruebas en `auth.acceso.test.ts` y `auth.service.spec.ts`; verificación manual con sesión de 20 s |
| Redirección probada para los tres roles | Cumplido | `login-page.spec.ts`, `auth.guards.spec.ts`; verificación manual en navegador |
| Control de acceso probado en el servidor | Cumplido | `auth.acceso.test.ts` (CA 9), `vehiculos.test.ts` (Seguridad RS-04) |
| Intentos fallidos en bitácora | Cumplido | Tabla `bitacora_intentos_fallidos`; prueba CA 13 en `auth.login.test.ts` |
| Credenciales incorrectas, usuario inactivo y fallas de red probados | Cumplido | `auth.login.test.ts`, `login-page.spec.ts`, `mensaje-error.spec.ts` |

### Criterios de aceptación

Los 15 escenarios están implementados y cubiertos por pruebas automáticas. La tabla de trazabilidad (escenario → implementación → prueba) está en `docs/PROCESO.md`, sección 4.

### Limitación conocida

El cierre de sesión no invalida el token en el servidor (JWT sin estado): el frontend lo elimina, y el servidor verifica en cada petición que el usuario siga activo.
