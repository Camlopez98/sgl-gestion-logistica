# Matriz de roles y permisos (RBAC)

Control de acceso basado en roles del SGL. Responde a la *Definition of Ready* de HU-18: "módulo de destino y funciones permitidas para cada rol".

- **Roles:** `CONDUCTOR`, `ADMINISTRADOR`, `CONTADOR`. Un usuario tiene un solo rol (`usuarios.rol`).
- **Dónde se aplica:**
  - **Servidor (autoridad):** middlewares `autenticar` y `autorizar(...roles)` en cada endpoint (RS-04). Una petición directa de un rol no permitido recibe `403 ACCESO_DENEGADO`.
  - **Interfaz (navegación):** `authGuard` y `rolGuard` según `data.roles` de cada ruta en `frontend/src/app/app.routes.ts`. El menú lateral solo muestra los módulos del rol. La interfaz ayuda a navegar, pero la seguridad la da el servidor.
- **Estado de cada fila:** **Implementado** (código y pruebas existen) o **Pendiente** (definido por la historia o el diagrama de clases; lo implementa la historia indicada).

---

## 1. Módulo de destino por rol (HU-18, escenarios 1 a 3)

| Rol | Pantalla tras iniciar sesión | Ruta | Estado |
|---|---|---|---|
| Conductor | Mis viajes en curso | `/conductor/viajes-en-curso` | Implementado (pantalla provisional; su contenido es de otra historia) |
| Administrador | Dashboard administrativo | `/admin/dashboard` | Implementado |
| Contador | Visor de reportes, sin opciones de creación, edición ni borrado | `/contador/reportes` | Implementado (pantalla provisional de solo lectura) |

Un rol que abre la ruta de otro vuelve a su propio módulo (escenario 8). Sin sesión, cualquier ruta interna lleva a `/login` (escenario 10).

---

## 2. Matriz de permisos

Leyenda: ✔ permitido · ✖ denegado (403 en el servidor) · **Propio** = solo sus propios registros.

### 2.1 Sesión (HU-18) · Implementado

| Función | Endpoint | Conductor | Administrador | Contador |
|---|---|:---:|:---:|:---:|
| Iniciar sesión | `POST /api/auth/login` | ✔ | ✔ | ✔ |
| Consultar la sesión actual | `GET /api/auth/me` | ✔ | ✔ | ✔ |
| Cerrar sesión | `POST /api/auth/logout` | ✔ | ✔ | ✔ |

### 2.2 Vehículos (HU-03) · Implementado

| Función | Endpoint | Conductor | Administrador | Contador |
|---|---|:---:|:---:|:---:|
| Registrar vehículo | `POST /api/vehiculos` | ✖ | ✔ | ✖ |
| Consultar vehículos (con filtros) | `GET /api/vehiculos` | ✖ | ✔ | ✖ |
| Consultar detalle | `GET /api/vehiculos/{id}` | ✖ | ✔ | ✖ |
| Editar vehículo | `PUT /api/vehiculos/{id}` | ✖ | ✔ | ✖ |
| Desactivar vehículo | `PATCH /api/vehiculos/{id}/desactivar` | ✖ | ✔ | ✖ |
| Pantalla de flota | `/admin/flota` | ✖ | ✔ | ✖ |

Evidencia: `backend/tests/vehiculos.test.ts`, prueba "Seguridad (RS-04)": Conductor y Contador reciben 403 en las cinco operaciones.

### 2.3 Asignación de vehículos (HU-04) · Pendiente

| Función | Endpoint (contrato de HU-04) | Conductor | Administrador | Contador |
|---|---|:---:|:---:|:---:|
| Habilitar, activar y finalizar asignaciones | `POST /api/asignaciones`, `PATCH /api/asignaciones/{id}/activar`, `PATCH /api/asignaciones/{id}/finalizar` | ✖ | ✔ | ✖ |
| Historial de asignaciones de un vehículo | `GET /api/vehiculos/{id}/asignaciones` | ✖ | ✔ | ✖ |
| Consultar su vehículo activo (selector del manifiesto) | `GET /api/conductores/me/vehiculo-activo` | Propio | ✖ | ✖ |

### 2.4 Historial del conductor (HU-05) · Pendiente

| Función | Endpoint (contrato de HU-05) | Conductor | Administrador | Contador |
|---|---|:---:|:---:|:---:|
| Consultar el historial de sus viajes | `GET /api/conductores/me/viajes` | Propio | ✖ | ✖ |
| Consultar el detalle de un viaje propio | `GET /api/conductores/me/viajes/{id}` | Propio (404 si no es suyo) | ✖ | ✖ |
| Pantalla de historial | `/conductor/historial` | ✔ | ✖ | ✖ |

### 2.5 Otros módulos del sistema · Pendiente (según el diagrama de clases)

| Módulo | Funciones | Conductor | Administrador | Contador |
|---|---|:---:|:---:|:---:|
| Usuarios | Registrar, consultar, editar y desactivar conductores; registrar y consultar el contador | ✖ | ✔ | ✖ |
| Empresas | Registrar y consultar empresas | ✖ | ✔ | ✖ |
| Viajes y manifiestos | Iniciar viaje con su vehículo activo, reportar gastos y entrega | Propio | ✖ | ✖ |
| Viajes y manifiestos | Consultar, auditar y finalizar viajes; corregir gastos | ✖ | ✔ | ✖ |
| Reportes financieros | Dashboard financiero | ✖ | ✔ | ✖ |
| Reportes financieros | Consultar viajes validados y exportar el consolidado a Excel (solo lectura) | ✖ | ✖ | ✔ |

---

## 3. Cómo agregar un permiso nuevo

1. **Servidor:** proteger la ruta con los middlewares compartidos:
   ```ts
   router.post('/', autenticar, autorizar('ADMINISTRADOR'), validar({ body: esquema }), controlador.crear);
   ```
   Para recursos propios (**Propio**), filtrar en el servicio con `usuarioDeSesion(req).id`, nunca con un id enviado por el cliente.
2. **Interfaz:** declarar `roles` en `data` de la ruta en `app.routes.ts`. El menú se actualiza solo.
3. **Pruebas:** al menos una prueba en la que un rol no permitido reciba 403.
4. **Este documento:** agregar la fila y cambiar su estado a **Implementado**.
