-- Up Migration

-- HU-03 (AB#23). Vehículos de la flota. Nunca se eliminan: se desactivan (estado = 'INACTIVO').

CREATE TYPE tipo_vehiculo AS ENUM ('FURGON', 'CAMION', 'TRACTOCAMION', 'REMOLQUE', 'SEMIRREMOLQUE');
CREATE TYPE estado_vehiculo AS ENUM ('ACTIVO', 'INACTIVO');

CREATE TABLE vehiculos (
  id                 UUID            PRIMARY KEY DEFAULT gen_random_uuid(),   -- RD-01
  placa              VARCHAR(10)     NOT NULL,
  tipo               tipo_vehiculo   NOT NULL,
  marca              VARCHAR(60)     NOT NULL,
  modelo             VARCHAR(60)     NOT NULL,
  numero_ejes        SMALLINT        NOT NULL CHECK (numero_ejes BETWEEN 1 AND 12),
  capacidad_carga_kg NUMERIC(10, 2)  NOT NULL CHECK (capacidad_carga_kg > 0),
  estado             estado_vehiculo NOT NULL DEFAULT 'ACTIVO',
  created_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),                   -- RD-03
  updated_at         TIMESTAMPTZ     NOT NULL DEFAULT now(),                   -- RD-03
  CONSTRAINT uq_vehiculos_placa UNIQUE (placa),
  -- Segunda barrera: la placa llega normalizada (mayúsculas, sin espacios ni guiones)
  -- y con el formato legal de su tipo. La validación principal está en el servidor.
  CONSTRAINT ck_vehiculos_placa_por_tipo CHECK (
    (tipo IN ('FURGON', 'CAMION', 'TRACTOCAMION') AND placa ~ '^[A-Z]{3}[0-9]{3}$')
    OR (tipo = 'REMOLQUE' AND placa ~ '^R[0-9]{5}$')
    OR (tipo = 'SEMIRREMOLQUE' AND placa ~ '^S[0-9]{5}$')
  )
);

CREATE INDEX ix_vehiculos_estado_tipo ON vehiculos (estado, tipo);

CREATE TRIGGER trg_vehiculos_updated_at BEFORE UPDATE ON vehiculos
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS vehiculos;
DROP TYPE IF EXISTS estado_vehiculo;
DROP TYPE IF EXISTS tipo_vehiculo;
