-- =====================================================================
-- EPSA Motor · Cuentas del equipo para el panel (login por correo y rol)
-- Usa lo que ya hizo el backend (HU-007): Supabase Auth guarda el correo y la
-- contraseña (cifrada) y la tabla public.usuario guarda nombre, rol y estado.
-- La función hu007_usuario_actual() lee el rol al iniciar sesión.
--
-- PASO 1 (en el panel de Supabase, no en SQL):
--   Authentication > Users > Add user > Create new user
--   Crear estas 5 cuentas con "Auto Confirm User" marcado:
--     75063427@mail.isil.pe  contraseña temporal 75063427  (Harold · Gerente)
--     60770861@mail.isil.pe  contraseña temporal 60770861  (Jazmín · Administradora)
--     60962083@mail.isil.pe  contraseña temporal 60962083  (Adrián · Administrador)
--     61055074@mail.isil.pe  contraseña temporal 61055074  (Didier · Vendedor)
--     61106576@mail.isil.pe  contraseña temporal 61106576  (Michelle · Vendedora)
--
-- PASO 2: ejecutar este archivo en SQL Editor (se puede ejecutar más de una vez).
-- No guarda contraseñas: solo vincula cada cuenta con su rol.
-- =====================================================================
BEGIN;

-- Roles que reconoce el backend (no se crean otros)
INSERT INTO public.rol (nomrol, desrol, estrol)
SELECT r.nomrol, r.desrol, TRUE
FROM (VALUES ('Gerente', 'Acceso total'), ('Administradora', 'Gestión de compras, catálogo e inventario'), ('Vendedor', 'Atención comercial')) AS r(nomrol, desrol)
WHERE NOT EXISTS (SELECT 1 FROM public.rol x WHERE x.nomrol = r.nomrol);

-- Equipo: correo, nombres, apellidos y rol
WITH equipo(correo, nombres, apepat, apemat, rol, nombre_corto) AS (
  VALUES
    ('75063427@mail.isil.pe', 'Harold',             'Salazar',  'Masgo',       'Gerente',        'Harold Salazar Masgo'),
    ('60770861@mail.isil.pe', 'Jazmín',             'Reinoso',  'Rojas',       'Administradora', 'Jazmín Reinoso Rojas'),
    ('60962083@mail.isil.pe', 'Adrián Alejandro',   'Dionicio', 'Alcarraz',    'Administradora', 'Adrián Dionicio Alcarraz'),
    ('61055074@mail.isil.pe', 'Didier Andrés',      'Leguía',   'Sandoval',    'Vendedor',       'Didier Leguía Sandoval'),
    ('61106576@mail.isil.pe', 'Michelle Adriana Alexys', 'Fuentes', 'Villaorduña', 'Vendedor',   'Michelle Fuentes Villaorduña')
)
INSERT INTO public.usuario (uuidusu, codrol, nomusu, apepatusu, apematusu, corusu, estusu)
SELECT au.id, r.codrol, e.nombres, e.apepat, e.apemat, e.correo, TRUE
FROM equipo e
JOIN auth.users au ON lower(au.email) = lower(e.correo)
JOIN public.rol r ON r.nomrol = e.rol
ON CONFLICT (corusu) DO UPDATE
  SET uuidusu = EXCLUDED.uuidusu, codrol = EXCLUDED.codrol, nomusu = EXCLUDED.nomusu,
      apepatusu = EXCLUDED.apepatusu, apematusu = EXCLUDED.apematusu, estusu = TRUE;

-- Nombre visible y contraseña temporal: al primer ingreso el panel pide crear una nueva
-- (el panel llama a Supabase Auth para cambiarla y quita la marca clave_temporal).
UPDATE auth.users au
SET raw_user_meta_data = coalesce(au.raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('nombre', e.nombre_corto, 'clave_temporal', true)
FROM (VALUES
  ('75063427@mail.isil.pe', 'Harold Salazar Masgo'),
  ('60770861@mail.isil.pe', 'Jazmín Reinoso Rojas'),
  ('60962083@mail.isil.pe', 'Adrián Dionicio Alcarraz'),
  ('61055074@mail.isil.pe', 'Didier Leguía Sandoval'),
  ('61106576@mail.isil.pe', 'Michelle Fuentes Villaorduña')
) AS e(correo, nombre_corto)
WHERE lower(au.email) = e.correo
  AND NOT coalesce((au.raw_user_meta_data ->> 'clave_temporal') = 'false', false);

COMMIT;

-- Verificación: deben salir las 5 personas con su rol
SELECT u.corusu, u.nomusu, u.apepatusu, r.nomrol, u.estusu
FROM public.usuario u JOIN public.rol r ON r.codrol = u.codrol
WHERE u.corusu LIKE '%@mail.isil.pe' ORDER BY r.nomrol;
