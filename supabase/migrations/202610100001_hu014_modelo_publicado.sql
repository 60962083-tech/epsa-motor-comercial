BEGIN;

-- Corrección HU-014: solo modelos publicados. El resto de la RPC permanece intacto.
-- CREATE OR REPLACE conserva los permisos existentes; no redefine helpers ni tablas.
CREATE OR REPLACE FUNCTION public.hu014_registrar_lead_manual(
  p_nomlea text, p_tellea text, p_codmod bigint, p_canlea text, p_estlea text,
  p_codusu bigint DEFAULT NULL, p_fecprosle timestamptz DEFAULT NULL,
  p_collea text DEFAULT NULL, p_orilea text DEFAULT NULL, p_codsed bigint DEFAULT NULL,
  p_codcwa bigint DEFAULT NULL, p_obslea text DEFAULT NULL, p_nueva_oportunidad boolean DEFAULT false
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  autor bigint; nombre text; telefono text; canal text; origen text; color text; observacion text;
  coincidencia jsonb; nuevo public.lead%ROWTYPE; ausencia boolean;
BEGIN
  IF coalesce(public.hu026_rol_actual(),'') NOT IN ('Gerente','Administradora','Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Perfil no autorizado';
  END IF;
  SELECT codusu INTO autor FROM public.usuario WHERE uuidusu=auth.uid() AND estusu FOR SHARE;
  IF autor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Usuario no autorizado'; END IF;

  nombre := btrim(regexp_replace(p_nomlea,'[[:space:]]+',' ','g'));
  telefono := public.hu014_normalizar_movil(p_tellea);
  canal := btrim(regexp_replace(p_canlea,'[[:space:]]+',' ','g'));
  origen := nullif(btrim(regexp_replace(p_orilea,'[[:space:]]+',' ','g')),'');
  observacion := nullif(btrim(regexp_replace(p_obslea,'[[:space:]]+',' ','g')),'');
  color := nullif(btrim(regexp_replace(p_collea,'[[:space:]]+',' ','g')),'');
  IF color IS NOT NULL THEN
    SELECT c INTO color FROM unnest(ARRAY['Rojo','Azul','Amarillo','Verde','Negro']) AS colores(c)
      WHERE lower(c)=lower(color);
    IF color IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Color inválido'; END IF;
  END IF;
  IF lower(canal)='presencial' THEN canal := 'Presencial'; END IF;
  IF lower(canal)='whatsapp' THEN canal := 'WhatsApp'; END IF;
  ausencia := public.hu014_modo_ausencia_activo();

  IF nombre IS NULL OR nombre='' OR char_length(nombre)>150 OR telefono IS NULL
    OR p_codmod IS NULL OR p_codmod<=0 OR canal IS NULL OR canal='' OR char_length(canal)>50
    OR char_length(origen)>30 OR lower(origen)='manual' OR char_length(observacion)>10000
    OR p_estlea IS NULL OR p_estlea NOT IN ('Nuevo','Contactado','En seguimiento','Cerrado')
    OR (p_estlea='Cerrado' AND p_fecprosle IS NOT NULL)
    OR p_nueva_oportunidad IS NULL
    OR (p_codsed IS NOT NULL AND p_codsed<=0) OR (p_codcwa IS NOT NULL AND p_codcwa<=0)
    OR (canal='Presencial' AND p_codsed IS NULL) OR (canal='WhatsApp' AND p_codcwa IS NULL) THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Datos de lead inválidos';
  END IF;

  IF ausencia THEN
    -- Solo HU-035 podrá habilitar esta rama desde configuración confiable.
    p_estlea := 'Nuevo'; p_codusu := NULL; p_fecprosle := NULL;
  ELSE
    IF p_codusu IS NULL OR p_codusu<=0
      OR (p_estlea<>'Cerrado' AND p_fecprosle IS NULL)
      OR (p_fecprosle IS NOT NULL AND (NOT isfinite(p_fecprosle) OR p_fecprosle<CURRENT_TIMESTAMP)) THEN
      RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Responsable o próximo seguimiento inválido';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.usuario u JOIN public.rol r ON r.codrol=u.codrol
      WHERE u.codusu=p_codusu AND u.estusu AND r.estrol AND r.nomrol IN ('Gerente','Administradora','Vendedor')
      FOR SHARE OF u,r) THEN
      RAISE EXCEPTION USING ERRCODE='PT407', MESSAGE='Responsable inexistente o inactivo';
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.modelo WHERE codmod=p_codmod AND estmod='Publicado' FOR SHARE) THEN
    RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Modelo inexistente o no publicado';
  END IF;
  IF p_codsed IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.sede WHERE codsed=p_codsed FOR SHARE) THEN
    RAISE EXCEPTION USING ERRCODE='PT405', MESSAGE='Sede inexistente';
  END IF;
  IF p_codcwa IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.canalwhatsapp WHERE codcwa=p_codcwa FOR SHARE) THEN
    RAISE EXCEPTION USING ERRCODE='PT406', MESSAGE='Canal WhatsApp inexistente';
  END IF;

  -- Bloquea el teléfono normalizado hasta COMMIT; un registro paralelo lo verá al continuar.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(telefono,14));
  IF NOT p_nueva_oportunidad THEN
    SELECT jsonb_build_object('codlea',l.codlea::text,'codmod',l.codmod::text,'estlea',l.estlea)
    INTO coincidencia FROM public.lead l
    CROSS JOIN LATERAL (
      SELECT greatest(l.fecreglea, max(greatest(s.fecinisle,
        CASE WHEN s.horsle IS NULL THEN s.fecinisle ELSE
          ((s.fecinisle AT TIME ZONE 'America/Lima')::date + s.horsle) AT TIME ZONE 'America/Lima' END))) AS ultima
      FROM public.seguimientolead s WHERE s.codlea=l.codlea
    ) actividad
    WHERE public.hu014_normalizar_movil(l.tellea)=telefono
      AND l.estlea IN ('Nuevo','Contactado','En seguimiento')
      AND actividad.ultima > CURRENT_TIMESTAMP - interval '14 days'
    ORDER BY actividad.ultima DESC,l.codlea DESC LIMIT 1;
    IF coincidencia IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Oportunidad activa reciente', DETAIL=coincidencia::text;
    END IF;
  END IF;

  INSERT INTO public.lead(codmod,codusu,codcwa,nomlea,tellea,orilea,canlea,obslea,estlea,
    codsed,collea,tipreglea,codcli,codcrelea,fecreglea)
  VALUES(p_codmod,p_codusu,p_codcwa,nombre,telefono,origen,canal,observacion,p_estlea,
    p_codsed,color,'Manual',NULL,autor,CURRENT_TIMESTAMP) RETURNING * INTO nuevo;

  -- El usuario del seguimiento es quien realiza la actividad; no es el responsable asignado.
  -- Se conserva el registro inicial también para Cerrado; la ausencia futura no agenda contacto.
  IF NOT ausencia THEN
    INSERT INTO public.seguimientolead(codlea,codusu,fecinisle,horsle,tipsle,dessle,fecprosle)
    VALUES(nuevo.codlea,autor,CURRENT_TIMESTAMP,(CURRENT_TIMESTAMP AT TIME ZONE 'America/Lima')::time,
      'Registro manual',observacion,p_fecprosle);
  END IF;
  RETURN jsonb_build_object(
    'codlea',nuevo.codlea::text,'nomlea',nuevo.nomlea,'tellea',nuevo.tellea,
    'codmod',nuevo.codmod::text,'codusu',nuevo.codusu::text,'codcrelea',nuevo.codcrelea::text,
    'codcwa',nuevo.codcwa::text,'codsed',nuevo.codsed::text,'codcli',nuevo.codcli::text,
    'collea',nuevo.collea,'canlea',nuevo.canlea,'orilea',nuevo.orilea,'tipreglea',nuevo.tipreglea,
    'estlea',nuevo.estlea,'obslea',nuevo.obslea,'fecreglea',nuevo.fecreglea,'fecprosle',p_fecprosle);
END $$;

COMMIT;
