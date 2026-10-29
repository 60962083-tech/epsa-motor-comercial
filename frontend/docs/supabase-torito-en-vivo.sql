-- =====================================================================
-- EPSA Motor · Leer torito.pe en vivo (HU-036)
--
-- Qué hace: permite que el botón «Traer información de torito.pe» del panel
-- lea en ese momento la web oficial de torito.pe (precios, colores, ficha
-- técnica y fotos de cada modelo). El navegador no puede leer otra web por
-- seguridad; estas funciones la leen desde el servidor de Supabase:
--   hu036_pagina_torito: devuelve la página al panel, que guarda los cambios
--     con la API de modelos.
--   hu036_imagen_torito: descarga una foto de torito.pe para que el panel la
--     guarde como archivo propio en Supabase Storage (bucket «modelos») y
--     reemplace a la anterior. Así las fotos quedan en nuestra base y no
--     dependen de que torito.pe las mantenga.
--
-- Seguridad: solo gerente o administradora, solo páginas de torito.pe
-- (/productos/ y /producto/<modelo>/) y solo imágenes de sus fotos
-- (/wp-content/uploads/…png, jpg o webp, hasta 6 MB). No guarda ni borra nada.
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

-- Una foto de torito.pe: { tipo: "image/png", base64: "…" }
CREATE OR REPLACE FUNCTION public.hu036_imagen_torito(p_url text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_respuesta extensions.http_response;
  v_bytes bytea;
  v_tipo text;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo gerencia o administración pueden traer fotos de torito.pe.';
  END IF;
  IF p_url IS NULL OR p_url !~ '^https://torito\.pe/wp-content/uploads/[A-Za-z0-9/_.-]{1,200}\.(png|jpe?g|webp)$' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Solo se pueden traer fotos de torito.pe.';
  END IF;

  BEGIN
    PERFORM extensions.http_set_curlopt('CURLOPT_TIMEOUT_MS', '30000');
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  SELECT * INTO v_respuesta FROM extensions.http((
    'GET', p_url,
    ARRAY[extensions.http_header('User-Agent', 'Mozilla/5.0 (EPSA Motor; catalogo)'), extensions.http_header('Accept', 'image/png,image/jpeg,image/webp')],
    NULL, NULL
  )::extensions.http_request);

  IF v_respuesta.status IS DISTINCT FROM 200 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT502', MESSAGE = 'torito.pe no entregó la foto (código ' || coalesce(v_respuesta.status::text, 'sin respuesta') || ').';
  END IF;
  v_tipo := lower(btrim(split_part(coalesce(v_respuesta.content_type, ''), ';', 1)));
  IF v_tipo NOT IN ('image/png', 'image/jpeg', 'image/webp') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT415', MESSAGE = 'Lo que entregó torito.pe no es una foto.';
  END IF;
  -- El contenido binario se lee completo con textsend (un cast a bytea se cortaría en el primer byte cero)
  v_bytes := pg_catalog.textsend(v_respuesta.content);
  IF octet_length(v_bytes) = 0 OR octet_length(v_bytes) > 6 * 1024 * 1024 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT413', MESSAGE = 'La foto de torito.pe está vacía o pesa más de 6 MB.';
  END IF;
  RETURN jsonb_build_object('tipo', v_tipo, 'base64', encode(v_bytes, 'base64'));
END;
$$;

REVOKE ALL ON FUNCTION public.hu036_imagen_torito(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.hu036_imagen_torito(text) TO authenticated;

-- Almacenamiento de las fotos (bucket «modelos», público para que la web las muestre).
-- Si ya existe con sus permisos, no se cambia nada.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('modelos', 'modelos', true, 6291456, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudo crear el bucket modelos: %', SQLERRM;
  END;
  -- Gerencia y administración suben, reemplazan y borran fotos de ese bucket
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'modelos_insert_gestion') THEN
      EXECUTE $p$CREATE POLICY modelos_insert_gestion ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))$p$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'modelos_select_gestion') THEN
      EXECUTE $p$CREATE POLICY modelos_select_gestion ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated
        USING (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))$p$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'modelos_update_gestion') THEN
      EXECUTE $p$CREATE POLICY modelos_update_gestion ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated
        USING (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))
        WITH CHECK (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))$p$;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'modelos_delete_gestion') THEN
      EXECUTE $p$CREATE POLICY modelos_delete_gestion ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated
        USING (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))$p$;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'No se pudieron crear los permisos del bucket modelos: %', SQLERRM;
  END;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Comprobación: debe salir el título de la página de productos de torito.pe
SELECT substring(content FROM '<title>([^<]*)</title>') AS pagina, status
FROM extensions.http_get('https://torito.pe/productos/');

-- Comprobación del almacenamiento: debe salir modelos | true
SELECT id, public FROM storage.buckets WHERE id = 'modelos';

-- Comprobación de fotos: debe salir 200, image/png y su tamaño en bytes
SELECT status, content_type, octet_length(textsend(content)) AS bytes
FROM extensions.http_get('https://torito.pe/wp-content/uploads/2026/09/torito_hrv_azul_34frontal.png');
