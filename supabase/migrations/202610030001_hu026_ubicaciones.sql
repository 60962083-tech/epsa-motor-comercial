BEGIN;

-- Aplicar sobre el esquema base compartido. No elimina tablas ni historial.
CREATE OR REPLACE FUNCTION public.hu026_nombre_normalizado(nombre text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path = ''
AS $$ SELECT lower(btrim(regexp_replace(nombre, '[[:space:]]+', ' ', 'g'))) $$;

-- Si existen duplicados normalizados, la migración falla y revierte; resolverlos sin borrar historial.
DROP INDEX IF EXISTS public.uq_ubicacion_nombre_normalizado;
CREATE UNIQUE INDEX uq_ubicacion_nombre_normalizado
ON public.ubicacion (public.hu026_nombre_normalizado(nomubi));
ALTER TABLE public.ubicacion DROP CONSTRAINT IF EXISTS chk_ubicacion_nombre_no_vacio;
ALTER TABLE public.ubicacion ADD CONSTRAINT chk_ubicacion_nombre_no_vacio
CHECK (public.hu026_nombre_normalizado(nomubi) <> '');

-- Los movimientos históricos se interpretan como ya finalizados.
ALTER TABLE public.movimientoubicacion ADD COLUMN IF NOT EXISTS estmub varchar(20) NOT NULL DEFAULT 'Finalizado';
ALTER TABLE public.movimientoubicacion DROP CONSTRAINT IF EXISTS chk_movubicacion_estado;
ALTER TABLE public.movimientoubicacion ADD CONSTRAINT chk_movubicacion_estado
CHECK (estmub IN ('Pendiente', 'En transito', 'Finalizado', 'Cancelado'));
CREATE INDEX IF NOT EXISTS ix_unidad_ubicacion ON public.unidad(codubi);
CREATE INDEX IF NOT EXISTS ix_movimiento_origen_activo ON public.movimientoubicacion(codubiori)
WHERE estmub IN ('Pendiente', 'En transito');
CREATE INDEX IF NOT EXISTS ix_movimiento_destino_activo ON public.movimientoubicacion(codubides)
WHERE estmub IN ('Pendiente', 'En transito');

CREATE OR REPLACE FUNCTION public.hu026_rol_actual()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT r.nomrol::text FROM public.usuario u JOIN public.rol r ON r.codrol = u.codrol
  WHERE u.uuidusu = auth.uid() AND u.estusu AND r.estrol
$$;
REVOKE ALL ON FUNCTION public.hu026_rol_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hu026_rol_actual() TO authenticated;

-- Evitar que un cliente se conceda el rol de gerente o reactive su cuenta.
-- El alta y la administración de roles/usuarios quedan a cargo del backend de HU-007 o del SQL administrativo.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.usuario, public.rol FROM anon, authenticated;

ALTER TABLE public.ubicacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ubicacion FROM anon;
REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.ubicacion FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ubicacion TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.ubicacion_codubi_seq TO authenticated;
DROP POLICY IF EXISTS ubicacion_insert_anon ON public.ubicacion;
DROP POLICY IF EXISTS ubicacion_select_anon ON public.ubicacion;
DROP POLICY IF EXISTS ubicacion_update_anon ON public.ubicacion;

DROP POLICY IF EXISTS hu026_lectura ON public.ubicacion;
CREATE POLICY hu026_lectura ON public.ubicacion FOR SELECT TO authenticated
USING ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora', 'Vendedor'));
DROP POLICY IF EXISTS hu026_alta ON public.ubicacion;
CREATE POLICY hu026_alta ON public.ubicacion FOR INSERT TO authenticated
WITH CHECK ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'));
DROP POLICY IF EXISTS hu026_edicion ON public.ubicacion;
CREATE POLICY hu026_edicion ON public.ubicacion FOR UPDATE TO authenticated
USING ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'))
WITH CHECK ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'));

-- Guardas restrictivas: otras políticas permisivas anteriores no amplían estos permisos.
DROP POLICY IF EXISTS hu026_limite_lectura ON public.ubicacion;
CREATE POLICY hu026_limite_lectura ON public.ubicacion AS RESTRICTIVE FOR SELECT TO authenticated
USING ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora', 'Vendedor'));
DROP POLICY IF EXISTS hu026_limite_alta ON public.ubicacion;
CREATE POLICY hu026_limite_alta ON public.ubicacion AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'));
DROP POLICY IF EXISTS hu026_limite_edicion ON public.ubicacion;
CREATE POLICY hu026_limite_edicion ON public.ubicacion AS RESTRICTIVE FOR UPDATE TO authenticated
USING ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'))
WITH CHECK ((SELECT public.hu026_rol_actual()) IN ('Gerente', 'Administradora'));

CREATE OR REPLACE FUNCTION public.hu026_impedir_desactivacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT NEW.estubi AND (
    EXISTS (SELECT 1 FROM public.unidad WHERE codubi = OLD.codubi)
    OR EXISTS (SELECT 1 FROM public.movimientoubicacion
      WHERE (codubiori = OLD.codubi OR codubides = OLD.codubi)
      AND estmub IN ('Pendiente', 'En transito'))
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Resolver unidades o traslados activos antes de desactivar';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hu026_desactivacion ON public.ubicacion;
CREATE TRIGGER hu026_desactivacion BEFORE UPDATE OF estubi ON public.ubicacion
FOR EACH ROW EXECUTE FUNCTION public.hu026_impedir_desactivacion();

CREATE OR REPLACE FUNCTION public.hu026_validar_asignacion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE estado boolean;
BEGIN
  IF NEW.codubi IS NOT NULL THEN
    -- El bloqueo se comparte con UPDATE de ubicación hasta terminar la transacción.
    SELECT estubi INTO estado FROM public.ubicacion WHERE codubi = NEW.codubi FOR UPDATE;
    IF estado IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'La ubicación debe estar activa';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hu026_asignacion ON public.unidad;
CREATE TRIGGER hu026_asignacion BEFORE INSERT OR UPDATE OF codubi ON public.unidad
FOR EACH ROW EXECUTE FUNCTION public.hu026_validar_asignacion();

CREATE OR REPLACE FUNCTION public.hu026_validar_movimiento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lugar record;
BEGIN
  -- Cerrar/cancelar un traslado conserva la historia. Crear o cambiar sus lugares exige ubicaciones activas.
  IF TG_OP = 'INSERT' OR NEW.estmub IN ('Pendiente', 'En transito')
     OR NEW.codubiori IS DISTINCT FROM OLD.codubiori OR NEW.codubides IS DISTINCT FROM OLD.codubides THEN
    FOR lugar IN SELECT codubi, estubi FROM public.ubicacion
      WHERE codubi IN (NEW.codubiori, NEW.codubides) ORDER BY codubi FOR UPDATE
    LOOP
      IF NOT lugar.estubi THEN
        RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'El origen y destino deben estar activos';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS hu026_movimiento ON public.movimientoubicacion;
CREATE TRIGGER hu026_movimiento BEFORE INSERT OR UPDATE OF codubiori, codubides, estmub ON public.movimientoubicacion
FOR EACH ROW EXECUTE FUNCTION public.hu026_validar_movimiento();
REVOKE ALL ON FUNCTION public.hu026_impedir_desactivacion(), public.hu026_validar_asignacion(), public.hu026_validar_movimiento() FROM PUBLIC, anon, authenticated;

-- Corregir la variante sin tilde conservando el identificador y las referencias.
UPDATE public.ubicacion SET nomubi = 'Crossland Ancón'
WHERE public.hu026_nombre_normalizado(nomubi) = 'crossland ancon'
AND NOT EXISTS (SELECT 1 FROM public.ubicacion WHERE public.hu026_nombre_normalizado(nomubi) = 'crossland ancón');
INSERT INTO public.ubicacion(nomubi, tipubi, dirubi, estubi) VALUES
('Ventanilla', 'Sede', NULL, TRUE), ('Comas', 'Sede', NULL, TRUE),
('Puente Piedra', 'Sede', NULL, TRUE), ('Crossland Ancón', 'Almacen', NULL, TRUE),
('FIVESA', 'Proveedor', NULL, TRUE), ('JAVICAR', 'Proveedor', NULL, TRUE), ('FIBRAT', 'Proveedor', NULL, TRUE)
ON CONFLICT (public.hu026_nombre_normalizado(nomubi)) DO NOTHING;
COMMIT;
