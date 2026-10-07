-- Solo lectura. Ejecutar en el SQL Editor de Supabase con el rol administrador.
-- No devuelve filas de negocio ni credenciales. Revisar todos los resultados.
SELECT c.oid::regclass AS tabla, c.relrowsecurity AS rls,
       c.relforcerowsecurity AS forzar_rls, pg_get_userbyid(c.relowner) AS propietario,
       r.rolname AS rol, r.rolsuper, r.rolbypassrls,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS select_tabla,
       has_any_column_privilege(r.oid, c.oid, 'SELECT') AS select_alguna_columna
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname = 'public' AND c.relname IN ('modelo', 'imagenmodelo')
  AND r.rolname IN ('anon', 'authenticated');

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('modelo', 'imagenmodelo');

SELECT table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN ('modelo', 'imagenmodelo');

SELECT table_name, column_name, grantee, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('modelo', 'imagenmodelo')
  AND privilege_type = 'SELECT';

SELECT p.oid::regprocedure AS funcion, p.prosecdef AS security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS ejecuta_anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS ejecuta_authenticated
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'hu012_modelos_publicados';
