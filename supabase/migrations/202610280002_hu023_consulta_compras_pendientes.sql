BEGIN;

-- HU-023: consulta administrativa consolidada. La salida es una proyección JSON
-- explícita; las tablas documentales siguen sin acceso directo para el cliente.
CREATE OR REPLACE FUNCTION public.hu023_consultar_compras_pendientes(
  p_origen text DEFAULT NULL,
  p_limite integer DEFAULT 200,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_rol text;
  v_resultado jsonb;
BEGIN
  v_rol := public.hu026_rol_actual();
  IF v_rol IS NULL OR v_rol NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'No autorizado para consultar compras pendientes';
  END IF;

  IF p_limite IS NULL OR p_limite < 1 OR p_limite > 200
     OR p_offset IS NULL OR p_offset < 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Paginación fuera de rango';
  END IF;

  IF p_origen IS NOT NULL AND p_origen NOT IN ('Automatico', 'Automático', 'Manual', 'No determinado') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Filtro de origen no válido';
  END IF;

  WITH movimientos_activos AS (
    SELECT m.coduni, m.estmub
    FROM public.movimientoubicacion m
    WHERE m.estmub IN ('Pendiente', 'En transito')
  ), unidades_clasificadas AS (
    SELECT
      u.coduni,
      u.codcom,
      CASE
        WHEN ma.estmub = 'En transito' THEN 'En tránsito'
        WHEN ma.estmub = 'Pendiente' THEN 'Movimiento pendiente'
        WHEN u.codubi IS NULL THEN 'Sin ubicación confirmada'
        WHEN uk.codubi IS NOT NULL THEN 'En Crosland'
        WHEN s.codsed IS NOT NULL THEN 'Recibida en EPSA'
        ELSE 'En otra ubicación confirmada'
      END AS estado_recepcion
    FROM public.unidad u
    LEFT JOIN movimientos_activos ma ON ma.coduni = u.coduni
    LEFT JOIN public.ubicacion ub ON ub.codubi = u.codubi
    LEFT JOIN public.ubicacionclave uk
      ON uk.codubi = ub.codubi AND uk.claubi = 'ALMACEN_CROSLAND_ANCON' AND uk.estucl = true
    LEFT JOIN public.sede s ON s.codubi = ub.codubi AND s.estsed = true
  ), resumen_unidades AS (
    SELECT
      uc.codcom,
      count(*)::integer AS cantidad_identificada,
      count(*) FILTER (WHERE uc.estado_recepcion = 'En Crosland')::integer AS en_crossland,
      count(*) FILTER (WHERE uc.estado_recepcion = 'En tránsito')::integer AS en_transito,
      count(*) FILTER (WHERE uc.estado_recepcion = 'Recibida en EPSA')::integer AS recibidas_en_epsa,
      count(*) FILTER (WHERE uc.estado_recepcion = 'Sin ubicación confirmada')::integer AS sin_ubicacion,
      count(*) FILTER (WHERE uc.estado_recepcion = 'Movimiento pendiente')::integer AS movimiento_pendiente,
      count(*) FILTER (WHERE uc.estado_recepcion = 'En otra ubicación confirmada')::integer AS otra_ubicacion
    FROM unidades_clasificadas uc
    GROUP BY uc.codcom
  ), codigos_incidencia AS (
    SELECT q.coddoc,
      array_agg(DISTINCT q.codigo::text ORDER BY q.codigo::text) AS codigos
    FROM (
      SELECT d.coddoc, d.coderrdoc AS codigo
      FROM public.documentocompra d
      WHERE d.coderrdoc ~ '^[A-Z0-9_]{1,80}$'
      UNION ALL
      SELECT l.coddoc, l.motlin AS codigo
      FROM public.lineadocumentocompra l
      WHERE l.estlin IN ('Revision', 'Error') AND l.motlin ~ '^[A-Z0-9_]{1,80}$'
      UNION ALL
      SELECT l.coddoc, v.motvehdoc AS codigo
      FROM public.vehiculodocumento v
      JOIN public.lineadocumentocompra l ON l.codlin = v.codlin
      WHERE v.estvehdoc IN ('Revision', 'Error') AND v.motvehdoc ~ '^[A-Z0-9_]{1,80}$'
    ) q
    GROUP BY q.coddoc
  ), documentos_proyectados AS (
    SELECT
      d.coddoc,
      d.iddoc,
      d.serdoc,
      d.numdoc,
      d.fecemidoc,
      d.fecgmailrec,
      d.fecbackendrec,
      d.razonsocialemisordoc,
      d.estdoc,
      d.coderrdoc,
      d.advertencias,
      coalesce(ci.codigos, ARRAY[]::text[]) AS codigos_incidencia,
      (
        d.estdoc IN ('Pendiente de revision', 'Importado parcialmente', 'Error')
        OR EXISTS (
          SELECT 1 FROM public.lineadocumentocompra l
          WHERE l.coddoc = d.coddoc AND l.estlin IN ('Revision', 'Error')
        )
        OR EXISTS (
          SELECT 1 FROM public.vehiculodocumento v
          JOIN public.lineadocumentocompra l ON l.codlin = v.codlin
          WHERE l.coddoc = d.coddoc AND v.estvehdoc IN ('Revision', 'Error')
        )
      ) AS tiene_incidencia,
      CASE
        WHEN d.coderrdoc = 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO'
          THEN 'La misma identidad documental llegó con contenido distinto.'
        WHEN d.estdoc = 'Error'
          THEN 'La importación del documento falló y requiere revisión.'
        WHEN d.estdoc = 'Pendiente de revision'
          THEN 'El documento está pendiente de revisión.'
        WHEN d.estdoc = 'Importado parcialmente'
          THEN 'El documento contiene líneas o vehículos que requieren revisión.'
        WHEN coalesce(ci.codigos, ARRAY[]::text[]) <> ARRAY[]::text[]
          THEN 'El documento contiene líneas o vehículos que requieren revisión.'
        ELSE NULL
      END AS motivo_sanitizado,
      CASE
        WHEN d.coderrdoc ~ '^[A-Z0-9_]{1,80}$' THEN d.coderrdoc
        WHEN coalesce(ci.codigos, ARRAY[]::text[]) <> ARRAY[]::text[] THEN ci.codigos[1]
        WHEN d.estdoc = 'Error' THEN 'ERROR_TECNICO_IMPORTACION'
        WHEN d.estdoc = 'Pendiente de revision' THEN 'DOCUMENTO_PENDIENTE_REVISION'
        WHEN d.estdoc = 'Importado parcialmente' THEN 'REVISION_DE_LINEAS'
        ELSE NULL
      END AS codigo_sanitizado,
      CASE
        WHEN pg_catalog.jsonb_typeof(d.advertencias) = 'array' THEN d.advertencias
        ELSE '[]'::jsonb
      END AS advertencias_json
    FROM public.documentocompra d
    LEFT JOIN codigos_incidencia ci ON ci.coddoc = d.coddoc
  ), documentos_vinculados AS (
    SELECT
      dcc.codcom,
      d.coddoc,
      d.fecbackendrec,
      d.fecemidoc,
      d.estdoc,
      d.motivo_sanitizado,
      d.tiene_incidencia,
      pg_catalog.jsonb_build_object(
        'coddoc', d.coddoc::text,
        'numeroDocumento', coalesce(nullif(d.iddoc, ''), nullif(pg_catalog.concat_ws('-', d.serdoc, d.numdoc), '-')),
        'tipoVinculo', dcc.tipvinculo,
        'estadoDocumento', d.estdoc,
        'codigoIncidencia', d.codigo_sanitizado,
        'motivoIncidencia', d.motivo_sanitizado,
        'advertencias', (
          SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(w.codigo) ORDER BY w.codigo), '[]'::jsonb)
          FROM pg_catalog.jsonb_array_elements_text(d.advertencias_json) AS w(codigo)
          WHERE w.codigo ~ '^[A-Z0-9_]{1,80}$'
        )
      ) AS documento_json
    FROM public.documentocompracompra dcc
    JOIN documentos_proyectados d ON d.coddoc = dcc.coddoc
  ), resumen_documentos AS (
    SELECT
      dv.codcom,
      pg_catalog.jsonb_agg(dv.documento_json ORDER BY dv.fecbackendrec DESC NULLS LAST, dv.coddoc DESC) AS documentos,
      pg_catalog.bool_or(dv.tiene_incidencia) AS tiene_incidencia
    FROM documentos_vinculados dv
    GROUP BY dv.codcom
  ), documento_principal AS (
    SELECT DISTINCT ON (dv.codcom)
      dv.codcom, dv.coddoc, dv.documento_json,
      d.iddoc, d.serdoc, d.numdoc, d.fecemidoc, d.fecbackendrec, d.estdoc,
      d.motivo_sanitizado, d.codigo_sanitizado
    FROM documentos_vinculados dv
    JOIN documentos_proyectados d ON d.coddoc = dv.coddoc
    ORDER BY dv.codcom, dv.fecbackendrec DESC NULLS LAST, dv.coddoc DESC
  ), referencias AS (
    SELECT r.codcom,
      pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('tipo', r.tipref, 'valor', r.valreforiginal)
        ORDER BY r.codref) AS referencias,
      (pg_catalog.array_agg(r.valreforiginal ORDER BY r.codref))[1] AS refcom
    FROM public.referenciacompra r
    WHERE r.estref = 'Activa'
    GROUP BY r.codcom
  ), compras_base AS (
    SELECT
      c.codcom,
      c.feccom,
      c.horcom,
      c.colcom,
      c.cancom,
      mo.nommod,
      coalesce(ru.cantidad_identificada, 0)::integer AS cantidad_identificada,
      greatest(c.cancom - coalesce(ru.cantidad_identificada, 0), 0)::integer AS cantidad_pendiente_identificacion,
      coalesce(ru.en_crossland, 0)::integer AS en_crossland,
      coalesce(ru.en_transito, 0)::integer AS en_transito,
      coalesce(ru.recibidas_en_epsa, 0)::integer AS recibidas_en_epsa,
      coalesce(ru.sin_ubicacion, 0)::integer AS sin_ubicacion,
      coalesce(ru.movimiento_pendiente, 0)::integer AS movimiento_pendiente,
      coalesce(ru.otra_ubicacion, 0)::integer AS otra_ubicacion,
      fc.codfac,
      fc.numero AS numero_factura_registrada,
      fc.fecha_emision AS fecha_factura_registrada,
      fc.cantidad_motos AS cantidad_factura,
      dp.coddoc AS coddoc_principal,
      coalesce(nullif(dp.iddoc, ''), nullif(pg_catalog.concat_ws('-', dp.serdoc, dp.numdoc), '-')) AS numero_documento_principal,
      dp.fecemidoc AS fecha_emision_documento,
      dp.fecbackendrec AS fecha_importacion_documento,
      dp.estdoc AS estado_documento_principal,
      dp.motivo_sanitizado AS motivo_documento_principal,
      dp.codigo_sanitizado AS codigo_documento_principal,
      coalesce(rd.documentos, '[]'::jsonb) AS documentos,
      coalesce(rd.tiene_incidencia, false) AS incidencia_documental,
      coalesce(ref.refcom, '') AS refcom,
      coalesce(ref.referencias, '[]'::jsonb) AS referencias,
      EXISTS (
        SELECT 1 FROM public.documentocompracompra dcc
        WHERE dcc.codcom = c.codcom AND dcc.tipvinculo = 'Automatico'
      ) AS tiene_vinculo_automatico,
      c.idempotencia IS NOT NULL AS tiene_idempotencia
    FROM public.compra c
    JOIN public.modelo mo ON mo.codmod = c.codmod
    LEFT JOIN resumen_unidades ru ON ru.codcom = c.codcom
    LEFT JOIN public.factura_compra fc ON fc.codcom = c.codcom
    LEFT JOIN documento_principal dp ON dp.codcom = c.codcom
    LEFT JOIN resumen_documentos rd ON rd.codcom = c.codcom
    LEFT JOIN referencias ref ON ref.codcom = c.codcom
  ), compras_clasificadas AS (
    SELECT cb.*,
      CASE
        WHEN cb.tiene_vinculo_automatico AND cb.tiene_idempotencia THEN 'No determinado'
        WHEN cb.tiene_vinculo_automatico THEN 'Automatico'
        WHEN cb.tiene_idempotencia THEN 'Manual'
        ELSE 'No determinado'
      END AS origen,
      (cb.cantidad_factura IS NOT NULL AND cb.cantidad_factura <> cb.cancom) AS bloqueada_por_discrepancia,
      CASE
        WHEN cb.codfac IS NULL THEN 'Pendiente de factura'
        WHEN cb.cantidad_factura <> cb.cancom OR cb.cantidad_pendiente_identificacion > 0 THEN 'Pendiente de identificación'
        ELSE 'Identificada'
      END AS estado_identificacion,
      (
        cb.cantidad_identificada > 0
        AND (cb.en_crossland + cb.en_transito + cb.sin_ubicacion + cb.movimiento_pendiente) > 0
      ) AS pendiente_recepcion,
      (
        cb.incidencia_documental
        OR (cb.cantidad_factura IS NOT NULL AND cb.cantidad_factura <> cb.cancom)
      ) AS incidencia
    FROM compras_base cb
  ), compras_situaciones AS (
    SELECT cc.*,
      pg_catalog.array_remove(ARRAY[
        CASE WHEN cc.codfac IS NULL THEN 'Pendiente de factura'::text END,
        CASE WHEN cc.codfac IS NOT NULL AND (cc.cantidad_pendiente_identificacion > 0 OR cc.bloqueada_por_discrepancia)
          THEN 'Pendiente de identificación'::text END,
        CASE WHEN cc.pendiente_recepcion THEN 'Pendiente de recepción'::text END,
        CASE WHEN cc.incidencia THEN 'Incidencia documental'::text END
      ], NULL) AS situaciones,
      CASE
        WHEN cc.cantidad_identificada = 0 THEN 'Sin unidades identificadas'
        WHEN cc.recibidas_en_epsa = cc.cantidad_identificada THEN 'Recibida en EPSA'
        WHEN cc.otra_ubicacion = cc.cantidad_identificada THEN 'En otra ubicación confirmada'
        WHEN cc.en_crossland + cc.en_transito + cc.sin_ubicacion + cc.movimiento_pendiente = cc.cantidad_identificada THEN
          CASE
            WHEN cc.en_crossland = cc.cantidad_identificada THEN 'En Crosland'
            WHEN cc.en_transito = cc.cantidad_identificada THEN 'En tránsito'
            WHEN cc.sin_ubicacion = cc.cantidad_identificada THEN 'Sin ubicación confirmada'
            WHEN cc.movimiento_pendiente = cc.cantidad_identificada THEN 'Movimiento pendiente'
            ELSE 'Recepción pendiente'
          END
        WHEN cc.en_crossland + cc.en_transito + cc.sin_ubicacion + cc.movimiento_pendiente > 0 THEN 'Recepción mixta'
        ELSE 'Ubicación confirmada mixta'
      END AS estado_recepcion
    FROM compras_clasificadas cc
  ), compras_filtradas AS (
    SELECT cs.*
    FROM compras_situaciones cs
    WHERE cardinality(cs.situaciones) > 0
      AND (
        p_origen IS NULL
        OR cs.origen = CASE WHEN p_origen = 'Automático' THEN 'Automatico' ELSE p_origen END
      )
  ), documentos_sin_compra AS (
    SELECT d.*
    FROM documentos_proyectados d
    WHERE (d.estdoc IN ('Pendiente de revision', 'Error')
      OR (d.estdoc = 'Importado parcialmente' AND d.tiene_incidencia))
      AND NOT EXISTS (
        SELECT 1 FROM public.documentocompracompra dcc WHERE dcc.coddoc = d.coddoc
      )
  ), conteos AS (
    SELECT
      count(*) FILTER (WHERE 'Pendiente de factura' = ANY(cf.situaciones))::integer AS pendiente_factura,
      count(*) FILTER (WHERE 'Pendiente de identificación' = ANY(cf.situaciones))::integer AS pendiente_identificacion,
      count(*) FILTER (WHERE 'Pendiente de recepción' = ANY(cf.situaciones))::integer AS pendiente_recepcion,
      count(*) FILTER (WHERE 'Incidencia documental' = ANY(cf.situaciones))::integer AS incidencia_documental
    FROM compras_filtradas cf
  ), pagina AS (
    SELECT cf.*
    FROM compras_filtradas cf
    ORDER BY cf.feccom DESC, cf.horcom DESC, cf.codcom DESC
    LIMIT p_limite OFFSET p_offset
  ), compras_json AS (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'codcom', p.codcom::text,
        'feccom', p.feccom,
        'horcom', p.horcom,
        'refcom', nullif(p.refcom, ''),
        'referencias', p.referencias,
        'origen', p.origen,
        'nommod', p.nommod,
        'colcom', p.colcom,
        'cantidad_comprada', p.cancom,
        'cantidad_identificada', p.cantidad_identificada,
        'cantidad_pendiente_identificacion', p.cantidad_pendiente_identificacion,
        'estadoIdentificacion', p.estado_identificacion,
        'bloqueadaPorDiscrepancia', p.bloqueada_por_discrepancia,
        'estadoRecepcion', p.estado_recepcion,
        'recepcion', pg_catalog.jsonb_build_object(
          'enCrossland', p.en_crossland,
          'enTransito', p.en_transito,
          'recibidasEnEpsa', p.recibidas_en_epsa,
          'sinUbicacion', p.sin_ubicacion,
          'movimientoPendiente', p.movimiento_pendiente,
          'otraUbicacion', p.otra_ubicacion
        ),
        'cantidad_pendiente_recepcion', p.en_crossland + p.en_transito + p.sin_ubicacion + p.movimiento_pendiente,
        'cantidad_sin_ubicacion', p.sin_ubicacion,
        'cantidad_en_traslado', p.en_transito,
        'cantidad_recibida', p.recibidas_en_epsa,
        'documentos', p.documentos,
        'factura', CASE
          WHEN p.coddoc_principal IS NOT NULL THEN pg_catalog.jsonb_build_object(
            'coddoc', p.coddoc_principal::text,
            'numero', p.numero_documento_principal,
            'tipo', 'Importada',
            'fecha_importacion', p.fecha_importacion_documento,
            'fecha_emision', p.fecha_emision_documento,
            'estado', p.estado_documento_principal,
            'motivo', p.motivo_documento_principal,
            'codigoIncidencia', p.codigo_documento_principal
          )
          WHEN p.codfac IS NOT NULL THEN pg_catalog.jsonb_build_object(
            'codfac', p.codfac::text,
            'numero', p.numero_factura_registrada,
            'tipo', 'Registrada',
            'fecha_emision', p.fecha_factura_registrada,
            'estado', CASE WHEN p.bloqueada_por_discrepancia THEN 'Pendiente de revisión' ELSE NULL END,
            'motivo', CASE WHEN p.bloqueada_por_discrepancia THEN 'La cantidad registrada en la factura no coincide con la compra.' ELSE NULL END,
            'codigoIncidencia', CASE WHEN p.bloqueada_por_discrepancia THEN 'DISCREPANCIA_CANTIDAD_FACTURA' ELSE NULL END
          )
          ELSE NULL
        END,
        'situaciones', pg_catalog.to_jsonb(p.situaciones)
      ) ORDER BY p.feccom DESC, p.horcom DESC, p.codcom DESC
    ), '[]'::jsonb) AS datos
    FROM pagina p
  ), documentos_sin_compra_json AS (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'coddoc', d.coddoc::text,
        'numero', coalesce(nullif(d.iddoc, ''), nullif(pg_catalog.concat_ws('-', d.serdoc, d.numdoc), '-')),
        'numeroDocumento', coalesce(nullif(d.iddoc, ''), nullif(pg_catalog.concat_ws('-', d.serdoc, d.numdoc), '-')),
        'fecha_emision', d.fecemidoc,
        'razon_emisor', d.razonsocialemisordoc,
        'recibido', d.fecgmailrec,
        'fecha_registro', d.fecbackendrec,
        'estado', d.estdoc,
        'motivo', d.motivo_sanitizado,
        'codigoIncidencia', d.codigo_sanitizado,
        'advertencias', (
          SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(w.codigo) ORDER BY w.codigo), '[]'::jsonb)
          FROM pg_catalog.jsonb_array_elements_text(d.advertencias_json) AS w(codigo)
          WHERE w.codigo ~ '^[A-Z0-9_]{1,80}$'
        )
      ) ORDER BY d.fecbackendrec DESC, d.coddoc DESC
    ), '[]'::jsonb) AS datos
    FROM documentos_sin_compra d
  )
  SELECT pg_catalog.jsonb_build_object(
    'compras', cj.datos,
    'documentos_sin_compra', dsj.datos,
    'conteo', pg_catalog.jsonb_build_object(
      'Pendiente de factura', co.pendiente_factura,
      'Pendiente de identificación', co.pendiente_identificacion,
      'Pendiente de recepción', co.pendiente_recepcion,
      'Incidencia documental', co.incidencia_documental
    ),
    'total', (SELECT count(*)::integer FROM compras_filtradas),
    'limite', p_limite,
    'offset', p_offset
  )
  INTO v_resultado
  FROM compras_json cj
  CROSS JOIN documentos_sin_compra_json dsj
  CROSS JOIN conteos co;

  RETURN v_resultado;
END
$function$;

REVOKE ALL ON FUNCTION public.hu023_consultar_compras_pendientes(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu023_consultar_compras_pendientes(text, integer, integer) TO authenticated;

COMMENT ON FUNCTION public.hu023_consultar_compras_pendientes(text, integer, integer) IS
  'HU-023: compras, recepción por categoría y documentos con incidencia. Solo Gerente/Administradora; acceso vía proyección con rol validado en BD.';

COMMIT;
