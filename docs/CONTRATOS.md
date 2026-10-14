# Contratos de integración entre módulos

Acuerdos para que cada integrante agregue sus historias sin modificar los módulos del otro.
Base entregada con HU-18 (AB#38). Detalles de ejecución en `backend/README.md`.

| Módulo | Responsable | Historias |
|---|---|---|
| `auth`, `usuarios`, `vehiculos` | Camilo | HU-18, HU-03 |
| `asignaciones`, `historial` | Compañero | HU-04, HU-05 |

## 1. Backend

### 1.1 Agregar un módulo

```
backend/src/modules/<modulo>/
├── <modulo>.routes.ts      rutas + middlewares
├── <modulo>.controller.ts  HTTP ↔ servicio (sin SQL ni reglas)
├── <modulo>.service.ts     reglas de negocio (sin req/res)
├── <modulo>.repository.ts  SQL parametrizado
└── <modulo>.schemas.ts     validación zod
```

Registro con **una línea** en `backend/src/routes/index.ts`:

```ts
apiRouter.use('/asignaciones', asignacionesRoutes);
```

### 1.2 Seguridad en cada endpoint (RS-04)

```ts
import { autenticar, usuarioDeSesion } from '../../shared/middlewares/autenticar';
import { autorizar } from '../../shared/middlewares/autorizar';
import { validar } from '../../shared/middlewares/validar';

router.post('/', autenticar, autorizar('ADMINISTRADOR'), validar({ body: esquemaCrear }), controlador.crear);
router.get('/me/viajes', autenticar, autorizar('CONDUCTOR'), controlador.misViajes);
```

En el controlador, el usuario de la sesión se obtiene así:

```ts
const usuario = usuarioDeSesion(req); // { id, rol, nombreCompleto, email }
```

- `id` es el `usuarios.id` (UUID) del usuario autenticado. Para "mis viajes" use siempre este id, nunca uno enviado por el cliente.
- Roles: `'CONDUCTOR' | 'ADMINISTRADOR' | 'CONTADOR'` (`backend/src/shared/types/rol.ts`).

### 1.3 Errores

Los servicios lanzan `AppError`; el manejador central responde `{ "codigo", "mensaje" }`:

```ts
import { AppError } from '../../shared/errors/app-error';
throw new AppError(409, 'ASIGNACION_DUPLICADA', 'Ya existe una asignación vigente entre ese conductor y ese vehículo.');
```

Convenciones de status: 401 sin sesión · 403 rol no permitido o recurso ajeno · 404 no existe · 409 conflicto de estado o duplicado · 422 datos inválidos.

### 1.4 Transacciones

Para operaciones con varias consultas que deben aplicarse todas o ninguna (por ejemplo, activar una asignación y liberar la anterior):

```ts
import { enTransaccion } from '../../db/transaccion';

await enTransaccion(async (cliente) => {
  await cliente.query('UPDATE ...', [...]);
  await cliente.query('INSERT ...', [...]);
});
```

### 1.5 Tablas disponibles para referenciar

| Tabla | Clave | Columnas útiles | Estado |
|---|---|---|---|
| `usuarios` | `id UUID` | `nombre_completo`, `email`, `rol`, `estado_activo` | Disponible |
| `conductores` | `usuario_id UUID` (FK a `usuarios.id`) | `numero_licencia`, `categoria_licencia`, `telefono_contacto` | Disponible |
| `vehiculos` | `id UUID` | `placa`, `tipo`, `estado` (ver 1.6) | Disponible (HU-03) |

Para referenciar a un conductor use `REFERENCES conductores (usuario_id)`: garantiza que el usuario tiene rol CONDUCTOR.
Para saber si está activo: `JOIN usuarios u ON u.id = c.usuario_id WHERE u.estado_activo`.

Repositorio reutilizable: `backend/src/modules/usuarios/usuario.repository.ts` (`buscarPorId`).

### 1.6 Tabla `vehiculos` (HU-03, AB#23)

| Columna | Tipo |
|---|---|
| `id` | `UUID PK` |
| `placa` | `VARCHAR UNIQUE` (mayúsculas, sin espacios ni guiones) |
| `tipo` | `tipo_vehiculo`: `FURGON`, `CAMION`, `TRACTOCAMION`, `REMOLQUE`, `SEMIRREMOLQUE` |
| `marca`, `modelo` | `VARCHAR` |
| `numero_ejes` | `INTEGER` |
| `capacidad_carga_kg` | `NUMERIC` |
| `estado` | `estado_vehiculo`: `ACTIVO`, `INACTIVO` |
| `created_at`, `updated_at` | `TIMESTAMPTZ` |

- Para HU-04: los automotores son `FURGON`, `CAMION` y `TRACTOCAMION`; `REMOLQUE` y `SEMIRREMOLQUE` se acoplan.
  Solo se habilitan vehículos con `estado = 'ACTIVO'`.
- Los vehículos nunca se borran; un vehículo desactivado deja de estar disponible para nuevas asignaciones.
- Repositorio reutilizable: `backend/src/modules/vehiculos/vehiculos.repository.ts` (`buscarPorId`).

**Viaje activo (HU-03, CA 7).** Vehículos no consulta la tabla de viajes directamente. El módulo de viajes,
cuando exista, registra su consulta al cargarse:

```ts
import { registrarConsultaViajeActivo } from '../vehiculos/viajes-activos';
registrarConsultaViajeActivo((vehiculoId) => viajesRepository.vehiculoTieneViajeActivo(vehiculoId));
```

### 1.6.1 Reintentos sin duplicados (`idempotente()`)

Para creaciones que no deben duplicarse ante reintentos (HU-04, CA 17):

```ts
import { idempotente } from '../../shared/middlewares/idempotente';
router.post('/', autenticar, autorizar('ADMINISTRADOR'), idempotente(), validar({ body: esquema }), controlador.crear);
```

El cliente envía `Idempotency-Key` (una clave por operación) y la reutiliza al reintentar con los mismos datos.
Detalles en `backend/README.md`.

### 1.7 Migraciones

```bash
cd backend
npm run migrate:create -- crear-asignaciones-vehiculo   # crea migrations/<marca-de-tiempo>_crear-asignaciones-vehiculo.sql
npm run migrate:up
```

- Cada archivo tiene `-- Up Migration` y `-- Down Migration`.
- Una migración que ya llegó a `develop` no se edita: se crea otra.
- Nunca se modifican tablas de otro módulo sin acordarlo; las claves foráneas hacia ellas sí son libres.
- Toda tabla nueva lleva `id UUID DEFAULT gen_random_uuid()`, `created_at`, `updated_at` y su trigger:
  ```sql
  CREATE TRIGGER trg_<tabla>_updated_at BEFORE UPDATE ON <tabla>
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
  ```

### 1.8 Pruebas

`npm test` usa la base `sgl_test`. El archivo `tests/setup.ts` vacía las tablas de usuarios y siembra los usuarios de prueba. Si su módulo crea tablas que referencian a `usuarios`, agréguelas al `TRUNCATE` de ese archivo.

## 2. Frontend

### 2.1 Agregar una pantalla

Una entrada en `rutasInternas` de `frontend/src/app/app.routes.ts`:

```ts
{ path: 'admin/asignaciones', component: AppAssignmentsPage,
  data: { titulo: 'Asignaciones', menu: 'Asignaciones', roles: ['ADMINISTRADOR'] } satisfies DatosRuta },
```

- `roles`: quién puede abrirla (lo aplica `rolGuard`; la sesión la exige `authGuard`).
- `menu`: si se indica, la entrada aparece sola en el menú lateral de esos roles.
- La pantalla `conductor/historial` (HU-05) ya está registrada con el componente existente `history-page`.

### 2.2 Llamadas a la API

```ts
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

this.http.get<Respuesta>(`${environment.apiUrl}/conductores/me/viajes`, { params: { limite: 5 } });
```

El interceptor ya agrega el token, renueva la sesión y maneja 401 (lleva al login) y 403 `ACCESO_DENEGADO` (vuelve al módulo del rol). No agregue encabezados de autorización a mano.

Ejemplo completo de servicio con manejo de sin conexión, reenvío ante cortes e `Idempotency-Key`:
`frontend/src/app/vehiculos/vehiculo.service.ts`. El listado de vehículos para seleccionar en asignaciones
está disponible con `VehiculoService.listar({ estado: 'ACTIVO' })`.

Mensajes de error para el usuario (sin conexión, servidor caído, mensaje del backend):

```ts
import { codigoDeError, mensajeDeError } from '../../core/http/mensaje-error';

error: (e) => this.error.set(mensajeDeError(e));
```

### 2.3 Sesión

`AuthService` (`core/auth/auth.service.ts`) expone `usuario()`, `rol()` y `cerrarSesion()`.
La sesión vive en `sessionStorage` (`sgl.token`, `sgl.usuario`). HU-05 debe borrar su caché sin conexión al cerrar sesión; el punto de enganche es `AuthService.descartarSesion()`.

## 3. Usuarios de prueba

Contraseña `Sgl2026*` para todos: `admin@sgl.test`, `conductor@sgl.test`, `contador@sgl.test`, `inactivo@sgl.test` (inactivo).

## 4. Archivos compartidos

Solo estos archivos los tocan ambos; agregue líneas, no reordene las existentes:

- `backend/src/routes/index.ts`
- `backend/tests/setup.ts` (lista del `TRUNCATE`)
- `frontend/src/app/app.routes.ts`
- `package.json` y `package-lock.json` de cada proyecto (regenere el lock con `npm install`, no lo edite a mano)
