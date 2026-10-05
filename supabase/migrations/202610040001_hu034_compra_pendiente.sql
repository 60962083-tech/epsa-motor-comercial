BEGIN;
-- Ejecutar después de HU-026 sobre el esquema existente. No crea ni modifica unidades.
ALTER TABLE public.compra ADD COLUMN IF NOT EXISTS idempotencia uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_compra_idempotencia ON public.compra(idempotencia);
ALTER TABLE public.compra DROP CONSTRAINT IF EXISTS chk_compra_color_no_vacio;
ALTER TABLE public.compra ADD CONSTRAINT chk_compra_color_no_vacio
CHECK (btrim(regexp_replace(colcom, '[[:space:]]+', ' ', 'g')) <> '');

-- La API de compras se expone exclusivamente mediante funciones con campos explícitos.
-- Evita eludir autor automático, idempotencia o privacidad mediante REST directo a la tabla.
ALTER TABLE public.compra ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.compra FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.compra_codcom_seq FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS hu034_solo_funciones ON public.compra;
CREATE POLICY hu034_solo_funciones ON public.compra AS RESTRICTIVE FOR ALL TO PUBLIC
USING (false) WITH CHECK (false);

-- Helper privado: nunca devolver c.* ni observaciones, claves o documentos privados.
CREATE OR REPLACE FUNCTION public.hu034_detalle_interno(p_codcom bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'codcom', c.codcom::text, 'codmod', c.codmod::text, 'nommod', m.nommod,
    'colcom', c.colcom, 'cancom', c.cancom,
    'cantidad_pendiente', greatest(c.cancom::bigint - (SELECT count(*) FROM public.unidad u WHERE u.codcom=c.codcom), 0),
    'estcom', c.estcom, 'feccom', c.feccom, 'horcom', c.horcom
  ) || CASE WHEN public.hu026_rol_actual() IN ('Gerente','Administradora')
       THEN jsonb_build_object('codusu', c.codusu::text) ELSE '{}'::jsonb END
  FROM public.compra c JOIN public.modelo m ON m.codmod=c.codmod WHERE c.codcom=p_codcom
$$;
REVOKE ALL ON FUNCTION public.hu034_detalle_interno(bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.hu034_obtener_compra(p_codcom bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE resultado jsonb;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente','Administradora','Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Perfil no autorizado';
  END IF;
  IF p_codcom IS NULL OR p_codcom <= 0 THEN RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Identificador inválido'; END IF;
  resultado := public.hu034_detalle_interno(p_codcom);
  IF resultado IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Compra inexistente'; END IF;
  RETURN resultado;
END $$;

CREATE OR REPLACE FUNCTION public.hu034_listar_pendientes(p_limite integer DEFAULT 50, p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE resultado jsonb;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente','Administradora','Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Perfil no autorizado';
  END IF;
  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 100 OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Paginación inválida';
  END IF;
  SELECT coalesce(jsonb_agg(public.hu034_detalle_interno(c.codcom) ORDER BY c.codcom DESC), '[]'::jsonb)
  INTO resultado FROM (
    SELECT codcom FROM public.compra WHERE estcom='Pendiente de factura'
    ORDER BY codcom DESC LIMIT p_limite OFFSET p_offset
  ) c;
  RETURN resultado;
END $$;

CREATE OR REPLACE FUNCTION public.hu034_registrar_compra(p_codmod bigint, p_colcom text, p_cancom integer, p_idempotencia uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE autor bigint; color_normalizado text; compra_existente public.compra%ROWTYPE; nuevo_id bigint;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente','Administradora') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Solo gerente y administradora registran compras';
  END IF;
  SELECT codusu INTO autor FROM public.usuario WHERE uuidusu=auth.uid() AND estusu;
  IF autor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Usuario no autorizado'; END IF;
  color_normalizado := btrim(regexp_replace(p_colcom, '[[:space:]]+', ' ', 'g'));
  IF p_codmod IS NULL OR p_codmod <= 0 OR color_normalizado IS NULL OR color_normalizado=''
    OR char_length(color_normalizado)>50 OR p_cancom IS NULL OR p_cancom<=0 OR p_idempotencia IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Modelo, color, cantidad o clave inválidos';
  END IF;
  -- Serializar la misma clave hasta COMMIT. El índice único refuerza la garantía.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotencia::text, 34));
  SELECT * INTO compra_existente FROM public.compra WHERE idempotencia=p_idempotencia;
  IF FOUND THEN
    IF compra_existente.codusu <> autor OR compra_existente.codmod <> p_codmod
       OR compra_existente.colcom <> color_normalizado OR compra_existente.cancom <> p_cancom THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Clave utilizada con otros datos o autor';
    END IF;
    RETURN jsonb_build_object('creada', false, 'compra', public.hu034_detalle_interno(compra_existente.codcom));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.modelo WHERE codmod=p_codmod) THEN
    RAISE EXCEPTION USING ERRCODE='PT422', MESSAGE='Modelo inexistente';
  END IF;
  INSERT INTO public.compra(codmod,codusu,colcom,cancom,estcom,feccom,horcom,idempotencia)
  VALUES (p_codmod,autor,color_normalizado,p_cancom,'Pendiente de factura',
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::date,
    (CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::time,p_idempotencia)
  RETURNING codcom INTO nuevo_id;
  RETURN jsonb_build_object('creada', true, 'compra', public.hu034_detalle_interno(nuevo_id));
END $$;
REVOKE ALL ON FUNCTION public.hu034_registrar_compra(bigint,text,integer,uuid),
 public.hu034_listar_pendientes(integer,integer), public.hu034_obtener_compra(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hu034_registrar_compra(bigint,text,integer,uuid),
 public.hu034_listar_pendientes(integer,integer), public.hu034_obtener_compra(bigint) TO authenticated;
COMMIT;
