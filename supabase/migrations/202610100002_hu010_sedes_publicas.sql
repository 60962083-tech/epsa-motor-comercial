BEGIN;

-- Proyección pública de sedes comerciales; no expone acceso directo a las tablas.
-- HU-026 conserva su SELECT autenticado sobre ubicacion. La RPC puede leer ambas tablas
-- como propietaria; los clientes anónimos y autenticados no consultan sede directamente.
REVOKE ALL ON public.sede FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.ubicacion FROM PUBLIC, anon;
GRANT SELECT ON public.ubicacion TO authenticated;

CREATE OR REPLACE FUNCTION public.hu010_sedes_publicas()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'codsed', s.codsed::text,
    'nomsed', u.nomubi,
    'dirsed', u.dirubi,
    'telsed', s.telsed,
    'horsed', s.horsed
  ) ORDER BY u.nomubi, s.codsed), '[]'::jsonb)
  FROM public.sede s
  JOIN public.ubicacion u ON u.codubi = s.codubi
  WHERE s.estsed = true
    AND u.estubi = true
    AND u.tipubi = 'Sede'
$$;

REVOKE ALL ON FUNCTION public.hu010_sedes_publicas() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hu010_sedes_publicas() TO anon, authenticated;

COMMIT;
