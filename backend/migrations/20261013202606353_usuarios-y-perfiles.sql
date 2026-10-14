-- Up Migration

-- HU-18 (AB#38). Usuarios del sistema y perfil propio de cada rol (diagrama de clases: Rol y sus subclases).
-- Patrón Class Table Inheritance: datos comunes en "usuarios" y datos específicos en una tabla por rol.

CREATE TYPE rol_usuario AS ENUM ('CONDUCTOR', 'ADMINISTRADOR', 'CONTADOR');

CREATE TABLE usuarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),           -- RD-01
  cedula          VARCHAR(20)  NOT NULL,
  nombre_completo VARCHAR(150) NOT NULL,
  email           VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,                                -- solo hash bcrypt, nunca texto plano
  rol             rol_usuario  NOT NULL,
  estado_activo   BOOLEAN      NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),                  -- RD-03
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),                  -- RD-03
  CONSTRAINT uq_usuarios_cedula UNIQUE (cedula),
  -- Permite que cada perfil referencie (id, rol) y garantice que coincide con su rol.
  CONSTRAINT uq_usuarios_id_rol UNIQUE (id, rol)
);

-- El correo es único sin importar mayúsculas o minúsculas.
CREATE UNIQUE INDEX uq_usuarios_email ON usuarios (lower(email));

CREATE TRIGGER trg_usuarios_updated_at BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE conductores (
  usuario_id         UUID        PRIMARY KEY,
  rol                rol_usuario NOT NULL DEFAULT 'CONDUCTOR' CHECK (rol = 'CONDUCTOR'),
  numero_licencia    VARCHAR(30) NOT NULL,
  categoria_licencia VARCHAR(5)  NOT NULL,
  telefono_contacto  VARCHAR(20),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_conductores_numero_licencia UNIQUE (numero_licencia),
  CONSTRAINT fk_conductores_usuario FOREIGN KEY (usuario_id, rol) REFERENCES usuarios (id, rol)
);

CREATE TRIGGER trg_conductores_updated_at BEFORE UPDATE ON conductores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE administradores (
  usuario_id      UUID         PRIMARY KEY,
  rol             rol_usuario  NOT NULL DEFAULT 'ADMINISTRADOR' CHECK (rol = 'ADMINISTRADOR'),
  cargo_directivo VARCHAR(100),
  departamento    VARCHAR(100),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CONSTRAINT fk_administradores_usuario FOREIGN KEY (usuario_id, rol) REFERENCES usuarios (id, rol)
);

CREATE TRIGGER trg_administradores_updated_at BEFORE UPDATE ON administradores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE contadores (
  usuario_id          UUID        PRIMARY KEY,
  rol                 rol_usuario NOT NULL DEFAULT 'CONTADOR' CHECK (rol = 'CONTADOR'),
  tarjeta_profesional VARCHAR(30),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT fk_contadores_usuario FOREIGN KEY (usuario_id, rol) REFERENCES usuarios (id, rol)
);

CREATE TRIGGER trg_contadores_updated_at BEFORE UPDATE ON contadores
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS contadores;
DROP TABLE IF EXISTS administradores;
DROP TABLE IF EXISTS conductores;
DROP TABLE IF EXISTS usuarios;
DROP TYPE IF EXISTS rol_usuario;
