-- =====================================================================
-- EPSA Motor · Permisos por rol (pantalla «Roles y permisos» del gerente)
--
-- Qué hace: guarda qué secciones del panel puede ver cada rol. El gerente
-- siempre ve todo; aquí solo se activan o desactivan secciones para la
-- administradora y el vendedor. Sin filas, cada rol ve lo de siempre.
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez sin dañar nada. Usa Chrome con el
-- traductor apagado.
-- =====================================================================

BEGIN;

-- Tabla: una fila por rol y sección cambiada por el gerente
CREATE TABLE IF NOT EXISTS public.permiso_rol (
  codrol  bigint      NOT NULL REFERENCES public.rol(codrol),
  seccion varchar(40) NOT NULL,
  activo  boolean     NOT NULL DEFAULT true,
  codusu  bigint      REFERENCES public.usuario(codusu),
  fecmod  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_permiso_rol PRIMARY KEY (codrol, seccion),
  CONSTRAINT chk_permiso_rol_seccion CHECK (seccion ~ '^[A-Za-z]{2,40}$')
);

-- Solo se lee y escribe con las funciones de abajo
ALTER TABLE public.permiso_rol ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.permiso_rol FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS permiso_rol_solo_rpc ON public.permiso_rol;
CREATE POLICY permiso_rol_solo_rpc ON public.permiso_rol AS RESTRICTIVE FOR ALL TO PUBLIC
  USING (false) WITH CHECK (false);

-- Lectura: cualquier usuario activo del panel (cada uno arma su menú con esto)
CREATE OR REPLACE FUNCTION public.permisos_listar()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('rol', r.nomrol, 'seccion', p.seccion, 'activo', p.activo, 'fecha', p.fecmod)
                     ORDER BY r.nomrol, p.seccion)
    FROM public.permiso_rol p JOIN public.rol r ON r.codrol = p.codrol), '[]'::jsonb);
END $$;

-- Escritura: solo el gerente, y solo para la administradora y el vendedor
CREATE OR REPLACE FUNCTION public.permisos_guardar(p_rol text, p_seccion text, p_activo boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_codrol bigint;
  v_autor  bigint;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') <> 'Gerente' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo el gerente cambia los permisos';
  END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Solo se cambian los permisos de la administradora y el vendedor';
  END IF;
  IF p_seccion IS NULL OR p_seccion !~ '^[A-Za-z]{2,40}$' OR p_activo IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Sección o estado no válidos';
  END IF;
  SELECT codrol INTO v_codrol FROM public.rol WHERE nomrol = p_rol;
  IF v_codrol IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El rol no existe';
  END IF;
  SELECT codusu INTO v_autor FROM public.usuario WHERE uuidusu = auth.uid() AND estusu;
  INSERT INTO public.permiso_rol (codrol, seccion, activo, codusu, fecmod)
  VALUES (v_codrol, p_seccion, p_activo, v_autor, now())
  ON CONFLICT (codrol, seccion) DO UPDATE SET activo = EXCLUDED.activo, codusu = EXCLUDED.codusu, fecmod = now();
  RETURN jsonb_build_object('rol', p_rol, 'seccion', p_seccion, 'activo', p_activo);
END $$;

REVOKE ALL ON FUNCTION public.permisos_listar(), public.permisos_guardar(text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permisos_listar(), public.permisos_guardar(text, text, boolean) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
