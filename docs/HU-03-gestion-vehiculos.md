# HU-03 Como administrador, quiero gestionar los vehículos de la flota para mantener su registro actualizado y confiable.

**Azure DevOps:** Product Backlog Item 23 · Prioridad 2 · Área: Arquitectura de software
**Responsable:** Camilo (backend y frontend)
**Relacionada con:** HU-04 (asignación de vehículos a conductores, a cargo del compañero)

## Descripción

El sistema debe permitir al administrador crear, consultar, editar y desactivar vehículos (furgón, camión, tractocamión, remolque y semirremolque). Por cada uno almacena placa, tipo, marca, modelo, número de ejes, capacidad de carga y estado (activo/inactivo). La placa es única y debe cumplir el formato legal según el tipo: AAA999 para automotores, R99999 para remolques y S99999 para semirremolques. Un vehículo inactivo no se elimina físicamente; se conserva en el histórico y deja de estar disponible para nuevas asignaciones. El sistema debe manejar las fallas de conexión o de servidor sin generar duplicados ni pérdida de información.

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Formato de placa | FURGON, CAMION, TRACTOCAMION: `^[A-Z]{3}[0-9]{3}$` · REMOLQUE: `^R[0-9]{5}$` · SEMIRREMOLQUE: `^S[0-9]{5}$` |
| Normalización | El servidor convierte la placa a mayúsculas y elimina espacios y guiones antes de validar. |
| Unicidad | Restricción `UNIQUE` en BD + validación en servidor (al registrar y al editar). |
| Desactivación | Nunca se borra; `estado = INACTIVO`. No se puede desactivar un vehículo en un viaje `ACTIVO`. |
| Seguridad | Solo el Administrador gestiona vehículos; el servidor valida el rol en cada petición (RS-04). |

Las reglas de habilitación, activación y acople de remolques están en HU-04.

## Definition of Ready

- Modelo de datos de *Vehículo* definido en el diagrama de clases, con sus tipos y estados.
- Reglas de validación de placa por tipo de vehículo (formato, normalización y unicidad) aprobadas por el equipo.
- RF-11 actualizado en el SRS (registrar, consultar, editar y desactivar).
- Manejo de errores de red y de servidor en el panel administrativo definido.

## Definition of Done

- El CRUD de vehículos fue probado, incluido el rechazo de placas duplicadas y de placas con formato inválido para su tipo.
- Se verificó que los vehículos inactivos no se eliminan y permanecen en el histórico.
- Se verificó que solo el Administrador puede gestionar vehículos, también con peticiones directas al servidor.
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

### Fallas de red y servidor
8. (Sin conexión) Dado que el administrador pierde la conexión mientras registra un vehículo, Cuando intenta guardar, Entonces el sistema debe informar que no hay conexión y no guardar un registro incompleto.
9. (Caída del servidor) Dado que el servidor no responde o devuelve un error al registrar un vehículo, Cuando el administrador reintenta la operación, Entonces el sistema no debe duplicar el vehículo.
10. (Conexión intermitente) Dado que la solicitud de registro se interrumpe a mitad de camino, Cuando el cliente la reenvía automáticamente, Entonces el servidor debe validar la unicidad de la placa antes de confirmar.

## Contrato de API (propuesta)

| Método | Endpoint | Uso | Respuestas clave |
|---|---|---|---|
| POST | `/api/vehiculos` | Registrar | 201 · 409 placa duplicada · 422 formato inválido |
| GET | `/api/vehiculos?estado=ACTIVO&tipo=TRACTOCAMION` | Consultar con filtros | 200 |
| GET | `/api/vehiculos/{id}` | Detalle | 200 · 404 |
| PUT | `/api/vehiculos/{id}` | Editar | 200 · 409 placa duplicada · 422 formato inválido |
| PATCH | `/api/vehiculos/{id}/desactivar` | Desactivar | 200 · 409 vehículo en viaje activo |

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

## Trabajo

- **Backend:** tabla `vehiculos` con `UNIQUE` en placa; CRUD con validación y normalización de placa por tipo; desactivación lógica; control de rol con el middleware de HU-18.
- **Frontend:** modelo `Vehiculo` y `VehiculoService`; `fleet-page` con listado, filtro, editar y desactivar; formulario con validación de placa por tipo; mensajes de error (409, 422, sin conexión, servidor caído).
- Commits con `AB#23`.

Diagrama de clases: `docs/diagrama-clases-sgl.mmd`.
