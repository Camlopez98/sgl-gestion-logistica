# SGL – Backend

API REST del Sistema de Gestión Logística (Node.js + Express + TypeScript + PostgreSQL).

## Requisitos

- Node.js 20 o superior
- npm 10 o superior
- PostgreSQL 16 (instalado localmente o con Docker)

## Puesta en marcha

```bash
cd backend
cp .env.example .env      # ajuste los valores si es necesario
npm install

# Base de datos: opción A, con Docker (crea las bases sgl y sgl_test)
docker compose up -d
# opción B, PostgreSQL local: cree el usuario sgl/sgl y las bases sgl y sgl_test
#   CREATE ROLE sgl LOGIN PASSWORD 'sgl';
#   CREATE DATABASE sgl OWNER sgl;
#   CREATE DATABASE sgl_test OWNER sgl;

npm run migrate:up        # crea las tablas
npm run seed              # crea los usuarios de prueba
npm run dev               # http://localhost:3000/api
```

Verificación: `GET http://localhost:3000/api/salud` responde `{ "estado": "ok" }`.

## Scripts

| Script | Uso |
|---|---|
| `npm run dev` | Servidor en modo desarrollo con recarga automática |
| `npm run build` | Compila a `dist/` |
| `npm start` | Ejecuta la versión compilada |
| `npm run typecheck` | Verifica tipos sin compilar |
| `npm run migrate:up` | Aplica las migraciones pendientes |
| `npm run migrate:down` | Revierte la última migración |
| `npm run migrate:create -- <nombre>` | Crea una migración SQL nueva en `migrations/` |
| `npm run migrate:test` | Aplica las migraciones en la base de pruebas |
| `npm run seed` | Crea los usuarios de prueba (no se ejecuta en producción) |
| `npm test` | Aplica migraciones en `sgl_test` y ejecuta las pruebas (Vitest + supertest) |

Las pruebas usan la base `DATABASE_URL_TEST`; nunca tocan los datos de desarrollo.

## Usuarios de prueba

Todos tienen la contraseña `Sgl2026*`. Solo existen en desarrollo.

| Email | Rol | Estado |
|---|---|---|
| `admin@sgl.test` | ADMINISTRADOR | activo |
| `conductor@sgl.test` | CONDUCTOR | activo |
| `contador@sgl.test` | CONTADOR | activo |
| `inactivo@sgl.test` | CONDUCTOR | inactivo (para probar el rechazo de cuentas inactivas) |

## Migraciones

- Cada cambio de esquema es un archivo SQL nuevo en `migrations/`, con secciones `-- Up Migration` y `-- Down Migration`.
- El nombre lleva marca de tiempo, por lo que dos personas pueden crear migraciones en paralelo sin chocar.
- Una migración que ya llegó a `develop` **no se edita**: se crea otra que haga el cambio.

## Estructura

```
src/
├── server.ts        arranque del servidor
├── app.ts           construcción de la aplicación Express
├── config/env.ts    lectura y validación de variables de entorno
├── db/pool.ts       pool único de conexiones a PostgreSQL
├── db/transaccion.ts  ayuda para ejecutar varias consultas en una transacción
├── routes/index.ts  punto único de registro de módulos
├── modules/
│   ├── auth/        HU-18: login, logout, me, bitácora, hash de contraseñas
│   └── usuarios/    repositorio de usuarios (reutilizable)
└── shared/
    ├── errors/app-error.ts            AppError(status, codigo, mensaje)
    ├── seguridad/token.ts             firma y verificación de JWT
    ├── types/                         Rol y tipado de req.usuario
    └── middlewares/
        ├── autenticar.ts              exige JWT válido y usuario activo
        ├── autorizar.ts               restringe por rol (RBAC)
        ├── manejador-errores.ts       traduce todo error a { codigo, mensaje }
        ├── no-encontrado.ts           404 común
        └── validar.ts                 validación con zod (422)
```

Cada módulo sigue las mismas capas:

| Archivo | Responsabilidad |
|---|---|
| `<modulo>.routes.ts` | Rutas, middlewares y controlador de cada endpoint |
| `<modulo>.controller.ts` | Traduce la petición HTTP a una llamada al servicio |
| `<modulo>.service.ts` | Reglas de negocio (no conoce `req` ni `res`) |
| `<modulo>.repository.ts` | Consultas SQL parametrizadas |
| `<modulo>.schemas.ts` | Esquemas zod de entrada |

## Agregar un módulo nuevo

1. Cree `src/modules/<modulo>/` con sus archivos por capa.
2. Proteja cada ruta con los middlewares compartidos:
   ```ts
   router.post('/', autenticar, autorizar('ADMINISTRADOR'), validar({ body: esquema }), controlador.crear);
   ```
3. Registre el módulo con una línea en `src/routes/index.ts`:
   ```ts
   apiRouter.use('/asignaciones', asignacionesRoutes);
   ```

## Autenticación

| Método | Endpoint | Respuestas |
|---|---|---|
| POST | `/api/auth/login` | 200 `{ token, expiraEn, usuario }` · 401 `CREDENCIALES_INVALIDAS` · 403 `CUENTA_INACTIVA` · 422 `DATOS_INVALIDOS` |
| GET | `/api/auth/me` | 200 usuario de la sesión · 401 |
| POST | `/api/auth/logout` | 204 |

- El token se envía en `Authorization: Bearer <token>`.
- La sesión dura `JWT_EXPIRA_EN` segundos (30 min por defecto) **desde la última actividad**: cuando al token le queda menos de la mitad de su vida, la API devuelve uno nuevo en el encabezado `X-Token-Renovado` y el frontend lo reemplaza.
- Errores de `autenticar` (401): `TOKEN_AUSENTE`, `TOKEN_INVALIDO`, `SESION_EXPIRADA`, `CUENTA_INACTIVA`.
- Error de `autorizar` (403): `ACCESO_DENEGADO`.

## Formato de error

Toda respuesta de error tiene la misma forma:

```json
{ "codigo": "PLACA_DUPLICADA", "mensaje": "La placa TKM482 ya está registrada." }
```

| Situación | Status | Código |
|---|---|---|
| `throw new AppError(status, codigo, mensaje)` en un servicio | el indicado | el indicado |
| Datos que no cumplen el esquema zod | 422 | `DATOS_INVALIDOS` |
| JSON mal formado | 400 | `JSON_INVALIDO` |
| Violación de restricción `UNIQUE` no controlada | 409 | `REGISTRO_DUPLICADO` |
| Ruta inexistente | 404 | `RECURSO_NO_ENCONTRADO` |
| Cualquier otro error | 500 | `ERROR_INTERNO` |
