# HU-05 Como conductor, quiero consultar el historial de mis viajes para verificar mi información.

**Azure DevOps:** Product Backlog Item 25 · Prioridad 2 · Área: Arquitectura de software
**Responsable:** compañero (backend y frontend)
**Requisitos del SRS:** RF-07, RF-08, RNF-04, RNF-05, RNF-06, RS-04
**Depende de:** HU-18 (inicio de sesión y roles) y la historia de registro de viajes

## Descripción

El sistema debe ofrecer al conductor una vista web de solo lectura, optimizada para el navegador del celular, con el historial de los viajes que él registró. La vista muestra primero los 5 más recientes con la opción "ver más", permite filtrar por rango de fechas y estado, y abrir el detalle de cada viaje (datos, foto del manifiesto y gastos de ruta). No incluye gráficas, exportación ni opciones de edición. Sin conexión, muestra la última versión guardada en el dispositivo e indica que puede no estar actualizada; esos datos se borran al cerrar sesión.

## Definition of Ready

- Vista de historial móvil y vista de detalle del viaje diseñadas y aprobadas.
- Campos del listado y del detalle, criterio de orden y tamaño de cada bloque de "ver más" definidos.
- Estrategia de caché sin conexión definida: tecnología (por ejemplo, PWA con *service worker* o almacenamiento local), qué datos se guardan y cuándo se borran.
- Modelo de *Viaje* y registro de viajes disponibles o con contrato acordado; control de roles de HU-18 disponible.

## Definition of Done

- El conductor visualiza únicamente sus propios viajes, validado con distintos usuarios de prueba y con peticiones directas al servidor.
- La priorización de los 5 viajes recientes, "ver más", los filtros y el detalle del viaje fueron probados.
- Se validó el comportamiento sin conexión (con caché, sin caché y pérdida de conexión durante la carga).
- Se verificó que los datos guardados en el dispositivo se borran al cerrar sesión.
- La vista funciona en navegadores móviles sin instalar una aplicación nativa (RNF-05).

## Criterios de aceptación

### Consulta del historial
1. Dado que el conductor inició sesión, Cuando accede a su historial de viajes, Entonces el sistema debe mostrar únicamente los viajes registrados por ese conductor.
2. Dado que el conductor tiene más de 5 viajes registrados, Cuando ingresa a su historial, Entonces el sistema debe mostrar por defecto los 5 más recientes, con una opción visible de "ver más".
3. Dado que el conductor presiona "ver más", Cuando el sistema carga los registros adicionales, Entonces debe agregar el siguiente bloque en orden cronológico descendente, sin repetir los ya mostrados.
4. Dado que el conductor aún no ha registrado viajes, Cuando ingresa a su historial, Entonces el sistema debe mostrar un mensaje indicando que todavía no tiene viajes, en lugar de una lista vacía.
5. Dado que el conductor aplica un filtro por rango de fechas, por estado del viaje o por ambos, Cuando confirma el filtro, Entonces la lista debe mostrar solo los viajes que cumplen el criterio.
6. Dado que el conductor selecciona un viaje del historial, Cuando abre su detalle, Entonces el sistema debe mostrar estado, origen, destino, valor del flete, fechas, foto del manifiesto y gastos de ruta, sin opciones de edición ni eliminación.
7. Dado que el conductor está en su historial, Cuando busca opciones de gráficas o exportación a Excel, Entonces el sistema no debe ofrecerlas, por ser exclusivas de los módulos del Administrador y del Contador.

### Seguridad
8. Dado que un conductor envía directamente al servidor una solicitud para consultar un viaje de otro conductor, Cuando el servidor la procesa, Entonces debe rechazarla sin revelar información de ese viaje.
9. Dado que un conductor cerró sesión en un dispositivo compartido, Cuando otro usuario inicia sesión en ese dispositivo, Entonces no debe poder ver los datos guardados del conductor anterior.

### Sin conexión
10. Dado que el conductor no tiene conexión a internet, Cuando accede a su historial, Entonces el sistema debe mostrar la última versión guardada e indicar la fecha y hora de la última actualización.
11. Dado que el conductor presiona "ver más", Cuando la conexión se pierde durante la carga, Entonces el sistema debe mostrar un mensaje de error de conexión y permitir reintentar sin perder lo ya cargado en pantalla.
12. Dado que el conductor nunca ha cargado su historial y no tiene conexión, Cuando accede a la vista, Entonces el sistema debe indicar que no hay datos disponibles sin conexión, en lugar de una pantalla en blanco o un error técnico.
13. Dado que el conductor estaba viendo datos guardados sin conexión, Cuando recupera la conexión y actualiza la vista, Entonces el sistema debe cargar la información actual y quitar el aviso de datos desactualizados.

El bloqueo del acceso del conductor al panel del Administrador (antiguo escenario 5) está cubierto por HU-18, escenario 8.

## Contrato de API (propuesta)

| Método | Endpoint | Uso | Respuestas clave |
|---|---|---|---|
| GET | `/api/conductores/me/viajes?limite=5&cursor=...&estado=...&desde=...&hasta=...` | Historial paginado y filtrado | 200 |
| GET | `/api/conductores/me/viajes/{id}` | Detalle de un viaje propio | 200 · 404 si no existe o no es suyo |

```json
// 200 GET /api/conductores/me/viajes?limite=5
{ "items": [ { "id": "a1b2...", "estado": "PENDIENTE_REVISION", "origen": "Bogotá", "destino": "Cali",
               "valorFlete": 3200000, "fechaInicio": "2026-10-10T08:00:00Z", "placaVehiculo": "TKM482" } ],
  "siguienteCursor": "eyJmZWNoYS...", "total": 23 }
```

Commits con `AB#25`.
