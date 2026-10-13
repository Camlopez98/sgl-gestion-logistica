# SGL – Backend

API REST del Sistema de Gestión Logística (Node.js + Express + TypeScript + PostgreSQL).

## Requisitos

- Node.js 20 o superior
- npm 10 o superior

## Puesta en marcha

```bash
cd backend
cp .env.example .env      # ajuste los valores si es necesario
npm install
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

## Estructura

```
src/
├── server.ts        arranque del servidor
├── app.ts           construcción de la aplicación Express
├── config/env.ts    lectura y validación de variables de entorno
└── routes/index.ts  punto único de registro de módulos
```
