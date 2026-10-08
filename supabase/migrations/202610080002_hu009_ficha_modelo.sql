BEGIN;

-- Proyección de ficha individual: modelo comercial e imágenes activas únicamente.
-- No consulta unidades, stock, compras, precios ni información del cliente.
CREATE OR REPLACE FUNCTION public.hu009_modelo_publicado_por_id(p_codmod bigint)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'codmod', m.codmod::text,
    'nommod', m.nommod,
    'marmod', m.marmod,
    'desmod', m.desmod,
    'carmod', m.carmod,
    'imagenes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('urlimo', i.urlimo, 'ordimo', i.ordimo)
        ORDER BY i.ordimo, i.codimo)
      FROM public.imagenmodelo i
      WHERE i.codmod = m.codmod AND i.estimo = true
    ), '[]'::jsonb)
  )
  FROM public.modelo m
  WHERE p_codmod > 0 AND m.codmod = p_codmod AND m.estmod = 'Publicado'
$$;

REVOKE ALL ON FUNCTION public.hu009_modelo_publicado_por_id(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hu009_modelo_publicado_por_id(bigint) TO anon, authenticated;

COMMENT ON FUNCTION public.hu009_modelo_publicado_por_id(bigint)
IS 'Ficha comercial pública de un modelo publicado; excluye inventario y estados internos.';

COMMIT;
