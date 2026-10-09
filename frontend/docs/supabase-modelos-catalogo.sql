-- =====================================================================
-- EPSA Motor · Catálogo de modelos en Supabase (opcional)
-- La web solo muestra los modelos que Supabase tiene PUBLICADOS (HU-012) y los
-- empareja por nombre con su ficha (precio, colores y datos técnicos).
-- Este archivo carga los 9 modelos de la web con el mismo nombre, descripción,
-- características y foto oficial. Es seguro ejecutarlo más de una vez:
-- no duplica modelos que ya existan con el mismo nombre ni cambia los existentes.
--
-- Antes de ejecutarlo, revisa qué hay hoy:
--   SELECT codmod, nommod, estmod FROM public.modelo ORDER BY nommod;
-- Ejecutar en Supabase > SQL Editor.
-- =====================================================================
BEGIN;

-- Tipos de motocar (familias de la web)
INSERT INTO public.tipomotocar (nomtmo, destmo, esttmo)
SELECT t.nomtmo, 'Familia del catálogo Torito', TRUE
FROM (VALUES ('Motores 4 Válvulas'), ('Motores 2 Tiempos'), ('Motores Crom Plus')) AS t(nomtmo)
WHERE NOT EXISTS (SELECT 1 FROM public.tipomotocar x WHERE lower(btrim(x.nomtmo)) = lower(t.nomtmo));

-- Modelos publicados + foto principal
WITH datos(nommod, tipo, desmod, carmod, urlimo) AS (
  VALUES
    ('Torito 4V GSL', 'Motores 4 Válvulas', 'El Torito 4V GSL es el motocar a gasolina con motor de 4 válvulas: más potencia y torque para subir pendientes con carga completa, menor consumo y una conducción más estable. Pensado para el conductor que trabaja todos los días y necesita una herramienta confiable.', 'Motor: 4 tiempos, 4 válvulas · Cilindrada: 236.2 cc · Llantas: Aro 8" sin cámara · Potencia: 10.73 HP · Torque: 20 Nm · Combustible: Gasolina', 'https://torito.pe/wp-content/uploads/2025/04/1-5.png'),
    ('Torito 4V GLP', 'Motores 4 Válvulas', 'El Torito 4V GLP combina el motor de 4 válvulas con un sistema dual GLP + gasolina. Ahorra en cada kilómetro con gas y conserva el respaldo de gasolina cuando lo necesites.', 'Motor: 4 tiempos, 4 válvulas · Cilindrada: 236.2 cc · Llantas: Aro 8" sin cámara · Potencia: 10.33 HP · Torque: 18 Nm · Combustible: GLP', 'https://torito.pe/wp-content/uploads/2025/04/1-5.png'),
    ('Torito 4V GNV', 'Motores 4 Válvulas', 'Ahorro y tecnología para tu negocio. El Torito 4V GNV es la nueva generación de Torito: motor de 4 válvulas a gas natural, encendido instantáneo ISG, retroceso directo en el manubrio, triple filtrado de aceite y tablero con indicador de diagnóstico.', 'Motor: 4 tiempos, 4 válvulas · Cilindrada: 236.2 cc · Llantas: Aro 8" sin cámara · Potencia: 9.79 HP · Torque: 16.5 Nm · Combustible: GNV', 'https://torito.pe/wp-content/uploads/2025/04/1-5.png'),
    ('Torito 250 4V GLP', 'Motores 4 Válvulas', 'El Torito 250 4V GLP lleva el motor de 4 válvulas a GLP con llantas aro 10 y suspensión delantera doble: más estabilidad y comodidad en cualquier ruta, con el ahorro del gas.', 'Motor: 4 tiempos, 4 válvulas · Cilindrada: 236.2 cc · Llantas: Aro 10" sin cámara · Potencia: 10.33 HP · Torque: 18 Nm · Combustible: GLP', 'https://torito.pe/wp-content/uploads/2026/09/torito-250-4v-frontal-lateral-izq.png'),
    ('Torito 2T UG GLP', 'Motores 2 Tiempos', 'Motor de 2 tiempos con GLP: la opción más económica para empezar a trabajar. Fácil de mantener, ligero y con bajo costo por kilómetro.', 'Motor: 2 tiempos · Cilindrada: 145.45 cc · Llantas: 4-8, aro de una pieza · Potencia: 8.58 HP · Torque: 15 Nm · Combustible: GLP', 'https://torito.pe/wp-content/uploads/2025/04/8.png'),
    ('Torito 2T UG GSL', 'Motores 2 Tiempos', 'El Torito más accesible de la línea. Motor 2 tiempos a gasolina, ideal para comenzar tu negocio de transporte con la menor inversión.', 'Motor: 2 tiempos · Cilindrada: 145.45 cc · Llantas: 4-8 sin cámara · Potencia: 8.44 HP · Torque: 17 Nm · Combustible: Gasolina', 'https://torito.pe/wp-content/uploads/2025/04/8.png'),
    ('Torito Crom Plus GNV', 'Motores Crom Plus', 'El Crom Plus GNV es el motocar para quien quiere gastar menos: funciona con gas natural, el combustible más económico por kilómetro.', 'Motor: 4 tiempos · Cilindrada: 198.88 cc · Llantas: 4-8 sin cámara · Potencia: 8.78 HP · Torque: 14.5 Nm · Combustible: GNV', 'https://torito.pe/wp-content/uploads/2025/04/8.png'),
    ('Torito Crom Plus GLP', 'Motores Crom Plus', 'Crom Plus con GLP: equilibrio entre potencia y ahorro, con 9.32 HP y 16 Nm para el trabajo diario.', 'Motor: 4 tiempos · Cilindrada: 198.88 cc · Llantas: 4-8 sin cámara · Potencia: 9.32 HP · Torque: 16 Nm · Combustible: GLP', 'https://torito.pe/wp-content/uploads/2025/04/646c02f5bcb15589337055.png'),
    ('Torito Crom Plus GSL', 'Motores Crom Plus', 'Crom Plus a gasolina: la versión más potente de la familia, con 10.19 HP y 17.10 Nm de torque.', 'Motor: 4 tiempos · Cilindrada: 198.88 cc · Llantas: 4-8 sin cámara · Potencia: 10.19 HP · Torque: 17.10 Nm · Combustible: Gasolina', 'https://torito.pe/wp-content/uploads/2025/04/3-2.png')
), nuevos AS (
  INSERT INTO public.modelo (codtmo, nommod, marmod, desmod, carmod, estmod)
  SELECT t.codtmo, d.nommod, 'Bajaj', d.desmod, d.carmod, 'Publicado'
  FROM datos d
  JOIN public.tipomotocar t ON lower(btrim(t.nomtmo)) = lower(d.tipo)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.modelo m
    WHERE lower(regexp_replace(btrim(m.nommod), '\s+', ' ', 'g')) = lower(d.nommod)
  )
  RETURNING codmod, nommod
)
INSERT INTO public.imagenmodelo (codmod, urlimo, ordimo, estimo)
SELECT n.codmod, d.urlimo, 1, TRUE
FROM nuevos n JOIN datos d ON d.nommod = n.nommod;

COMMIT;

-- Verificación: los modelos publicados que verá la web
SELECT codmod, nommod, estmod FROM public.modelo ORDER BY nommod;

-- Opcional: si un modelo ya existía con el mismo nombre pero en «Borrador», publícalo así:
--   UPDATE public.modelo SET estmod = 'Publicado' WHERE nommod = 'Torito 4V GSL';
