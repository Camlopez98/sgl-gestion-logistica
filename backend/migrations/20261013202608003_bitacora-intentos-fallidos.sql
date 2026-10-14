-- Up Migration

-- HU-18 (AB#38), escenario 13: bitácora de intentos fallidos de inicio de sesión.
-- Registro inmutable: se inserta y no se modifica (por eso no tiene updated_at).

CREATE TABLE bitacora_intentos_fallidos (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  email_ingresado VARCHAR(255) NOT NULL,
  motivo          VARCHAR(30)  NOT NULL CHECK (motivo IN ('CREDENCIALES_INVALIDAS', 'CUENTA_INACTIVA')),
  ip              VARCHAR(45),
  user_agent      VARCHAR(500),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()   -- fecha y hora del intento
);

CREATE INDEX ix_bitacora_intentos_email ON bitacora_intentos_fallidos (lower(email_ingresado));
CREATE INDEX ix_bitacora_intentos_fecha ON bitacora_intentos_fallidos (created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS bitacora_intentos_fallidos;
