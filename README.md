# sgl-gestion-logistica
Sistema de Gestión Logística – Arquitectura de Software, Universidad de La Salle

## Estructura

| Carpeta | Contenido |
|---|---|
| `backend/` | API REST (Node.js + Express + TypeScript + PostgreSQL). Ver `backend/README.md`. |
| `frontend/` | Aplicación web (Angular). |
| `docs/` | Historias de usuario, diagrama de clases, `CONTRATOS.md` (acuerdos de integración entre módulos) y `PROCESO.md` (registro del proceso de desarrollo). |

## Ejecución local

1. Backend: siga `backend/README.md` (base de datos, migraciones, usuarios de prueba y `npm run dev`).
2. Frontend:
   ```bash
   cd frontend
   npm install
   npm start        # http://localhost:4200
   ```
3. Ingrese con `admin@sgl.test`, `conductor@sgl.test` o `contador@sgl.test` (contraseña `Sgl2026*`).

