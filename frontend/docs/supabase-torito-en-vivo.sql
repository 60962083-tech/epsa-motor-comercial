-- =====================================================================
-- EPSA Motor · Leer torito.pe en vivo (HU-036)
--
-- Qué hace: permite que el botón «Traer información de torito.pe» del panel
-- lea en ese momento la web oficial de torito.pe (precios, colores, ficha
-- técnica y fotos de cada modelo). El navegador no puede leer otra web por
-- seguridad; esta función la lee desde el servidor de Supabase y le devuelve
-- la página al panel, que guarda los cambios con la API de modelos.
--
-- Seguridad: solo gerente o administradora, y solo páginas de torito.pe
-- (/productos/ y /producto/<modelo>/). No guarda ni borra nada.
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez sin dañar nada.
-- =====================================================================

-- Extensión para hacer pedidos web desde la base (viene con Supabase)
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.hu036_pagina_torito(p_ruta text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_respuesta extensions.http_response;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo gerencia o administración pueden traer información de torito.pe.';
  END IF;
  IF p_ruta IS NULL OR p_ruta !~ '^/(productos|producto/[a-z0-9-]{1,80})/$' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Solo se pueden leer páginas de productos de torito.pe.';
  END IF;

  -- Hasta 20 segundos por página
  BEGIN
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '20000');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  SELECT * INTO v_respuesta FROM extensions.http((
    'GET', 'https://torito.pe' || p_ruta,
    ARRAY[extensions.http_header('User-Agent', 'Mozilla/5.0 (EPSA Motor; catalogo)'), extensions.http_header('Accept', 'text/html')],
    NULL, NULL
  )::extensions.http_request);

  IF v_respuesta.status IS DISTINCT FROM 200 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT502', MESSAGE = 'torito.pe no respondió como se esperaba (código ' || coalesce(v_respuesta.status::text, 'sin respuesta') || ').';
  END IF;
  RETURN v_respuesta.content;
END;
$$;

REVOKE ALL ON FUNCTION public.hu036_pagina_torito(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hu036_pagina_torito(text) TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Comprobación: debe salir el título de la página de productos de torito.pe
SELECT substring(content FROM '<title>([^<]*)</title>') AS pagina, status
FROM extensions.http_get('https://torito.pe/productos/');
