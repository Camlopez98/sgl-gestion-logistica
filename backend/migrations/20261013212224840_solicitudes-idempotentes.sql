-- Up Migration

-- Solicitudes idempotentes (HU-03 escenarios 9 y 10; reutilizable en HU-04 escenario 17).
-- Guarda la respuesta de una solicitud identificada por el encabezado Idempotency-Key
-- para que un reintento devuelva el mismo resultado en lugar de repetir la operación.

CREATE TABLE solicitudes_idempotentes (
  usuario_id       UUID         NOT NULL REFERENCES usuarios (id),
  clave            VARCHAR(100) NOT NULL,
  metodo           VARCHAR(10)  NOT NULL,
  ruta             VARCHAR(255) NOT NULL,
  huella_cuerpo    CHAR(64)     NOT NULL,                -- SHA-256 del cuerpo de la solicitud
  estado           VARCHAR(12)  NOT NULL CHECK (estado IN ('EN_PROCESO', 'COMPLETADA')),
  status_respuesta SMALLINT,
  cuerpo_respuesta JSONB,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (usuario_id, clave)
);

-- Permite depurar registros antiguos (por ejemplo, de más de 24 horas).
CREATE INDEX ix_solicitudes_idempotentes_fecha ON solicitudes_idempotentes (created_at);

CREATE TRIGGER trg_solicitudes_idempotentes_updated_at BEFORE UPDATE ON solicitudes_idempotentes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS solicitudes_idempotentes;
