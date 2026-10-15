-- Up Migration

-- HU-04 (AB#24). Asignación de vehículos a conductores (relación muchos a muchos con estado propio).
-- Una asignación nunca se elimina: se finaliza registrando su fecha de fin, para reconstruir el historial.

CREATE TYPE estado_asignacion AS ENUM ('HABILITADA', 'ACTIVA', 'FINALIZADA');

CREATE TABLE asignaciones_vehiculo (
  id                 UUID              PRIMARY KEY DEFAULT gen_random_uuid(),   -- RD-01
  conductor_id       UUID              NOT NULL REFERENCES conductores (usuario_id),
  vehiculo_id        UUID              NOT NULL REFERENCES vehiculos (id),
  -- Remolque o semirremolque acoplado. Solo tiene valor mientras la asignación está ACTIVA
  -- y se conserva al finalizar, como registro del último acople.
  remolque_id        UUID              REFERENCES vehiculos (id),
  estado             estado_asignacion NOT NULL DEFAULT 'HABILITADA',
  fecha_asignacion   TIMESTAMPTZ       NOT NULL DEFAULT now(),                  -- inicio
  fecha_activacion   TIMESTAMPTZ,                                               -- última activación
  fecha_finalizacion TIMESTAMPTZ,                                               -- fin
  -- Bloqueo optimista: cada cambio incrementa la versión (CA 19).
  version            INTEGER           NOT NULL DEFAULT 1,
  created_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),                  -- RD-03
  updated_at         TIMESTAMPTZ       NOT NULL DEFAULT now(),                  -- RD-03

  CONSTRAINT ck_asignaciones_estado_fechas CHECK (
    (estado = 'HABILITADA' AND fecha_finalizacion IS NULL)
    OR (estado = 'ACTIVA' AND fecha_activacion IS NOT NULL AND fecha_finalizacion IS NULL)
    OR (estado = 'FINALIZADA' AND fecha_finalizacion IS NOT NULL)
  ),
  CONSTRAINT ck_asignaciones_remolque_por_estado CHECK (remolque_id IS NULL OR estado IN ('ACTIVA', 'FINALIZADA')),
  CONSTRAINT ck_asignaciones_remolque_distinto CHECK (remolque_id IS NULL OR remolque_id <> vehiculo_id)
);

-- CA 2: un conductor no puede tener dos asignaciones vigentes (no finalizadas) con el mismo vehículo.
CREATE UNIQUE INDEX uq_asignaciones_vigente_conductor_vehiculo
  ON asignaciones_vehiculo (conductor_id, vehiculo_id) WHERE estado <> 'FINALIZADA';

-- Invariante 1: un conductor tiene máximo una asignación ACTIVA.
CREATE UNIQUE INDEX uq_asignaciones_activa_conductor
  ON asignaciones_vehiculo (conductor_id) WHERE estado = 'ACTIVA';

-- Invariante 2: un vehículo está en máximo una asignación ACTIVA (CA 8 y 18)...
CREATE UNIQUE INDEX uq_asignaciones_activa_vehiculo
  ON asignaciones_vehiculo (vehiculo_id) WHERE estado = 'ACTIVA';

-- ...y un remolque o semirremolque también (CA 12).
CREATE UNIQUE INDEX uq_asignaciones_activa_remolque
  ON asignaciones_vehiculo (remolque_id) WHERE estado = 'ACTIVA' AND remolque_id IS NOT NULL;

-- Consultas de historial por vehículo, por remolque y por conductor (CA 6).
CREATE INDEX ix_asignaciones_vehiculo_id ON asignaciones_vehiculo (vehiculo_id);
CREATE INDEX ix_asignaciones_remolque_id ON asignaciones_vehiculo (remolque_id) WHERE remolque_id IS NOT NULL;
CREATE INDEX ix_asignaciones_conductor_id ON asignaciones_vehiculo (conductor_id);

CREATE TRIGGER trg_asignaciones_vehiculo_updated_at BEFORE UPDATE ON asignaciones_vehiculo
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- DoD: ninguna asignación se elimina físicamente; se finaliza.
CREATE FUNCTION fn_asignaciones_vehiculo_sin_delete() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Las asignaciones de vehículo no se eliminan: se finalizan.'
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_asignaciones_vehiculo_sin_delete BEFORE DELETE ON asignaciones_vehiculo
  FOR EACH ROW EXECUTE FUNCTION fn_asignaciones_vehiculo_sin_delete();

-- Down Migration

DROP TABLE IF EXISTS asignaciones_vehiculo;
DROP FUNCTION IF EXISTS fn_asignaciones_vehiculo_sin_delete();
DROP TYPE IF EXISTS estado_asignacion;
