BEGIN;

-- El bucket `modelos` se crea y configura manualmente en Supabase Storage.
-- Estas policies no crean buckets ni modifican políticas de otros buckets.
-- La función HU-026 ya resuelve auth.uid(), usuario activo y rol activo.

DROP POLICY IF EXISTS modelos_insert_gestion ON storage.objects;
DROP POLICY IF EXISTS modelos_select_gestion ON storage.objects;
DROP POLICY IF EXISTS modelos_update_gestion ON storage.objects;
DROP POLICY IF EXISTS modelos_delete_gestion ON storage.objects;
DROP POLICY IF EXISTS modelos_insert_guard_authenticated ON storage.objects;
DROP POLICY IF EXISTS modelos_update_guard_authenticated ON storage.objects;
DROP POLICY IF EXISTS modelos_delete_guard_authenticated ON storage.objects;
DROP POLICY IF EXISTS modelos_insert_guard_anon ON storage.objects;
DROP POLICY IF EXISTS modelos_update_guard_anon ON storage.objects;
DROP POLICY IF EXISTS modelos_delete_guard_anon ON storage.objects;

-- Permisos positivos limitados al bucket público de fotografías de modelos.
-- SELECT permite a gerencia listar/metadatos y reemplazar objetos con upsert;
-- la descarga pública de objetos la controla la configuración public del bucket.
CREATE POLICY modelos_select_gestion ON storage.objects
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    bucket_id = 'modelos'
    AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora')
  );

CREATE POLICY modelos_insert_gestion ON storage.objects
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'modelos'
    AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora')
  );

CREATE POLICY modelos_update_gestion ON storage.objects
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    bucket_id = 'modelos'
    AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora')
  )
  WITH CHECK (
    bucket_id = 'modelos'
    AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora')
  );

CREATE POLICY modelos_delete_gestion ON storage.objects
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    bucket_id = 'modelos'
    AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora')
  );

-- Restrictive guards make the role/bucket boundary hold even if another broad
-- permissive Storage policy exists. Their predicate is neutral for every other
-- bucket, so this migration does not change compra-factura or other buckets.
CREATE POLICY modelos_insert_guard_authenticated ON storage.objects
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IS DISTINCT FROM 'modelos'
    OR (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))
  );

CREATE POLICY modelos_update_guard_authenticated ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    bucket_id IS DISTINCT FROM 'modelos'
    OR (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))
  )
  WITH CHECK (
    bucket_id IS DISTINCT FROM 'modelos'
    OR (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))
  );

CREATE POLICY modelos_delete_guard_authenticated ON storage.objects
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (
    bucket_id IS DISTINCT FROM 'modelos'
    OR (bucket_id = 'modelos' AND COALESCE(public.hu026_rol_actual(), '') IN ('Gerente', 'Administradora'))
  );

-- Explicitly deny anonymous writes to this bucket, including if a broad
-- permissive policy for PUBLIC/anon is present. Other buckets are unaffected.
CREATE POLICY modelos_insert_guard_anon ON storage.objects
  AS RESTRICTIVE FOR INSERT TO anon
  WITH CHECK (bucket_id IS DISTINCT FROM 'modelos' OR (bucket_id = 'modelos' AND false));

CREATE POLICY modelos_update_guard_anon ON storage.objects
  AS RESTRICTIVE FOR UPDATE TO anon
  USING (bucket_id IS DISTINCT FROM 'modelos' OR (bucket_id = 'modelos' AND false))
  WITH CHECK (bucket_id IS DISTINCT FROM 'modelos' OR (bucket_id = 'modelos' AND false));

CREATE POLICY modelos_delete_guard_anon ON storage.objects
  AS RESTRICTIVE FOR DELETE TO anon
  USING (bucket_id IS DISTINCT FROM 'modelos' OR (bucket_id = 'modelos' AND false));

-- Public downloads use the manually configured public bucket; no SELECT policy
-- or CRUD grant is added here.

COMMIT;
