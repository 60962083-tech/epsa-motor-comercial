BEGIN;

ALTER TABLE public.ubicacion
  ADD COLUMN IF NOT EXISTS telubi varchar(40) NULL;

-- Normalize values from authenticated direct table writes as well as the HTTP API.
CREATE OR REPLACE FUNCTION public.emt97_normalizar_telubi()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.telubi IS NOT NULL THEN
    NEW.telubi := NULLIF(
      pg_catalog.regexp_replace(NEW.telubi, '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      ''
    );
  END IF;
  RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.emt97_normalizar_telubi() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS emt97_normalizar_telubi ON public.ubicacion;
CREATE TRIGGER emt97_normalizar_telubi
  BEFORE INSERT OR UPDATE OF telubi ON public.ubicacion
  FOR EACH ROW EXECUTE FUNCTION public.emt97_normalizar_telubi();

ALTER TABLE public.ubicacion
  DROP CONSTRAINT IF EXISTS chk_ubicacion_telubi_formato;
ALTER TABLE public.ubicacion
  ADD CONSTRAINT chk_ubicacion_telubi_formato CHECK (
    telubi IS NULL OR (
      telubi <> ''
      AND pg_catalog.char_length(telubi) <= 40
      AND telubi = pg_catalog.btrim(telubi)
      AND telubi ~ '^[+]?[0-9 ()-]+$'
      AND pg_catalog.char_length(
        pg_catalog.regexp_replace(telubi, '[^0-9]', '', 'g')
      ) BETWEEN 7 AND 15
    )
  );

COMMENT ON COLUMN public.ubicacion.telubi IS
  'Contacto telefónico interno opcional de la ubicación; no es el teléfono público sede.telsed.';

COMMIT;
