# Matriz de roles y permisos (RBAC)

Control de acceso basado en roles del SGL. Responde a la *Definition of Ready* de HU-18: "módulo de destino y funciones permitidas para cada rol".

- **Roles:** `CONDUCTOR`, `ADMINISTRADOR`, `CONTADOR`. Un usuario tiene un solo rol (`usuarios.rol`).
- **Acuerdo del equipo:** el "propietario" que mencionan HU-14, HU-15, HU-16 y HU-20 es el **Administrador**. No existe un cuarto rol.
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

### 2.5 Otros módulos del sistema · Pendiente

Según el backlog de Azure DevOps y el diagrama de clases. "Propietario" se lee como Administrador.

| Módulo | Funciones | Historia | Conductor | Administrador | Contador |
|---|---|---|:---:|:---:|:---:|
| Recuperación de contraseña | Solicitar enlace o código y restablecer la contraseña | HU-09 | ✔ | ✔ | ✔ |
| Usuarios | Registrar, consultar, editar y desactivar conductores; registrar y consultar el contador | Diagrama de clases | ✖ | ✔ | ✖ |
| Empresas | Registrar y consultar empresas | Diagrama de clases | ✖ | ✔ | ✖ |
| Registro de viajes y manifiesto | Registrar el viaje (formulario, QR y foto), guardarlo como borrador y retomarlo | HU-01, HU-02, HU-11, HU-19 | Propio | ✖ | ✖ |
| Gastos y saldo del viaje | Registrar anticipos y gastos; ver el saldo en tiempo real | HU-12, HU-13 | Propio | ✖ | ✖ |
| Viajes (gestión) | Consultar, auditar y finalizar viajes; corregir gastos | Diagrama de clases | ✖ | ✔ | ✖ |
| Reglas de descuento | Crear, editar y desactivar reglas del cálculo del saldo | HU-06 | ✖ | ✔ | ✖ |
| Alertas de manifiestos abandonados | Recibir y consultar alertas | HU-08 | ✖ | ✔ | ✖ |
| Notificación de viaje finalizado | Recibir la notificación | HU-20 | ✖ | ✔ | ✖ |
| Panel de historial de viajes | Listar viajes finalizados, ver el detalle y filtrar por placa y fechas | HU-14, HU-15 | ✖ | ✔ | ✖ |
| Analíticas de ingresos | Gráficas de rentabilidad por vehículo | HU-16 | ✖ | ✔ | ✖ |
| Auditoría financiera | Consultar el historial inmutable de cambios de montos por viaje | HU-07 | ✖ | ✖ | ✔ (solo lectura) |
| Conciliación de pagos | Listar viajes pendientes de pago y marcarlos como pagados | HU-10 | ✖ | ✖ | ✔ |
| Exportación a Excel | Descargar el histórico filtrado | HU-17, HU-10 (escenario 5) | ✖ | ✔ | ✔ |

**Nota sobre el Contador:** HU-18 (escenario 3) lo describe "sin opciones de creación, edición ni borrado". HU-10 le permite **marcar viajes como pagados**, que es una escritura acotada a su función. Al implementar HU-10, `autorizar('CONTADOR')` debe aplicarse solo a ese endpoint; el resto de escrituras sigue respondiendo 403 al Contador.

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
