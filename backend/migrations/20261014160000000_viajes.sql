-- Up Migration

-- HU-05 (AB#25). Modelo de Viaje con su manifiesto y sus gastos de ruta, según el diagrama de clases.
-- La historia de registro de viajes todavía no existe: estas tablas son el contrato mínimo que HU-05 consulta.
-- Quien implemente el registro puede ampliarlas con nuevas migraciones (esta no se edita una vez en develop).
-- Las liquidaciones (saldo neto, impuestos) y las empresas pertenecen a otras historias y no se incluyen.

CREATE TYPE estado_viaje AS ENUM ('ACTIVO', 'PENDIENTE_REVISION', 'FINALIZADO');

CREATE TABLE viajes (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),   -- RD-01
  conductor_id  UUID          NOT NULL REFERENCES conductores (usuario_id),
  vehiculo_id   UUID          NOT NULL REFERENCES vehiculos (id),
  remolque_id   UUID          REFERENCES vehiculos (id),
  estado        estado_viaje  NOT NULL DEFAULT 'ACTIVO',
  origen        VARCHAR(120)  NOT NULL,
  destino       VARCHAR(120)  NOT NULL,
  valor_flete   NUMERIC(14, 2) NOT NULL CHECK (valor_flete >= 0),
  fecha_inicio  TIMESTAMPTZ   NOT NULL DEFAULT now(),
  fecha_entrega TIMESTAMPTZ,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),                  -- RD-03
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),                  -- RD-03
  CONSTRAINT ck_viajes_remolque_distinto CHECK (remolque_id IS NULL OR remolque_id <> vehiculo_id),
  CONSTRAINT ck_viajes_entrega_posterior CHECK (fecha_entrega IS NULL OR fecha_entrega >= fecha_inicio)
);

-- Historial del conductor (HU-05): orden cronológico descendente con desempate por id (paginación por cursor).
CREATE INDEX ix_viajes_conductor_historial ON viajes (conductor_id, fecha_inicio DESC, id DESC);
CREATE INDEX ix_viajes_conductor_estado ON viajes (conductor_id, estado);

CREATE TRIGGER trg_viajes_updated_at BEFORE UPDATE ON viajes
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Un viaje tiene un único manifiesto de carga (foto del documento).
CREATE TABLE manifiestos_carga (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),   -- RD-01
  viaje_id          UUID         NOT NULL UNIQUE REFERENCES viajes (id),
  numero_manifiesto VARCHAR(40)  NOT NULL,
  url_imagen        TEXT         NOT NULL,
  tipo_mime         VARCHAR(60)  NOT NULL,
  tamano_bytes      INTEGER      NOT NULL CHECK (tamano_bytes > 0),
  fecha_carga       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),                  -- RD-03
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()                   -- RD-03
);

CREATE TRIGGER trg_manifiestos_carga_updated_at BEFORE UPDATE ON manifiestos_carga
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE gastos_ruta (
  id           UUID            PRIMARY KEY DEFAULT gen_random_uuid(),   -- RD-01
  viaje_id     UUID            NOT NULL REFERENCES viajes (id),
  tipo         VARCHAR(40)     NOT NULL,
  monto        NUMERIC(14, 2)  NOT NULL CHECK (monto > 0),
  concepto     VARCHAR(200)    NOT NULL,
  url_soporte  TEXT,
  created_at   TIMESTAMPTZ     NOT NULL DEFAULT now(),                  -- RD-03
  updated_at   TIMESTAMPTZ     NOT NULL DEFAULT now()                   -- RD-03
);

CREATE INDEX ix_gastos_ruta_viaje ON gastos_ruta (viaje_id, created_at);

CREATE TRIGGER trg_gastos_ruta_updated_at BEFORE UPDATE ON gastos_ruta
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS gastos_ruta;
DROP TABLE IF EXISTS manifiestos_carga;
DROP TABLE IF EXISTS viajes;
DROP TYPE IF EXISTS estado_viaje;
