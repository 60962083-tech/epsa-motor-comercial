BEGIN;

-- HU-007 depende solamente de la base HU-026/HU-034. No introduce roles nuevos.
-- Reutiliza hu026_rol_actual, manteniendo idéntica la regla de usuario y rol activos
-- que siguen aplicando las políticas RLS y las RPC de las historias existentes.
CREATE OR REPLACE FUNCTION public.hu007_usuario_actual()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH perfil AS (
    SELECT u.codusu, u.uuidusu, public.hu026_rol_actual() AS rol
    FROM public.usuario u
    WHERE u.uuidusu = auth.uid() AND u.estusu
  )
  SELECT jsonb_build_object('codusu', codusu::text, 'uuidusu', uuidusu::text, 'rol', rol)
  FROM perfil WHERE rol IN ('Gerente', 'Administradora', 'Vendedor')
$$;

REVOKE ALL ON FUNCTION public.hu007_usuario_actual() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hu007_usuario_actual() TO authenticated;

COMMIT;
