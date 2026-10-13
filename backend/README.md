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
└── shared/
    ├── errors/app-error.ts            AppError(status, codigo, mensaje)
    └── middlewares/
        ├── manejador-errores.ts       traduce todo error a { codigo, mensaje }
        ├── no-encontrado.ts           404 común
        └── validar.ts                 validación con zod (422)
```

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
