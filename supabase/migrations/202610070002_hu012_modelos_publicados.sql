BEGIN;

-- Acceso público limitado a esta proyección. No concede lectura de las tablas.
CREATE OR REPLACE FUNCTION public.hu012_modelos_publicados()
RETURNS TABLE (
  codmod text, nommod text, marmod text, desmod text, carmod text, imagenes jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT m.codmod::text, m.nommod::text, m.marmod::text, m.desmod, m.carmod,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('urlimo', i.urlimo, 'ordimo', i.ordimo)
        ORDER BY i.ordimo, i.codimo)
      FROM public.imagenmodelo i
      WHERE i.codmod = m.codmod AND i.estimo = true
    ), '[]'::jsonb)
  FROM public.modelo m
  WHERE m.estmod = 'Publicado'
  ORDER BY m.nommod, m.codmod
$$;

REVOKE ALL ON FUNCTION public.hu012_modelos_publicados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hu012_modelos_publicados() TO anon, authenticated;

COMMIT;
