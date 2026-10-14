BEGIN;

-- Las lecturas y escrituras de sede se hacen mediante RPC para conservar RLS
-- y mantener ubicación/sede sincronizadas dentro de una única transacción.
CREATE OR REPLACE FUNCTION public.hu026_ubicacion_payload(p_codubi bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE salida jsonb;
BEGIN
  SELECT pg_catalog.jsonb_build_object(
      'codubi', u.codubi::text,
      'nomubi', u.nomubi,
      'tipubi', u.tipubi,
      'dirubi', u.dirubi,
      'estubi', u.estubi
    ) || CASE WHEN u.tipubi = 'Sede' THEN pg_catalog.jsonb_build_object(
      'telsed', s.telsed,
      'horsed', s.horsed
    ) ELSE '{}'::jsonb END
    INTO salida
  FROM public.ubicacion u
  LEFT JOIN public.sede s ON s.codubi = u.codubi
  WHERE u.codubi = p_codubi;
  RETURN salida;
END;
$$;

CREATE OR REPLACE FUNCTION public.hu026_listar_ubicaciones(p_activo boolean)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE salida jsonb;
BEGIN
  IF COALESCE(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado';
  END IF;

  SELECT COALESCE(
      pg_catalog.jsonb_agg(public.hu026_ubicacion_payload(u.codubi) ORDER BY u.nomubi, u.codubi),
      '[]'::jsonb
    )
    INTO salida
  FROM public.ubicacion u
  WHERE p_activo IS NULL OR u.estubi = p_activo;
  RETURN salida;
END;
$$;

CREATE OR REPLACE FUNCTION public.hu026_crear_ubicacion(
  p_nomubi text,
  p_tipubi text,
  p_dirubi text,
  p_telsed text,
  p_horsed text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nomubi text;
  v_codubi bigint;
BEGIN
  IF COALESCE(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado';
  END IF;
  IF p_nomubi IS NULL OR public.hu026_nombre_normalizado(p_nomubi) = ''
     OR pg_catalog.char_length(pg_catalog.regexp_replace(pg_catalog.btrim(p_nomubi), '[[:space:]]+', ' ', 'g')) > 120
     OR p_tipubi IS NULL OR p_tipubi NOT IN ('Sede', 'Almacen', 'Proveedor')
     OR (p_dirubi IS NOT NULL AND pg_catalog.char_length(p_dirubi) > 250)
     OR (p_telsed IS NOT NULL AND pg_catalog.char_length(p_telsed) > 20)
     OR (p_horsed IS NOT NULL AND pg_catalog.char_length(p_horsed) > 150)
     OR (p_tipubi <> 'Sede' AND (p_telsed IS NOT NULL OR p_horsed IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Datos de ubicación no válidos';
  END IF;

  v_nomubi := pg_catalog.regexp_replace(pg_catalog.btrim(p_nomubi), '[[:space:]]+', ' ', 'g');
  INSERT INTO public.ubicacion(nomubi, tipubi, dirubi, estubi)
  VALUES (v_nomubi, p_tipubi, NULLIF(pg_catalog.btrim(COALESCE(p_dirubi, '')), ''), true)
  RETURNING codubi INTO v_codubi;

  IF p_tipubi = 'Sede' THEN
    INSERT INTO public.sede(codubi, telsed, horsed, estsed)
    VALUES (v_codubi, NULLIF(pg_catalog.btrim(COALESCE(p_telsed, '')), ''),
      NULLIF(pg_catalog.btrim(COALESCE(p_horsed, '')), ''), true);
  END IF;
  RETURN public.hu026_ubicacion_payload(v_codubi);
END;
$$;

CREATE OR REPLACE FUNCTION public.hu026_actualizar_ubicacion(
  p_codubi bigint,
  p_nomubi text,
  p_tipubi text,
  p_dirubi text,
  p_telsed text,
  p_horsed text,
  p_actualizar_telsed boolean,
  p_actualizar_horsed boolean
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_nomubi text;
  v_tipo_anterior text;
BEGIN
  IF COALESCE(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado';
  END IF;
  IF p_codubi IS NULL OR p_codubi < 1 OR p_nomubi IS NULL
     OR public.hu026_nombre_normalizado(p_nomubi) = ''
     OR pg_catalog.char_length(pg_catalog.regexp_replace(pg_catalog.btrim(p_nomubi), '[[:space:]]+', ' ', 'g')) > 120
     OR p_tipubi IS NULL OR p_tipubi NOT IN ('Sede', 'Almacen', 'Proveedor')
     OR (p_dirubi IS NOT NULL AND pg_catalog.char_length(p_dirubi) > 250)
     OR p_actualizar_telsed IS NULL OR p_actualizar_horsed IS NULL
     OR (p_telsed IS NOT NULL AND pg_catalog.char_length(p_telsed) > 20)
     OR (p_horsed IS NOT NULL AND pg_catalog.char_length(p_horsed) > 150)
     OR (p_tipubi <> 'Sede' AND (p_actualizar_telsed OR p_actualizar_horsed OR p_telsed IS NOT NULL OR p_horsed IS NOT NULL)) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Datos de ubicación no válidos';
  END IF;

  SELECT tipubi INTO v_tipo_anterior
  FROM public.ubicacion WHERE codubi = p_codubi FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'La ubicación no existe';
  END IF;

  v_nomubi := pg_catalog.regexp_replace(pg_catalog.btrim(p_nomubi), '[[:space:]]+', ' ', 'g');
  UPDATE public.ubicacion
  SET nomubi = v_nomubi,
      tipubi = p_tipubi,
      dirubi = NULLIF(pg_catalog.btrim(COALESCE(p_dirubi, '')), '')
  WHERE codubi = p_codubi;

  IF p_tipubi = 'Sede' THEN
    INSERT INTO public.sede AS s(codubi, telsed, horsed, estsed)
    SELECT p_codubi,
      CASE WHEN p_actualizar_telsed THEN NULLIF(pg_catalog.btrim(COALESCE(p_telsed, '')), '') ELSE NULL END,
      CASE WHEN p_actualizar_horsed THEN NULLIF(pg_catalog.btrim(COALESCE(p_horsed, '')), '') ELSE NULL END,
      u.estubi
    FROM public.ubicacion u WHERE u.codubi = p_codubi
    ON CONFLICT (codubi) DO UPDATE SET
      telsed = CASE WHEN p_actualizar_telsed THEN EXCLUDED.telsed ELSE s.telsed END,
      horsed = CASE WHEN p_actualizar_horsed THEN EXCLUDED.horsed ELSE s.horsed END,
      estsed = EXCLUDED.estsed;
  ELSIF v_tipo_anterior = 'Sede' THEN
    -- Se conserva el registro y su información para historial o futura reactivación.
    UPDATE public.sede SET estsed = false WHERE codubi = p_codubi;
  END IF;

  RETURN public.hu026_ubicacion_payload(p_codubi);
END;
$$;

CREATE OR REPLACE FUNCTION public.hu026_cambiar_estado_ubicacion(p_codubi bigint, p_estubi boolean)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_tipo text;
BEGIN
  IF COALESCE(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado';
  END IF;
  IF p_codubi IS NULL OR p_codubi < 1 OR p_estubi IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Código o estado no válido';
  END IF;

  SELECT tipubi INTO v_tipo FROM public.ubicacion WHERE codubi = p_codubi FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'La ubicación no existe';
  END IF;
  -- El trigger HU-026 conserva sus restricciones y aborta la transacción si hay referencias activas.
  UPDATE public.ubicacion SET estubi = p_estubi WHERE codubi = p_codubi;
  IF v_tipo = 'Sede' THEN
    INSERT INTO public.sede(codubi, estsed) VALUES (p_codubi, p_estubi)
    ON CONFLICT (codubi) DO UPDATE SET estsed = EXCLUDED.estsed;
  END IF;
  RETURN public.hu026_ubicacion_payload(p_codubi);
END;
$$;

CREATE OR REPLACE FUNCTION public.hu013_actualizar_canal_whatsapp(p_codcwa bigint, p_cambios jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_clave text;
  v_nomcwa text;
  v_numcwa text;
  v_enlcwa text;
  v_wa_match text[];
  v_estcwa boolean;
  salida jsonb;
BEGIN
  IF COALESCE(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Rol no autorizado';
  END IF;
  IF p_codcwa IS NULL OR p_codcwa < 1 OR p_cambios IS NULL
     OR pg_catalog.jsonb_typeof(p_cambios) <> 'object' OR p_cambios = '{}'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Datos del canal WhatsApp no válidos';
  END IF;
  FOR v_clave IN SELECT pg_catalog.jsonb_object_keys(p_cambios) LOOP
    IF v_clave NOT IN ('nomcwa', 'numcwa', 'enlcwa', 'estcwa') THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Campo de canal WhatsApp no permitido';
    END IF;
  END LOOP;

  IF p_cambios ? 'nomcwa' THEN
    IF pg_catalog.jsonb_typeof(p_cambios->'nomcwa') <> 'string'
       OR pg_catalog.btrim(p_cambios->>'nomcwa') = ''
       OR pg_catalog.char_length(pg_catalog.btrim(p_cambios->>'nomcwa')) > 100 THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'nomcwa no válido';
    END IF;
    v_nomcwa := pg_catalog.btrim(p_cambios->>'nomcwa');
  END IF;
  IF p_cambios ? 'numcwa' THEN
    IF pg_catalog.jsonb_typeof(p_cambios->'numcwa') <> 'string'
       OR (p_cambios->>'numcwa') !~ '^[+]?[0-9(). -]+$' THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'numcwa no válido';
    END IF;
    v_numcwa := pg_catalog.regexp_replace(p_cambios->>'numcwa', '[^0-9]', '', 'g');
    IF pg_catalog.char_length(v_numcwa) NOT BETWEEN 7 AND 15 THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'numcwa debe tener entre 7 y 15 dígitos';
    END IF;
  END IF;
  IF p_cambios ? 'enlcwa' THEN
    IF pg_catalog.jsonb_typeof(p_cambios->'enlcwa') <> 'string'
       OR pg_catalog.btrim(p_cambios->>'enlcwa') = ''
       OR pg_catalog.char_length(pg_catalog.btrim(p_cambios->>'enlcwa')) > 2048
       OR pg_catalog.btrim(p_cambios->>'enlcwa') !~ '^https://[^[:space:]]+$' THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'enlcwa debe ser una URL HTTPS';
    END IF;
    v_enlcwa := pg_catalog.btrim(p_cambios->>'enlcwa');
  END IF;
  IF p_cambios ? 'numcwa' AND NOT (p_cambios ? 'enlcwa') THEN
    v_enlcwa := 'https://wa.me/' || v_numcwa;
  ELSIF p_cambios ? 'numcwa' AND p_cambios ? 'enlcwa'
        AND pg_catalog.lower(v_enlcwa) ~ '^https://([^/?#@]+@)?wa[.]me(:[^/?#[:space:]]*)?([/?#]|$)' THEN
    v_wa_match := pg_catalog.regexp_match(
      pg_catalog.lower(v_enlcwa),
      '^https://([^/?#@]+@)?wa[.]me(:[0-9]+)?/([0-9]+)/?([?#].*)?$'
    );
    IF v_wa_match IS NULL OR v_wa_match[1] IS NOT NULL OR v_wa_match[3] IS DISTINCT FROM v_numcwa THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'enlcwa debe corresponder al número numcwa';
    END IF;
  END IF;
  IF p_cambios ? 'estcwa' THEN
    IF pg_catalog.jsonb_typeof(p_cambios->'estcwa') <> 'boolean' THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'estcwa debe ser booleano';
    END IF;
    v_estcwa := (p_cambios->>'estcwa')::boolean;
  END IF;

  PERFORM 1 FROM public.canalwhatsapp WHERE codcwa = p_codcwa FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'El canal WhatsApp no existe';
  END IF;
  UPDATE public.canalwhatsapp SET
    nomcwa = CASE WHEN p_cambios ? 'nomcwa' THEN v_nomcwa ELSE nomcwa END,
    numcwa = CASE WHEN p_cambios ? 'numcwa' THEN v_numcwa ELSE numcwa END,
    enlcwa = CASE WHEN p_cambios ? 'enlcwa' OR p_cambios ? 'numcwa' THEN v_enlcwa ELSE enlcwa END,
    estcwa = CASE WHEN p_cambios ? 'estcwa' THEN v_estcwa ELSE estcwa END
  WHERE codcwa = p_codcwa
  RETURNING pg_catalog.jsonb_build_object(
    'codcwa', codcwa::text, 'nomcwa', nomcwa, 'numcwa', numcwa, 'enlcwa', enlcwa, 'estcwa', estcwa
  ) INTO salida;
  RETURN salida;
END;
$$;

REVOKE ALL ON FUNCTION public.hu026_ubicacion_payload(bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu026_listar_ubicaciones(boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu026_crear_ubicacion(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu026_actualizar_ubicacion(bigint, text, text, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu026_cambiar_estado_ubicacion(bigint, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hu013_actualizar_canal_whatsapp(bigint, jsonb) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.hu026_listar_ubicaciones(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu026_crear_ubicacion(text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu026_actualizar_ubicacion(bigint, text, text, text, text, text, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu026_cambiar_estado_ubicacion(bigint, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hu013_actualizar_canal_whatsapp(bigint, jsonb) TO authenticated;

COMMIT;
