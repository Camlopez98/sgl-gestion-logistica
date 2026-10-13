-- Up Migration

-- Función reutilizable por todas las tablas: mantiene updated_at al día en cada UPDATE (RD-03).
-- Uso en cada tabla:
--   CREATE TRIGGER trg_<tabla>_updated_at BEFORE UPDATE ON <tabla>
--   FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Down Migration

DROP FUNCTION IF EXISTS fn_set_updated_at();
