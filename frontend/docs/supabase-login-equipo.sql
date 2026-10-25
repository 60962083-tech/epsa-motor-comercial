-- =====================================================================
-- EPSA Motor · Funciones del equipo (pantalla «Equipo» del panel)
--
-- Qué hace:
--   Crea las funciones con las que la gerencia administra las cuentas desde el
--   panel: listar el equipo, crear cuentas, cambiar roles, quitar accesos y
--   reiniciar contraseñas. Cada función revisa el rol de quien la llama.
--
-- Las cuentas del equipo y sus contraseñas NO están en este archivo: se crean
-- con el archivo privado que recibe el gerente (no se sube al repositorio).
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Usa Chrome con el traductor apagado. Se puede ejecutar más de una vez.
-- Supabase guarda las contraseñas cifradas.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- Reglas de los datos
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equipo_validar_datos(
  p_correo text, p_nombres text, p_apellido_paterno text, p_apellido_materno text, p_rol text
) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_letras constant text := '^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+( [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*$';
BEGIN
  IF p_correo IS NULL OR length(p_correo) > 254 OR p_correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION 'Escribe un correo válido.';
  END IF;
  IF p_nombres IS NULL OR length(p_nombres) NOT BETWEEN 2 AND 100 OR p_nombres !~ v_letras THEN
    RAISE EXCEPTION 'Los nombres solo llevan letras y espacios.';
  END IF;
  IF p_apellido_paterno IS NULL OR length(p_apellido_paterno) NOT BETWEEN 2 AND 100 OR p_apellido_paterno !~ v_letras THEN
    RAISE EXCEPTION 'El apellido paterno solo lleva letras y espacios.';
  END IF;
  IF p_apellido_materno IS NOT NULL AND (length(p_apellido_materno) > 100 OR p_apellido_materno !~ v_letras) THEN
    RAISE EXCEPTION 'El apellido materno solo lleva letras y espacios.';
  END IF;
  IF p_rol IS NULL OR p_rol NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION 'El rol debe ser Gerente, Administradora o Vendedor.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.equipo_validar_clave(p_clave text) RETURNS void
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_clave IS NULL OR length(p_clave) < 8 THEN RAISE EXCEPTION 'La contraseña debe tener al menos 8 caracteres.'; END IF;
  IF length(p_clave) > 72 THEN RAISE EXCEPTION 'La contraseña admite hasta 72 caracteres.'; END IF;
  IF p_clave ~ '[[:space:]]' THEN RAISE EXCEPTION 'La contraseña no lleva espacios.'; END IF;
  IF p_clave !~ '[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]' OR p_clave !~ '[0-9]' THEN RAISE EXCEPTION 'Usa letras y números en la contraseña.'; END IF;
END $$;

-- Texto limpio: sin espacios dobles ni a los lados
CREATE OR REPLACE FUNCTION public.equipo_limpiar(p_texto text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT nullif(regexp_replace(btrim(coalesce(p_texto, '')), '[[:space:]]+', ' ', 'g'), '')
$$;

-- ---------------------------------------------------------------------
-- Crear o completar una cuenta (uso interno: no la llama el panel)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.equipo_guardar_cuenta(
  p_correo text, p_clave text, p_nombres text, p_apellido_paterno text, p_apellido_materno text,
  p_rol text, p_clave_temporal boolean, p_poner_clave boolean
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_correo text := lower(public.equipo_limpiar(p_correo));
  v_nombres text := public.equipo_limpiar(p_nombres);
  v_paterno text := public.equipo_limpiar(p_apellido_paterno);
  v_materno text := public.equipo_limpiar(p_apellido_materno);
  v_visible text;
  v_id uuid;
  v_codrol bigint;
  v_codusu bigint;
BEGIN
  PERFORM public.equipo_validar_datos(v_correo, v_nombres, v_paterno, v_materno, p_rol);
  SELECT codrol INTO v_codrol FROM public.rol WHERE nomrol = p_rol AND estrol;
  IF v_codrol IS NULL THEN RAISE EXCEPTION 'El rol % no existe o está desactivado.', p_rol; END IF;
  v_visible := concat_ws(' ', split_part(v_nombres, ' ', 1), v_paterno, v_materno);

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_correo AND NOT is_sso_user ORDER BY created_at LIMIT 1;

  IF v_id IS NULL THEN
    -- Cuenta nueva: confirmada, con contraseña cifrada y proveedor «email»
    IF p_clave IS NULL OR length(p_clave) < 6 THEN RAISE EXCEPTION 'Falta la contraseña inicial de %.', v_correo; END IF;
    v_id := gen_random_uuid();
    BEGIN
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, email_change, email_change_token_new, recovery_token
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_correo,
        extensions.crypt(p_clave, extensions.gen_salt('bf', 10)), now(),
        '{"provider": "email", "providers": ["email"]}'::jsonb,
        jsonb_build_object('nombre', v_visible, 'clave_temporal', p_clave_temporal),
        now(), now(), '', '', '', ''
      );
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE EXCEPTION 'Supabase no deja crear la cuenta % desde SQL. Créala en Authentication > Users > Add user > Create new user (marca Auto Confirm User) y vuelve a ejecutar este archivo.', v_correo;
    END;
  ELSE
    -- Cuenta que ya existía: se confirma y, si corresponde, se le pone la contraseña
    BEGIN
    UPDATE auth.users SET
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      confirmation_token = coalesce(confirmation_token, ''),
      email_change = coalesce(email_change, ''),
      email_change_token_new = coalesce(email_change_token_new, ''),
      recovery_token = coalesce(recovery_token, ''),
      raw_app_meta_data = CASE WHEN raw_app_meta_data ? 'provider' THEN raw_app_meta_data
                               ELSE coalesce(raw_app_meta_data, '{}'::jsonb) || '{"provider": "email", "providers": ["email"]}'::jsonb END,
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('nombre', v_visible)
        || CASE WHEN p_poner_clave THEN jsonb_build_object('clave_temporal', p_clave_temporal) ELSE '{}'::jsonb END,
      encrypted_password = CASE WHEN p_poner_clave THEN extensions.crypt(p_clave, extensions.gen_salt('bf', 10)) ELSE encrypted_password END,
      updated_at = now()
    WHERE id = v_id;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL; -- Si Supabase no deja tocarla, igual se enlaza con su rol (entra con la contraseña que ya tiene)
    END;
  END IF;

  -- Identidad de correo (la usa Supabase para recuperar la contraseña)
  BEGIN
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    SELECT gen_random_uuid(), v_id, v_id::text,
           jsonb_build_object('sub', v_id::text, 'email', v_correo, 'email_verified', true, 'phone_verified', false),
           'email', now(), now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = v_id AND provider = 'email');
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Las cuentas creadas desde el panel de Supabase ya traen su identidad
  END;

  -- Ficha en usuario con su rol
  UPDATE public.usuario
     SET codrol = v_codrol, nomusu = v_nombres, apepatusu = v_paterno, apematusu = v_materno, corusu = v_correo, estusu = TRUE
   WHERE uuidusu = v_id
  RETURNING codusu INTO v_codusu;
  IF v_codusu IS NULL THEN
    INSERT INTO public.usuario (uuidusu, codrol, nomusu, apepatusu, apematusu, corusu, estusu)
    VALUES (v_id, v_codrol, v_nombres, v_paterno, v_materno, v_correo, TRUE)
    ON CONFLICT (corusu) DO UPDATE
      SET uuidusu = EXCLUDED.uuidusu, codrol = EXCLUDED.codrol, nomusu = EXCLUDED.nomusu,
          apepatusu = EXCLUDED.apepatusu, apematusu = EXCLUDED.apematusu, estusu = TRUE
    RETURNING codusu INTO v_codusu;
  END IF;
  RETURN v_codusu;
END $$;

-- ---------------------------------------------------------------------
-- Para la pantalla Equipo del panel
-- ---------------------------------------------------------------------
-- Quién llama: solo personas del equipo con acceso activo
CREATE OR REPLACE FUNCTION public.equipo_exigir_rol(p_roles text[]) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_rol text := public.hu026_rol_actual();
BEGIN
  IF v_rol IS NULL OR NOT (v_rol = ANY (p_roles)) THEN
    RAISE EXCEPTION 'Solo % puede hacer esto.', array_to_string(p_roles, ' o ') USING ERRCODE = '42501';
  END IF;
  RETURN v_rol;
END $$;

-- Lista del equipo (Gerente y Administradora)
CREATE OR REPLACE FUNCTION public.equipo_listar()
RETURNS TABLE (codusu bigint, nombres text, apellido_paterno text, apellido_materno text, correo text,
               rol text, activo boolean, clave_temporal boolean, ultimo_ingreso timestamptz, creado timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.equipo_exigir_rol(ARRAY['Gerente', 'Administradora']);
  RETURN QUERY
  SELECT u.codusu, u.nomusu::text, u.apepatusu::text, u.apematusu::text, u.corusu::text, r.nomrol::text, u.estusu,
         coalesce((a.raw_user_meta_data ->> 'clave_temporal')::boolean, false), a.last_sign_in_at, a.created_at
  FROM public.usuario u
  JOIN public.rol r ON r.codrol = u.codrol
  LEFT JOIN auth.users a ON a.id = u.uuidusu
  ORDER BY u.estusu DESC, CASE r.nomrol WHEN 'Gerente' THEN 1 WHEN 'Administradora' THEN 2 ELSE 3 END, u.nomusu;
END $$;

-- Crear una cuenta (Gerente). Entra con una contraseña temporal y crea la suya al ingresar.
CREATE OR REPLACE FUNCTION public.equipo_crear_cuenta(
  p_correo text, p_nombres text, p_apellido_paterno text, p_apellido_materno text, p_rol text, p_clave text
) RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_correo text := lower(public.equipo_limpiar(p_correo));
BEGIN
  PERFORM public.equipo_exigir_rol(ARRAY['Gerente']);
  PERFORM public.equipo_validar_clave(p_clave);
  IF EXISTS (SELECT 1 FROM public.usuario WHERE lower(corusu) = v_correo) THEN
    RAISE EXCEPTION 'Ese correo ya tiene una cuenta.' USING ERRCODE = '23505';
  END IF;
  RETURN public.equipo_guardar_cuenta(v_correo, p_clave, p_nombres, p_apellido_paterno, p_apellido_materno, p_rol, TRUE, TRUE);
END $$;

-- Cambiar nombres, rol o acceso (Gerente)
CREATE OR REPLACE FUNCTION public.equipo_actualizar_cuenta(
  p_codusu bigint, p_nombres text, p_apellido_paterno text, p_apellido_materno text, p_rol text, p_activo boolean
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_actual public.usuario;
  v_rol_actual text;
  v_codrol bigint;
  v_nombres text := public.equipo_limpiar(p_nombres);
  v_paterno text := public.equipo_limpiar(p_apellido_paterno);
  v_materno text := public.equipo_limpiar(p_apellido_materno);
BEGIN
  PERFORM public.equipo_exigir_rol(ARRAY['Gerente']);
  SELECT * INTO v_actual FROM public.usuario WHERE codusu = p_codusu FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No se encontró esa cuenta.' USING ERRCODE = 'P0002'; END IF;
  PERFORM public.equipo_validar_datos(v_actual.corusu, v_nombres, v_paterno, v_materno, p_rol);
  SELECT nomrol INTO v_rol_actual FROM public.rol WHERE codrol = v_actual.codrol;
  IF v_actual.uuidusu = auth.uid() AND (p_rol <> v_rol_actual OR NOT p_activo) THEN
    RAISE EXCEPTION 'No puedes cambiar tu propio rol ni quitarte el acceso.';
  END IF;
  IF v_rol_actual = 'Gerente' AND v_actual.estusu AND (p_rol <> 'Gerente' OR NOT p_activo)
     AND NOT EXISTS (SELECT 1 FROM public.usuario u JOIN public.rol r ON r.codrol = u.codrol
                     WHERE r.nomrol = 'Gerente' AND u.estusu AND u.codusu <> p_codusu) THEN
    RAISE EXCEPTION 'Debe quedar al menos un gerente con acceso.';
  END IF;
  SELECT codrol INTO v_codrol FROM public.rol WHERE nomrol = p_rol AND estrol;
  UPDATE public.usuario
     SET nomusu = v_nombres, apepatusu = v_paterno, apematusu = v_materno, codrol = v_codrol, estusu = p_activo
   WHERE codusu = p_codusu;
  BEGIN
    UPDATE auth.users
       SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
             || jsonb_build_object('nombre', concat_ws(' ', split_part(v_nombres, ' ', 1), v_paterno, v_materno)),
           updated_at = now()
     WHERE id = v_actual.uuidusu;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- El nombre visible se actualiza igual en usuario
  END;
END $$;

-- Poner una contraseña temporal a otra persona (Gerente). Sirve si no le llega el correo.
CREATE OR REPLACE FUNCTION public.equipo_reiniciar_clave(p_codusu bigint, p_clave text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uuid uuid;
BEGIN
  PERFORM public.equipo_exigir_rol(ARRAY['Gerente']);
  PERFORM public.equipo_validar_clave(p_clave);
  SELECT uuidusu INTO v_uuid FROM public.usuario WHERE codusu = p_codusu;
  IF v_uuid IS NULL THEN RAISE EXCEPTION 'No se encontró esa cuenta.' USING ERRCODE = 'P0002'; END IF;
  IF v_uuid = auth.uid() THEN RAISE EXCEPTION 'Para tu propia contraseña usa «¿Olvidaste tu contraseña?».'; END IF;
  BEGIN
    UPDATE auth.users
       SET encrypted_password = extensions.crypt(p_clave, extensions.gen_salt('bf', 10)),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"clave_temporal": true}'::jsonb,
           updated_at = now()
     WHERE id = v_uuid;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE EXCEPTION 'Supabase no deja cambiar contraseñas desde el panel. Que la persona use «¿Olvidaste tu contraseña?».';
  END;
END $$;

-- Permisos: el panel solo llama a estas cuatro; las demás son internas
REVOKE ALL ON FUNCTION public.equipo_validar_datos(text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipo_validar_clave(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipo_limpiar(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipo_guardar_cuenta(text, text, text, text, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipo_exigir_rol(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.equipo_listar() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equipo_crear_cuenta(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equipo_actualizar_cuenta(bigint, text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.equipo_reiniciar_clave(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equipo_listar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipo_crear_cuenta(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipo_actualizar_cuenta(bigint, text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipo_reiniciar_clave(bigint, text) TO authenticated;

COMMIT;
