BEGIN;

-- No se corrige ni elimina historial ambiguo. Revisar manualmente antes de continuar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.movimientoubicacion
    WHERE estmub IN ('Pendiente', 'En transito')
    GROUP BY coduni
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'HU-003 abortada: hay unidades con más de un movimiento activo; revisar movimientoubicacion antes de migrar';
  END IF;
END
$$;

ALTER TABLE public.movimientoubicacion
  ADD COLUMN IF NOT EXISTS codusurec bigint,
  ADD COLUMN IF NOT EXISTS fecrecmub date,
  ADD COLUMN IF NOT EXISTS horrecmub time;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.movimientoubicacion'::pg_catalog.regclass
      AND conname = 'fk_movubicacion_usuario_recepcion'
  ) THEN
    ALTER TABLE public.movimientoubicacion
      ADD CONSTRAINT fk_movubicacion_usuario_recepcion
      FOREIGN KEY (codusurec) REFERENCES public.usuario(codusu);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.movimientoubicacion'::pg_catalog.regclass
      AND conname = 'chk_movubicacion_recepcion_coherente'
  ) THEN
    -- Finalizados anteriores a HU-003 conservan NULL: no se inventa hora/autor de recepción.
    -- Los nuevos finalizados solo se producen por la RPC, que completa los tres campos juntos.
    ALTER TABLE public.movimientoubicacion
      ADD CONSTRAINT chk_movubicacion_recepcion_coherente CHECK (
        (codusurec IS NULL AND fecrecmub IS NULL AND horrecmub IS NULL)
        OR (
          estmub = 'Finalizado'
          AND codusurec IS NOT NULL
          AND fecrecmub IS NOT NULL
          AND horrecmub IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_movubicacion_unidad_activa
  ON public.movimientoubicacion(coduni)
  WHERE estmub IN ('Pendiente', 'En transito');
CREATE INDEX IF NOT EXISTS ix_movubicacion_historial_unidad
  ON public.movimientoubicacion(coduni, fecmub DESC, hormub DESC, codmub DESC);

ALTER TABLE public.movimientoubicacion ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.movimientoubicacion FROM PUBLIC, anon, authenticated;
DO $$
DECLARE secuencia text;
BEGIN
  secuencia := pg_catalog.pg_get_serial_sequence('public.movimientoubicacion', 'codmub');
  IF secuencia IS NOT NULL THEN
    EXECUTE pg_catalog.format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC, anon, authenticated', secuencia::pg_catalog.regclass);
  END IF;
END
$$;
DROP POLICY IF EXISTS hu003_movimiento_solo_rpc ON public.movimientoubicacion;
CREATE POLICY hu003_movimiento_solo_rpc ON public.movimientoubicacion
  AS RESTRICTIVE FOR ALL TO PUBLIC USING (false) WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.hu003_proyeccion_movimiento(p_codmub bigint)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'codmub', m.codmub::text,
    'coduni', m.coduni::text,
    'origen', jsonb_build_object('codubi', origen.codubi::text, 'nomubi', origen.nomubi),
    'destino', jsonb_build_object('codubi', destino.codubi::text, 'nomubi', destino.nomubi),
    'estado', m.estmub,
    'fechaSalida', m.fecmub::text,
    'horaSalida', m.hormub::text,
    'autorSalida', jsonb_build_object(
      'nombre', pg_catalog.btrim(pg_catalog.concat_ws(' ', salida.nomusu, salida.apepatusu, salida.apematusu))
    ),
    'fechaRecepcion', m.fecrecmub::text,
    'horaRecepcion', m.horrecmub::text,
    'autorRecepcion', CASE WHEN recepcion.codusu IS NULL THEN NULL ELSE jsonb_build_object(
      'nombre', pg_catalog.btrim(pg_catalog.concat_ws(' ', recepcion.nomusu, recepcion.apepatusu, recepcion.apematusu))
    ) END,
    'observacion', m.obsmub
  )
  FROM public.movimientoubicacion m
  JOIN public.ubicacion origen ON origen.codubi = m.codubiori
  JOIN public.ubicacion destino ON destino.codubi = m.codubides
  LEFT JOIN public.usuario salida ON salida.codusu = m.codusu
  LEFT JOIN public.usuario recepcion ON recepcion.codusu = m.codusurec
  WHERE m.codmub = p_codmub
$$;

CREATE OR REPLACE FUNCTION public.hu003_iniciar_movimiento(
  p_coduni bigint, p_codubiori bigint, p_codubides bigint, p_obsmub text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  autor bigint;
  rol_actual text;
  unidad_actual public.unidad%ROWTYPE;
  lugar record;
  lugares_encontrados integer := 0;
  movimiento_id bigint;
BEGIN
  SELECT u.codusu, r.nomrol
    INTO autor, rol_actual
  FROM public.usuario u
  JOIN public.rol r ON r.codrol = u.codrol
  WHERE u.uuidusu = auth.uid() AND u.estusu AND r.estrol;
  IF NOT FOUND OR rol_actual NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;

  IF p_coduni IS NULL OR p_coduni <= 0
     OR p_codubiori IS NULL OR p_codubiori <= 0
     OR p_codubides IS NULL OR p_codubides <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Códigos de unidad y ubicación inválidos';
  END IF;
  IF p_codubiori = p_codubides THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Origen y destino deben ser distintos';
  END IF;

  SELECT * INTO unidad_actual
  FROM public.unidad
  WHERE coduni = p_coduni
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Unidad inexistente';
  END IF;
  IF unidad_actual.codubi IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT423', MESSAGE = 'La unidad todavía no tiene ubicación confirmada';
  END IF;
  IF unidad_actual.codubi <> p_codubiori THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'El origen esperado no coincide con la ubicación confirmada';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.movimientoubicacion
    WHERE coduni = p_coduni AND estmub IN ('Pendiente', 'En transito')
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT424', MESSAGE = 'La unidad ya tiene un movimiento activo';
  END IF;

  FOR lugar IN
    SELECT u.codubi, u.estubi
    FROM public.ubicacion u
    WHERE u.codubi IN (p_codubiori, p_codubides)
    ORDER BY u.codubi
    FOR UPDATE
  LOOP
    lugares_encontrados := lugares_encontrados + 1;
    IF lugar.estubi IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'El origen o destino está inactivo';
    END IF;
  END LOOP;
  IF lugares_encontrados <> 2 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Origen o destino inexistente';
  END IF;

  INSERT INTO public.movimientoubicacion (
    coduni, codubiori, codubides, codusu, obsmub, estmub
  ) VALUES (
    p_coduni, p_codubiori, p_codubides, autor,
    NULLIF(pg_catalog.btrim(p_obsmub), ''), 'En transito'
  ) RETURNING codmub INTO movimiento_id;

  RETURN public.hu003_proyeccion_movimiento(movimiento_id);
END
$$;

CREATE OR REPLACE FUNCTION public.hu003_confirmar_recepcion(p_coduni bigint, p_codmub bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  autor bigint;
  rol_actual text;
  unidad_actual public.unidad%ROWTYPE;
  movimiento_actual public.movimientoubicacion%ROWTYPE;
  destino_activo boolean;
BEGIN
  SELECT u.codusu, r.nomrol
    INTO autor, rol_actual
  FROM public.usuario u
  JOIN public.rol r ON r.codrol = u.codrol
  WHERE u.uuidusu = auth.uid() AND u.estusu AND r.estrol;
  IF NOT FOUND OR rol_actual NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;

  IF p_coduni IS NULL OR p_coduni <= 0 OR p_codmub IS NULL OR p_codmub <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Códigos de unidad y movimiento inválidos';
  END IF;

  SELECT * INTO unidad_actual
  FROM public.unidad
  WHERE coduni = p_coduni
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Unidad inexistente';
  END IF;

  SELECT * INTO movimiento_actual
  FROM public.movimientoubicacion
  WHERE codmub = p_codmub AND coduni = p_coduni
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Movimiento inexistente para la unidad indicada';
  END IF;
  IF movimiento_actual.estmub <> 'En transito' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT425', MESSAGE = 'El movimiento ya no está en tránsito';
  END IF;
  IF unidad_actual.codubi IS DISTINCT FROM movimiento_actual.codubiori THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'La ubicación de la unidad cambió antes de confirmar recepción';
  END IF;

  SELECT estubi INTO destino_activo
  FROM public.ubicacion
  WHERE codubi = movimiento_actual.codubides
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Destino inexistente';
  END IF;
  IF destino_activo IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'El destino está inactivo';
  END IF;

  UPDATE public.movimientoubicacion
  SET estmub = 'Finalizado',
      codusurec = autor,
      fecrecmub = CURRENT_DATE,
      horrecmub = LOCALTIME
  WHERE codmub = p_codmub;

  UPDATE public.unidad
  SET codubi = movimiento_actual.codubides
  WHERE coduni = p_coduni;

  RETURN public.hu003_proyeccion_movimiento(p_codmub);
END
$$;

CREATE OR REPLACE FUNCTION public.hu003_consultar_movimientos(p_coduni bigint)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  rol_actual text;
  resultado jsonb;
BEGIN
  rol_actual := public.hu026_rol_actual();
  IF coalesce(rol_actual, '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  IF p_coduni IS NULL OR p_coduni <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Código de unidad inválido';
  END IF;

  SELECT jsonb_build_object(
    'coduni', u.coduni::text,
    'ubicacionConfirmada', CASE WHEN u.codubi IS NULL THEN NULL ELSE
      jsonb_build_object('codubi', ubicacion.codubi::text, 'nomubi', ubicacion.nomubi) END,
    'movimientoActivo', (
      SELECT public.hu003_proyeccion_movimiento(m.codmub)
      FROM public.movimientoubicacion m
      WHERE m.coduni = u.coduni AND m.estmub IN ('Pendiente', 'En transito')
      ORDER BY m.fecmub DESC, m.hormub DESC, m.codmub DESC
      LIMIT 1
    ),
    'movimientos', coalesce((
      SELECT jsonb_agg(public.hu003_proyeccion_movimiento(m.codmub)
        ORDER BY m.fecmub DESC, m.hormub DESC, m.codmub DESC)
      FROM public.movimientoubicacion m
      WHERE m.coduni = u.coduni
    ), '[]'::jsonb)
  ) INTO resultado
  FROM public.unidad u
  LEFT JOIN public.ubicacion ubicacion ON ubicacion.codubi = u.codubi
  WHERE u.coduni = p_coduni;

  IF resultado IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Unidad inexistente';
  END IF;
  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.hu003_proyeccion_movimiento(bigint),
  public.hu003_iniciar_movimiento(bigint, bigint, bigint, text),
  public.hu003_confirmar_recepcion(bigint, bigint),
  public.hu003_consultar_movimientos(bigint)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu003_iniciar_movimiento(bigint, bigint, bigint, text),
  public.hu003_confirmar_recepcion(bigint, bigint),
  public.hu003_consultar_movimientos(bigint)
TO authenticated;

COMMENT ON COLUMN public.movimientoubicacion.codusurec IS 'Usuario autenticado que confirma la recepción del movimiento.';
COMMENT ON COLUMN public.movimientoubicacion.fecrecmub IS 'Fecha de base de datos en la que se confirma la recepción.';
COMMENT ON COLUMN public.movimientoubicacion.horrecmub IS 'Hora de base de datos en la que se confirma la recepción.';

COMMIT;
