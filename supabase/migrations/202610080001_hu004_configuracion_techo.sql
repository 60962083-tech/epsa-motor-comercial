BEGIN;

-- Seed idempotente. Solo se corrige reqprotte en tipos ya existentes;
-- descripciones y estados administrativos de los catálogos se conservan.
INSERT INTO public.tipotecho (nomtte, reqprotte) VALUES
  ('Sin techo', false),
  ('Lona', false),
  ('Techo clásico de fibra', false),
  ('Techo de fibra deportiva', true)
ON CONFLICT (nomtte) DO UPDATE SET reqprotte = EXCLUDED.reqprotte;

INSERT INTO public.proveedor (nompro) VALUES ('FIVESA'), ('JAVICAR'), ('FIBRAT')
ON CONFLICT (nompro) DO NOTHING;

CREATE OR REPLACE FUNCTION public.hu004_listar_tipos_techo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'codtte', t.codtte::text, 'nomtte', t.nomtte, 'reqprotte', t.reqprotte
    ) ORDER BY t.nomtte, t.codtte)
    FROM public.tipotecho t WHERE t.esttte
  ), '[]'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.hu004_listar_proveedores_techo()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('codpro', p.codpro::text, 'nompro', p.nompro)
      ORDER BY p.nompro, p.codpro)
    FROM public.proveedor p
    WHERE p.estpro AND p.nompro IN ('FIVESA', 'JAVICAR', 'FIBRAT')
  ), '[]'::jsonb);
END
$$;

CREATE OR REPLACE FUNCTION public.hu004_obtener_configuracion_techo(p_coduni bigint)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE resultado jsonb;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  IF p_coduni IS NULL OR p_coduni <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'ID de unidad inválido';
  END IF;

  SELECT jsonb_build_object(
    'coduni', u.coduni::text,
    'tipoTecho', CASE WHEN t.codtte IS NULL THEN NULL ELSE
      jsonb_build_object('codtte', t.codtte::text, 'nombre', t.nomtte) END,
    'proveedor', CASE WHEN p.codpro IS NULL THEN NULL ELSE
      jsonb_build_object('codpro', p.codpro::text, 'nombre', p.nompro) END,
    'detalle', u.dettecuni
  ) INTO resultado
  FROM public.unidad u
  LEFT JOIN public.tipotecho t ON t.codtte = u.codtte
  LEFT JOIN public.proveedor p ON p.codpro = u.codpro
  WHERE u.coduni = p_coduni;

  IF resultado IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Unidad inexistente';
  END IF;
  RETURN resultado;
END
$$;

CREATE OR REPLACE FUNCTION public.hu004_actualizar_configuracion_techo(
  p_coduni bigint, p_codtte bigint, p_codpro bigint, p_detalle text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE unidad_actual public.unidad%ROWTYPE;
  tipo public.tipotecho%ROWTYPE;
  proveedor public.proveedor%ROWTYPE;
  detalle_normalizado text;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  IF p_coduni IS NULL OR p_coduni <= 0 OR p_codtte IS NULL OR p_codtte <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'ID de unidad o tipo de techo inválido';
  END IF;

  SELECT * INTO unidad_actual FROM public.unidad WHERE coduni = p_coduni FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Unidad inexistente';
  END IF;

  SELECT * INTO tipo FROM public.tipotecho WHERE codtte = p_codtte AND esttte FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT420', MESSAGE = 'Tipo de techo inexistente o inactivo';
  END IF;

  detalle_normalizado := nullif(btrim(regexp_replace(coalesce(p_detalle, ''), '[[:space:]]+', ' ', 'g')), '');
  IF char_length(detalle_normalizado) > 250 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Detalle excede el límite permitido';
  END IF;

  IF tipo.reqprotte THEN
    IF p_codpro IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'PT421', MESSAGE = 'Configuración requiere proveedor externo';
    END IF;
    SELECT * INTO proveedor FROM public.proveedor
    WHERE codpro = p_codpro AND estpro AND nompro IN ('FIVESA', 'JAVICAR', 'FIBRAT') FOR SHARE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Proveedor no válido para configuración de techo';
    END IF;
  ELSE
    IF p_codpro IS NOT NULL OR detalle_normalizado IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Esta configuración no admite proveedor ni detalle';
    END IF;
  END IF;

  UPDATE public.unidad
  SET codtte = tipo.codtte,
      codpro = CASE WHEN tipo.reqprotte THEN proveedor.codpro ELSE NULL END,
      dettecuni = detalle_normalizado
  WHERE coduni = p_coduni;

  -- La operación representa una configuración elegida, nunca un trabajo instalado.
  RETURN public.hu004_obtener_configuracion_techo(p_coduni);
END
$$;

REVOKE ALL ON FUNCTION public.hu004_listar_tipos_techo(),
  public.hu004_listar_proveedores_techo(),
  public.hu004_obtener_configuracion_techo(bigint),
  public.hu004_actualizar_configuracion_techo(bigint, bigint, bigint, text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu004_listar_tipos_techo(),
  public.hu004_listar_proveedores_techo(),
  public.hu004_obtener_configuracion_techo(bigint),
  public.hu004_actualizar_configuracion_techo(bigint, bigint, bigint, text)
TO authenticated;

COMMENT ON FUNCTION public.hu004_actualizar_configuracion_techo(bigint, bigint, bigint, text)
IS 'Actualiza solo codtte, codpro y dettecuni. No registra instalación ni preparación.';

COMMIT;
