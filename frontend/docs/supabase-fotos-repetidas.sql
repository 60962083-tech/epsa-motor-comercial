-- Fotos repetidas en el catálogo (opcional, se ejecuta una vez en el SQL Editor de Supabase)
-- En la base, tres modelos 4V comparten la foto 1-5.png y otros tres comparten 8.png, por eso la web muestra
-- la misma moto en modelos distintos. Este script le da a cada uno su foto oficial de torito.pe.
-- Solo cambia filas que todavía tienen la foto compartida: si alguien ya subió otra foto desde el panel
-- (Modelos › Fotos), esa fila no se toca. Se puede ejecutar más de una vez sin efecto adicional.

-- 1. Ver qué fotos se repiten (antes y después)
SELECT i.urlimo AS foto, count(*) AS veces, string_agg(m.nommod, ', ' ORDER BY m.nommod) AS modelos
FROM public.imagenmodelo i
JOIN public.modelo m ON m.codmod = i.codmod
WHERE i.estimo
GROUP BY i.urlimo
HAVING count(*) > 1
ORDER BY veces DESC;

-- 2. Una foto propia para cada modelo que comparte la suya
BEGIN;

UPDATE public.imagenmodelo i SET urlimo = 'https://torito.pe/wp-content/uploads/2026/09/torito_hrv_azul_34frontal.png'
FROM public.modelo m
WHERE m.codmod = i.codmod AND m.nommod = 'Torito 4V GSL' AND i.urlimo = 'https://torito.pe/wp-content/uploads/2025/04/1-5.png';

UPDATE public.imagenmodelo i SET urlimo = 'https://torito.pe/wp-content/uploads/2026/09/torito_hrv_rojo_34frontal.png'
FROM public.modelo m
WHERE m.codmod = i.codmod AND m.nommod = 'Torito 4V GLP' AND i.urlimo = 'https://torito.pe/wp-content/uploads/2025/04/1-5.png';

UPDATE public.imagenmodelo i SET urlimo = 'https://torito.pe/wp-content/uploads/2025/04/7-1.png'
FROM public.modelo m
WHERE m.codmod = i.codmod AND m.nommod = 'Torito 2T UG GSL' AND i.urlimo = 'https://torito.pe/wp-content/uploads/2025/04/8.png';

UPDATE public.imagenmodelo i SET urlimo = 'https://torito.pe/wp-content/uploads/2025/10/Para-pasajeros-4-T.png'
FROM public.modelo m
WHERE m.codmod = i.codmod AND m.nommod = 'Torito Crom Plus GNV' AND i.urlimo = 'https://torito.pe/wp-content/uploads/2025/04/8.png';

COMMIT;

-- 3. Vuelve a ejecutar la consulta del paso 1: ya no debería salir ninguna fila.
