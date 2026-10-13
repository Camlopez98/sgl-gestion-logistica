# HU-04 Como administrador, quiero asignar vehículos a los conductores para mantener la trazabilidad de quién opera la flota.

**Azure DevOps:** Product Backlog Item 24 · Prioridad 2 · Área: Arquitectura de software
**Responsable:** compañero (backend y frontend de asignaciones)
**Depende de:** HU-18 (inicio de sesión y roles) y HU-03 (gestión de vehículos)

## Descripción

El sistema debe permitir al administrador habilitar uno o varios vehículos a un conductor, según los vehículos que sabe manejar, y activar uno de ellos para el viaje actual, con su remolque o semirremolque acoplado cuando aplique. Cada asignación registra sus fechas de inicio, activación y finalización, y nunca se elimina, para reconstruir el historial de qué conductor operó cada vehículo. Al crear un manifiesto, el conductor solo puede seleccionar su vehículo activo; si no tiene uno, no puede iniciar el manifiesto. El sistema debe garantizar la integridad de las asignaciones ante fallas de red y operaciones concurrentes.

## Reglas de negocio

| Regla | Detalle |
|---|---|
| Estados de la asignación | `HABILITADA` (puede manejarlo) · `ACTIVA` (lo usa en el viaje actual) · `FINALIZADA` (ya no puede manejarlo). |
| Invariante 1 | Un conductor tiene máximo una asignación `ACTIVA`; al activar otra, la anterior vuelve a `HABILITADA`. |
| Invariante 2 | Un vehículo o remolque está en máximo una asignación `ACTIVA`. |
| Invariante 3 | No se cambia ni se finaliza la asignación activa de un conductor con un viaje `ACTIVO`. |
| Acople | CAMION admite REMOLQUE; TRACTOCAMION admite SEMIRREMOLQUE. Solo se habilitan vehículos automotores. |
| Elegibilidad | Solo se habilitan o activan vehículos y conductores con estado activo. |
| Historial | Las asignaciones no se eliminan físicamente; se finalizan registrando la fecha de fin. |
| Seguridad | Solo el Administrador gestiona asignaciones; el servidor valida el vehículo activo del conductor en cada manifiesto (RS-04). |

## Definition of Ready

- Relación Conductor–Vehículo definida como muchos a muchos mediante *AsignacionVehiculo*, con sus estados, en el diagrama de clases.
- Reglas de activación, acople e invariantes aprobadas por el equipo.
- Fechas de la asignación (inicio, activación y finalización) definidas.
- Mecanismo de control de concurrencia y manejo de fallas de red definidos.
- Modelo de usuario y control de roles (HU-18) y modelo de vehículo (HU-03) disponibles o con contrato acordado.

## Definition of Done

- La habilitación, activación, finalización e historial de asignaciones fueron probados con casos reales.
- Las tres invariantes fueron probadas, incluidos los casos de rechazo.
- El selector del conductor fue validado desde su flujo y en el servidor; un conductor sin vehículo activo no puede iniciar un manifiesto.
- Se probaron la concurrencia y la falla del servidor sin generar asignaciones duplicadas ni datos inconsistentes.
- Se verificó que ninguna asignación se elimina físicamente.

## Criterios de aceptación

### Habilitación y finalización
1. Dado que el administrador habilita un vehículo activo a un conductor activo, Cuando confirma la operación, Entonces el sistema debe crear la asignación en estado "habilitada" y registrar su fecha de inicio.
2. Dado que ya existe una asignación vigente entre ese conductor y ese vehículo, Cuando el administrador intenta crearla de nuevo, Entonces el sistema debe advertir que ya existe y no duplicarla.
3. Dado que el vehículo o el conductor están inactivos, Cuando el administrador intenta habilitarlos, Entonces el sistema debe rechazar la operación e indicar el motivo.
4. Dado que el administrador finaliza una asignación, Cuando confirma la finalización, Entonces el sistema debe registrar la fecha de fin sin eliminar el registro histórico.
5. Dado que el conductor tiene un viaje en estado "Activo" con ese vehículo, Cuando el administrador intenta finalizar la asignación, Entonces el sistema debe rechazar la operación.
6. Dado que el administrador consulta el historial de un vehículo, Cuando visualiza sus asignaciones, Entonces debe ver todos los conductores que lo han tenido asignado, con sus fechas de inicio y fin.

### Activación
7. Dado que un conductor tiene varios vehículos habilitados, Cuando el administrador activa uno de ellos, Entonces ese vehículo debe quedar "activo" con su fecha de activación, y el que estaba activo antes debe volver a "habilitado".
8. Dado que un vehículo está activo con un conductor, Cuando el administrador intenta activarlo para otro conductor, Entonces el sistema debe rechazar la operación e indicar con qué conductor está activo.
9. Dado que un conductor tiene un viaje en estado "Activo", Cuando el administrador intenta cambiarle el vehículo activo, Entonces el sistema debe rechazar la operación hasta que el viaje se reporte como entregado.

### Remolques y semirremolques
10. Dado que el administrador activa un tractocamión, Cuando le acopla un semirremolque disponible, Entonces ambos deben quedar registrados en la asignación activa.
11. Dado que el administrador activa un camión, Cuando intenta acoplarle un semirremolque, Entonces el sistema debe rechazar la operación, porque un camión solo admite remolque.
12. Dado que un semirremolque ya está acoplado en una asignación activa, Cuando el administrador intenta acoplarlo a otro tractocamión, Entonces el sistema debe rechazar la operación.

### Selector del conductor
13. Dado que un conductor tiene un vehículo activo, Cuando inicia el registro de un manifiesto, Entonces el selector debe mostrar solo ese vehículo y su remolque acoplado, si lo tiene.
14. Dado que un conductor no tiene un vehículo activo, o su vehículo activo fue desactivado, Cuando intenta iniciar un manifiesto, Entonces el sistema debe impedirlo e indicar que necesita un vehículo asignado.
15. Dado que un conductor envía directamente al servidor un manifiesto con un vehículo que no tiene activado, Cuando el servidor procesa la solicitud, Entonces debe rechazarla con un error de autorización.

### Fallas de red y concurrencia
16. (Sin conexión) Dado que el administrador pierde la conexión mientras crea una asignación, Cuando intenta confirmar, Entonces el sistema debe informar la falta de conexión y no registrar una asignación parcial.
17. (Falla del servidor) Dado que el servidor falla al procesar una asignación, Cuando el administrador reintenta la operación, Entonces el sistema no debe generar asignaciones duplicadas.
18. (Activación simultánea) Dado que dos administradores intentan activar el mismo vehículo para conductores distintos casi al mismo tiempo, Cuando ambos confirman, Entonces el sistema debe aplicar solo la primera y rechazar la segunda.
19. (Edición simultánea) Dado que dos administradores modifican la misma asignación casi al mismo tiempo, Cuando el segundo confirma su cambio, Entonces el sistema debe rechazarlo si el registro ya fue modificado e indicarle que recargue la información.

## Contrato de API (propuesta)

| Método | Endpoint | Uso | Respuestas clave |
|---|---|---|---|
| POST | `/api/asignaciones` | Habilitar vehículo a conductor | 201 · 409 ya existe · 422 vehículo o conductor inactivo |
| PATCH | `/api/asignaciones/{id}/activar` | Activar (cuerpo opcional `{ "idRemolque": "..." }`) | 200 · 409 activo con otro conductor / viaje activo / remolque ocupado · 422 remolque incompatible |
| PATCH | `/api/asignaciones/{id}/finalizar` | Finalizar | 200 · 409 viaje activo |
| GET | `/api/vehiculos/{id}/asignaciones` | Historial del vehículo | 200 |
| GET | `/api/conductores/me/vehiculo-activo` | Selector del conductor | 200 · 404 sin vehículo activo |

Concurrencia sugerida: columna `version` en la asignación (bloqueo optimista) y restricción única parcial en BD para impedir dos asignaciones `ACTIVA` del mismo vehículo, del mismo remolque o del mismo conductor.

Commits con `AB#24`.
