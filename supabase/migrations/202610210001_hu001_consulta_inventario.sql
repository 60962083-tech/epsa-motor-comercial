BEGIN;

-- Los filtros por relaciones selectivas se apoyan en índices propios de HU-001.
-- codubi ya está cubierto por ix_unidad_ubicacion (HU-026).
CREATE INDEX IF NOT EXISTS ix_unidad_modelo ON public.unidad(codmod);
CREATE INDEX IF NOT EXISTS ix_unidad_techo ON public.unidad(codtte);
CREATE INDEX IF NOT EXISTS ix_unidad_preparacion ON public.unidad(codepr);

CREATE OR REPLACE FUNCTION public.hu001_consultar_inventario(
  p_codubi bigint DEFAULT NULL,
  p_codmod bigint DEFAULT NULL,
  p_estado text DEFAULT NULL,
  p_color text DEFAULT NULL,
  p_codtte bigint DEFAULT NULL,
  p_codepr bigint DEFAULT NULL,
  p_limite integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
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

  IF p_codubi IS NOT NULL AND p_codubi <= 0
     OR p_codmod IS NOT NULL AND p_codmod <= 0
     OR p_codtte IS NOT NULL AND p_codtte <= 0
     OR p_codepr IS NOT NULL AND p_codepr <= 0
     OR p_estado IS NOT NULL AND (pg_catalog.btrim(p_estado) = '' OR pg_catalog.char_length(p_estado) > 50)
     OR p_color IS NOT NULL AND (pg_catalog.btrim(p_color) = '' OR pg_catalog.char_length(p_color) > 50)
     OR p_limite IS NULL OR p_limite < 1 OR p_limite > 100
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Filtros o paginación inválidos';
  END IF;

  WITH unidades_filtradas AS MATERIALIZED (
    SELECT u.coduni,
      pg_catalog.jsonb_build_object(
        'coduni', u.coduni::text,
        'modelo', pg_catalog.jsonb_build_object('codmod', m.codmod::text, 'nommod', m.nommod),
        'color', u.coluni,
        'ubicacionConfirmada', CASE WHEN u.codubi IS NULL THEN NULL ELSE
          pg_catalog.jsonb_build_object('codubi', ubicacion.codubi::text,
            'nomubi', ubicacion.nomubi, 'tipubi', ubicacion.tipubi) END,
        'movimientoActivo', CASE WHEN movimiento.codmub IS NULL THEN NULL ELSE
          pg_catalog.jsonb_build_object('codmub', movimiento.codmub::text,
            'estado', movimiento.estmub,
            'destino', pg_catalog.jsonb_build_object('codubi', movimiento.codubides::text,
              'nomubi', destino.nomubi)) END,
        'techo', CASE WHEN techo.codtte IS NULL THEN NULL ELSE
          pg_catalog.jsonb_build_object('codtte', techo.codtte::text, 'nomtte', techo.nomtte) END,
        'preparacion', CASE WHEN preparacion.codepr IS NULL THEN NULL ELSE
          pg_catalog.jsonb_build_object('codepr', preparacion.codepr::text, 'nomepr', preparacion.nomepr) END,
        'situacionComercial', u.estcomuni
      ) AS item
    FROM public.unidad u
    JOIN public.modelo m ON m.codmod = u.codmod
    LEFT JOIN public.ubicacion ubicacion ON ubicacion.codubi = u.codubi
    LEFT JOIN public.tipotecho techo ON techo.codtte = u.codtte
    LEFT JOIN public.estadopreparacion preparacion ON preparacion.codepr = u.codepr
    LEFT JOIN public.movimientoubicacion movimiento
      ON movimiento.coduni = u.coduni AND movimiento.estmub IN ('Pendiente', 'En transito')
    LEFT JOIN public.ubicacion destino ON destino.codubi = movimiento.codubides
    WHERE (p_codubi IS NULL OR u.codubi = p_codubi)
      AND (p_codmod IS NULL OR u.codmod = p_codmod)
      AND (p_estado IS NULL OR u.estcomuni = p_estado)
      AND (p_color IS NULL OR u.coluni = p_color)
      AND (p_codtte IS NULL OR u.codtte = p_codtte)
      AND (p_codepr IS NULL OR u.codepr = p_codepr)
  ), unidades_por_compra AS MATERIALIZED (
    SELECT u.codcom, pg_catalog.count(*) AS cantidad_identificada
    FROM public.unidad u
    GROUP BY u.codcom
  )
  SELECT pg_catalog.jsonb_build_object(
    'items', coalesce((
      SELECT pg_catalog.jsonb_agg(p.item ORDER BY p.coduni)
      FROM (
        SELECT uf.coduni, uf.item FROM unidades_filtradas uf
        ORDER BY uf.coduni LIMIT p_limite OFFSET p_offset
      ) p
    ), '[]'::jsonb),
    'total', (SELECT pg_catalog.count(*) FROM unidades_filtradas),
    'limite', p_limite,
    'offset', p_offset,
    'resumen', pg_catalog.jsonb_build_object(
      'unidadesIdentificadas', (SELECT pg_catalog.count(*) FROM public.unidad),
      'cantidadPendienteIdentificacion', (
        SELECT coalesce(pg_catalog.sum(GREATEST(
          compra.cancom::bigint - coalesce(unidades_por_compra.cantidad_identificada, 0::bigint), 0::bigint
        )), 0)
        FROM public.compra compra
        JOIN public.factura_compra factura
          ON factura.codcom = compra.codcom AND factura.cantidad_motos = compra.cancom
        LEFT JOIN unidades_por_compra ON unidades_por_compra.codcom = compra.codcom
      )
    )
  ) INTO resultado;

  RETURN resultado;
END
$$;

REVOKE ALL ON FUNCTION public.hu001_consultar_inventario(bigint, bigint, text, text, bigint, bigint, integer, integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu001_consultar_inventario(bigint, bigint, text, text, bigint, bigint, integer, integer)
TO authenticated;

COMMENT ON FUNCTION public.hu001_consultar_inventario(bigint, bigint, text, text, bigint, bigint, integer, integer)
IS 'Consulta inventario interno con proyección controlada, movimiento activo y resumen global sin acceso directo a tablas.';

COMMIT;
