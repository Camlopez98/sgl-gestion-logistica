# HU-03 Como administrador, quiero gestionar y asignar los vehículos de la flota para asociarlos correctamente a los manifiestos.

**Azure DevOps:** Product Backlog Item 23 · Prioridad 2 · Área: Arquitectura de software

## Descripción

El sistema debe permitir al administrador crear, consultar, editar y desactivar vehículos (furgón, camión, tractocamión, remolque y semirremolque). Por cada uno almacena placa, tipo, marca, modelo, número de ejes, capacidad de carga y estado (activo/inactivo). La placa es única y debe cumplir el formato legal según el tipo: AAA999 para automotores, R99999 para remolques y S99999 para semirremolques. Un vehículo inactivo no se elimina físicamente; se conserva en el histórico.

El administrador puede habilitar varios vehículos a un conductor, pero solo uno puede estar activo a la vez, con su remolque o semirremolque acoplado si aplica. Al crear un manifiesto, el conductor solo puede seleccionar ese vehículo activo. El sistema debe manejar las fallas de conexión o de servidor sin generar duplicados ni pérdida de información.

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Formato de placa | FURGON, CAMION, TRACTOCAMION: `^[A-Z]{3}[0-9]{3}$` · REMOLQUE: `^R[0-9]{5}$` · SEMIRREMOLQUE: `^S[0-9]{5}$` |
| Normalización | El servidor convierte la placa a mayúsculas y elimina espacios y guiones antes de validar. |
| Unicidad | Restricción `UNIQUE` en BD + validación en servidor (al registrar y al editar). |
| Desactivación | Nunca se borra; `estado = INACTIVO`. No se puede desactivar un vehículo en un viaje `ACTIVO`. |
| Asignación | Estados: `HABILITADA` (puede manejarlo), `ACTIVA` (lo usa en el viaje actual), `FINALIZADA`. |
| Invariante 1 | Un conductor tiene máximo una asignación `ACTIVA`; al activar otra, la anterior vuelve a `HABILITADA`. |
| Invariante 2 | Un vehículo o remolque está en máximo una asignación `ACTIVA`. |
| Invariante 3 | No se cambia la asignación activa de un conductor con un viaje `ACTIVO`. |
| Acople | CAMION admite REMOLQUE; TRACTOCAMION admite SEMIRREMOLQUE. Solo se habilitan automotores. |
| Seguridad | Solo el Administrador gestiona vehículos; el servidor valida rol y vehículo activo en cada petición (RS-04). |

## Definition of Ready

- Modelo de datos de *Vehículo* y *AsignacionVehiculo* definido, con sus relaciones con *Conductor* y *Viaje* documentadas en el diagrama de clases.
- Reglas de validación de placa por tipo de vehículo (formato, normalización y unicidad) aprobadas por el equipo.
- Reglas de habilitación, activación y acople de remolques aprobadas por el equipo.
- RF-11 y RF-12 actualizados en el SRS.
- Manejo de errores de red y de servidor en el panel administrativo definido.

## Definition of Done

- El CRUD de vehículos fue probado, incluido el rechazo de placas duplicadas y de placas con formato inválido para su tipo.
- Se verificó que los vehículos inactivos no se eliminan y permanecen en el histórico.
- Las reglas de habilitación, activación y acople fueron probadas, incluidos los casos de rechazo.
- La selección del vehículo activo fue validada desde el flujo del conductor y en el servidor.
- Se probaron los escenarios de falla de conexión y caída del servidor sin generar duplicados ni datos corruptos.

## Criterios de aceptación

### Registro y placa
1. Dado que el administrador registra un vehículo con una placa válida que no existe en el sistema, Cuando confirma el registro, Entonces el sistema debe guardarlo con estado "activo" por defecto.
2. Dado que el administrador registra un vehículo con una placa ya existente, Cuando confirma el registro, Entonces el sistema debe rechazarlo e indicar que la placa ya está registrada.
3. Dado que el administrador registra un vehículo cuya placa no corresponde al formato de su tipo (por ejemplo, `R12345` como tractocamión), Cuando confirma el registro, Entonces el sistema debe rechazarlo e indicar el formato esperado.
4. Dado que el administrador escribe la placa con minúsculas, espacios o guion (por ejemplo, "tkm-482"), Cuando confirma el registro, Entonces el sistema debe guardarla normalizada como `TKM482`.

### Edición y desactivación
5. Dado que el administrador edita un vehículo, Cuando cambia su placa por una que ya pertenece a otro vehículo, Entonces el sistema debe rechazar el cambio.
6. Dado que el administrador marca un vehículo como "inactivo", Cuando consulta el histórico de vehículos, Entonces el vehículo debe seguir apareciendo con su estado actualizado, sin haberse eliminado.
7. Dado que un vehículo está en un viaje en estado "Activo", Cuando el administrador intenta desactivarlo, Entonces el sistema debe rechazar la operación.

### Habilitación y activación
8. Dado que un conductor tiene tres vehículos habilitados y uno activado, Cuando accede al selector de vehículo al crear un manifiesto, Entonces el sistema solo debe mostrar el vehículo activado.
9. Dado que el vehículo activado de un conductor está marcado como "inactivo", Cuando el conductor intenta crear un manifiesto, Entonces el sistema no debe mostrarlo y debe indicar que no tiene un vehículo disponible.
10. Dado que un conductor tiene un vehículo activo, Cuando el administrador activa otro de sus vehículos habilitados, Entonces el anterior debe quedar como "habilitado" y el nuevo como "activo".
11. Dado que un vehículo está activo con un conductor, Cuando el administrador intenta activarlo para otro conductor, Entonces el sistema debe rechazar la operación.
12. Dado que un conductor tiene un viaje en estado "Activo", Cuando el administrador intenta cambiarle el vehículo activo, Entonces el sistema debe rechazar la operación.
13. Dado que un conductor envía directamente al servidor un manifiesto con un vehículo que no tiene activado, Cuando el servidor procesa la solicitud, Entonces debe rechazarla con un error de autorización.

### Remolques y semirremolques
14. Dado que el administrador activó un tractocamión con un semirremolque acoplado, Cuando el conductor crea un manifiesto, Entonces el viaje debe guardar ambas placas.
15. Dado que el administrador activa un camión, Cuando intenta acoplarle un semirremolque, Entonces el sistema debe rechazar la operación, porque un camión solo admite remolque.
16. Dado que un semirremolque ya está acoplado en una asignación activa, Cuando el administrador intenta acoplarlo a otro tractocamión, Entonces el sistema debe rechazar la operación.

### Fallas de red y servidor
17. (Sin conexión) Dado que el administrador pierde la conexión mientras registra un vehículo, Cuando intenta guardar, Entonces el sistema debe informar que no hay conexión y no guardar un registro incompleto.
18. (Caída del servidor) Dado que el servidor no responde o devuelve un error al registrar un vehículo, Cuando el administrador reintenta la operación, Entonces el sistema no debe duplicar el vehículo.
19. (Conexión intermitente) Dado que la solicitud de registro se interrumpe a mitad de camino, Cuando el cliente la reenvía automáticamente, Entonces el servidor debe validar la unicidad de la placa antes de confirmar.

## Contrato de API (propuesta)

| Método | Endpoint | Uso | Respuestas clave |
|---|---|---|---|
| POST | `/api/vehiculos` | Registrar | 201 · 409 placa duplicada · 422 formato inválido |
| GET | `/api/vehiculos?estado=ACTIVO` | Consultar | 200 |
| PUT | `/api/vehiculos/{id}` | Editar | 200 · 409 placa duplicada |
| PATCH | `/api/vehiculos/{id}/desactivar` | Desactivar | 200 · 409 vehículo en viaje activo |
| POST | `/api/asignaciones` | Habilitar vehículo a conductor | 201 |
| PATCH | `/api/asignaciones/{id}/activar` | Activar (remolque opcional) | 200 · 409 activo con otro conductor |
| GET | `/api/conductores/me/vehiculo-activo` | Selector del conductor | 200 · 403 |

```json
// POST /api/vehiculos (petición)
{ "placa": "TKM482", "tipo": "TRACTOCAMION", "marca": "Kenworth", "modelo": "T800", "numeroEjes": 3, "capacidadCargaKg": 34000 }

// 201 (respuesta)
{ "id": "6f1c2e7a-...", "placa": "TKM482", "tipo": "TRACTOCAMION", "marca": "Kenworth", "modelo": "T800",
  "numeroEjes": 3, "capacidadCargaKg": 34000, "estado": "ACTIVO",
  "createdAt": "2026-10-13T16:00:00Z", "updatedAt": "2026-10-13T16:00:00Z" }

// Error (mismo formato para 403, 409, 422)
{ "codigo": "PLACA_DUPLICADA", "mensaje": "La placa TKM482 ya está registrada." }
```

## División del trabajo

- **Backend** (rama del compañero): tablas `vehiculos` y `asignaciones_vehiculo` con `UNIQUE` en placa; CRUD con validación y normalización de placa; endpoints de habilitación, activación y vehículo activo; control de rol.
- **Frontend** (`develop-camilo`): modelo `Vehiculo` y `VehiculoService` (con datos de prueba mientras no exista la API); `fleet-page` con listado, filtro, editar y desactivar; formulario con validación de placa por tipo; mensajes de error (409, 422, sin conexión, servidor caído); pantalla de asignaciones y selector del conductor.
- Commits con `AB#23` para enlazarlos al ítem de Azure DevOps.

Diagrama de clases: `docs/diagrama-clases-sgl.mmd`.
