-- =====================================================================
-- EPSA Motor · Precios, colores y fichas oficiales de torito.pe (carga inicial)
--
-- Qué hace: deja en la base el precio, los colores, la descripción y la ficha
-- técnica oficial de torito.pe de cada modelo, para que la web los muestre
-- sin tener que usar antes el botón del panel. Solo completa lo que está
-- vacío: si un precio o una ficha ya se editó en el panel, no se toca.
-- Más adelante, si torito.pe cambia algo, se actualiza desde el panel:
-- Modelos › Traer información de torito.pe.
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Se puede ejecutar más de una vez sin dañar nada.
-- =====================================================================

BEGIN;

-- Torito 4V GSL
UPDATE public.modelo SET premod = 17899 WHERE nommod = 'Torito 4V GSL' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Azul']) FROM public.modelo m
 WHERE m.nommod = 'Torito 4V GSL' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$El Torito 4V GSL es el motocar a gasolina con motor de 4 válvulas: más potencia y torque para subir pendientes con carga completa, menor consumo y una conducción más estable. Pensado para el conductor que trabaja todos los días y necesita una herramienta confiable.$torito$ WHERE nommod = 'Torito 4V GSL' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 4 Válvulas
Tipo de motor: 4 tiempos
Combustible: Gasolina
Uso: Pasajeros
Techo: Clásico
Color de la foto: Azul
Etiquetas: NUEVO MODELO, PRECIO DE LANZAMIENTO

Destacados
- Motor 4 válvulas de 236.2 cc con 10.73 HP
- Torque de 20 Nm para pendientes y carga
- Velocidad máxima de 65 km/h
- Tanque de 8 litros de gasolina

Resumen
Motor: 4 tiempos, 4 válvulas
Cilindrada: 236.2 cc
Llantas: Aro 8" sin cámara
Potencia: 10.73 HP
Torque: 20 Nm

Motor
Motor: 4 tiempos, 4 válvulas, gasolina
Cilindrada: 236.2 cc
Diámetro × carrera: 67 mm × 67 mm
Refrigeración: Forzada por aire y aceite
Transmisión: Engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 10.73 HP a 5,000 ± 250 RPM
Torque máximo: 20 Nm a 3,500 RPM

Chasis y Carrocería
Neumáticos: 4.00-8, 4/6 PR (los cuatro)
Frenos: Hidráulicos de zapata expansible, delantero y posterior
Freno de estacionamiento: Mecánico de zapata expansible en ruedas traseras

Consumo y Rendimiento
Velocidad máxima: 65 km/h
Capacidad de tanque: 8 L (reserva 1.5 L)

Dimensiones
Largo: 2,635 mm
Ancho: 1,350 mm
Alto: 1,710 mm
Peso en vacío: 371 kg
Peso máximo: 681 kg

Sistema eléctrico
Sistema eléctrico: 12 V DC
Batería: 12 V, 32 Ah
Faro delantero: 35/35 W
Luz trasera / freno: 5/21 W o 5/18 W

Fotos por color
Azul: https://torito.pe/wp-content/uploads/2026/09/torito_hrv_azul_34frontal.png$torito$ WHERE nommod = 'Torito 4V GSL' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito 4V GLP
UPDATE public.modelo SET premod = 17899 WHERE nommod = 'Torito 4V GLP' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo']) FROM public.modelo m
 WHERE m.nommod = 'Torito 4V GLP' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$El Torito 4V GLP combina el motor de 4 válvulas con un sistema dual GLP + gasolina. Ahorra en cada kilómetro con gas y conserva el respaldo de gasolina cuando lo necesites.$torito$ WHERE nommod = 'Torito 4V GLP' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 4 Válvulas
Tipo de motor: 4 tiempos
Combustible: GLP
Uso: Pasajeros
Techo: Clásico
Color de la foto: Rojo
Etiquetas: NUEVO MODELO, PRECIO DE LANZAMIENTO

Destacados
- Sistema dual: tanque de GLP de 20.6 L + 3 L de gasolina
- Motor de 4 válvulas con 10.33 HP
- Torque de 18 Nm
- Ahorro diario frente a la gasolina

Resumen
Motor: 4 tiempos, 4 válvulas
Cilindrada: 236.2 cc
Llantas: Aro 8" sin cámara
Potencia: 10.33 HP
Torque: 18 Nm

Motor
Motor: 4 tiempos, 4 válvulas
Combustible: GLP con respaldo de gasolina
Cilindrada: 236.2 cc
Diámetro × carrera: 67 mm × 67 mm
Refrigeración: Forzada por aire y aceite
Transmisión: Engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 10.33 HP a 5,000 ± 250 RPM
Torque máximo: 18 Nm a 3,500 RPM

Chasis y Carrocería
Neumáticos: 4.00-8, 4/6 PR (los cuatro)
Frenos: Hidráulicos de zapata expansible, delantero y posterior
Freno de estacionamiento: Mecánico de zapata expansible en ruedas traseras

Consumo y Rendimiento
Velocidad máxima: 65 km/h
Capacidad de tanque: 20.6 L de GLP (16.5 L al 80%) + 3 L de gasolina

Dimensiones
Largo: 2,635 mm
Ancho: 1,350 mm
Alto: 1,710 mm
Peso en vacío: 386 kg
Peso máximo: 696 kg

Sistema eléctrico
Sistema eléctrico: 12 V DC
Batería: 12 V, 32 Ah
Faro delantero: 35/35 W
Luz trasera / freno: 5/21 W o 5/18 W

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2026/09/torito_hrv_rojo_34frontal.png$torito$ WHERE nommod = 'Torito 4V GLP' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito 4V GNV
UPDATE public.modelo SET premod = 17899 WHERE nommod = 'Torito 4V GNV' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo']) FROM public.modelo m
 WHERE m.nommod = 'Torito 4V GNV' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$Ahorro y tecnología para tu negocio. El Torito 4V GNV es la nueva generación de Torito: motor de 4 válvulas a gas natural, encendido instantáneo ISG, retroceso directo en el manubrio, triple filtrado de aceite y tablero con indicador de diagnóstico.$torito$ WHERE nommod = 'Torito 4V GNV' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 4 Válvulas
Tipo de motor: 4 tiempos
Combustible: GNV
Uso: Pasajeros
Techo: Clásico
Color de la foto: Rojo
Etiquetas: NUEVO MODELO, PRECIO DE LANZAMIENTO

Destacados
- Motor 4 válvulas a GNV de 236.2 cc
- Encendido instantáneo ISG
- Retroceso directo en el manubrio
- Triple filtrado de aceite

Resumen
Motor: 4 tiempos, 4 válvulas
Cilindrada: 236.2 cc
Llantas: Aro 8" sin cámara
Potencia: 9.79 HP
Torque: 16.5 Nm

Motor
Motor: 4 tiempos, 4 válvulas, GNV
Cilindrada: 236.2 cc
Diámetro × carrera: 67 mm × 67 mm
Refrigeración: Forzada por aire y aceite
Transmisión: Engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 9.79 HP a 5,000 ± 250 RPM
Torque máximo: 16.5 Nm a 3,500 RPM

Chasis y Carrocería
Neumáticos: 4.00-8, 4/6 PR, aro 8" sin cámara
Frenos: Hidráulicos de zapata expansible, delantero y posterior
Freno de estacionamiento: Mecánico de zapata expansible en ruedas traseras

Consumo y Rendimiento
Velocidad máxima: 63 km/h
Capacidad de tanque: 3 L de gasolina + cilindro de GNV

Dimensiones
Largo: 2,635 mm
Ancho: 1,350 mm
Alto: 1,710 mm
Peso en vacío: 397 kg
Peso máximo: 707 kg

Sistema eléctrico
Sistema eléctrico: 12 V DC
Batería: 12 V, 32 Ah
Faro delantero: 35/35 W
Luz trasera / freno: 5/21 W o 5/18 W

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2025/04/1-5.png$torito$ WHERE nommod = 'Torito 4V GNV' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito 250 4V GLP
UPDATE public.modelo SET premod = 18299 WHERE nommod = 'Torito 250 4V GLP' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo']) FROM public.modelo m
 WHERE m.nommod = 'Torito 250 4V GLP' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$El Torito 250 4V GLP lleva el motor de 4 válvulas a GLP con llantas aro 10 y suspensión delantera doble: más estabilidad y comodidad en cualquier ruta, con el ahorro del gas.$torito$ WHERE nommod = 'Torito 250 4V GLP' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 4 Válvulas
Tipo de motor: 4 tiempos
Combustible: GLP
Uso: Pasajeros
Techo: Especial
Color de la foto: Rojo
Etiquetas: NUEVO MODELO

Destacados
- Llantas 4.00-10, aro 10" sin cámara
- Suspensión delantera doble
- Motor 4 válvulas: 10.33 HP y 18 Nm
- Tanque de 20.6 L de GLP + 3 L de gasolina

Resumen
Motor: 4 tiempos, 4 válvulas
Cilindrada: 236.2 cc
Llantas: Aro 10" sin cámara
Potencia: 10.33 HP
Torque: 18 Nm

Motor
Motor: 4 tiempos, 4 válvulas
Combustible: GLP con respaldo de gasolina
Cilindrada: 236.2 cc
Diámetro × carrera: 67 mm × 67 mm
Refrigeración: Forzada por aire y aceite
Transmisión: Eje cardán (CV), engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 10.33 HP a 5,000 ± 250 RPM
Torque máximo: 18 Nm a 3,500 RPM

Chasis y Carrocería
Neumáticos: 4.00-10, 4/10 PR (los cuatro)
Suspensión: Delantera doble
Frenos: Hidráulicos de zapata expansible, delantero y posterior
Freno de estacionamiento: Mecánico de zapata expansible en ruedas traseras

Consumo y Rendimiento
Velocidad máxima: 65 km/h
Capacidad de tanque: 20.6 L de GLP (16.5 L al 80%) + 3 L de gasolina

Dimensiones
Largo: 2,635 mm
Ancho: 1,350 mm
Alto: 1,710 mm
Peso en vacío: 386 kg
Peso máximo: 696 kg

Sistema eléctrico
Sistema eléctrico: 12 V DC
Batería: 12 V, 32 Ah
Faro delantero: 35/35 W
Luz trasera / freno: 5/21 W o 5/18 W

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2026/09/torito-250-4v-frontal-lateral-izq.png$torito$ WHERE nommod = 'Torito 250 4V GLP' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito 2T UG GLP
UPDATE public.modelo SET premod = 14699 WHERE nommod = 'Torito 2T UG GLP' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo', 'Azul', 'Amarillo', 'Verde', 'Negro']) FROM public.modelo m
 WHERE m.nommod = 'Torito 2T UG GLP' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$Motor de 2 tiempos con GLP: la opción más económica para empezar a trabajar. Fácil de mantener, ligero y con bajo costo por kilómetro.$torito$ WHERE nommod = 'Torito 2T UG GLP' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 2 Tiempos
Tipo de motor: 2 tiempos
Combustible: GLP
Uso: Pasajeros
Techo: Clásico
Color de la foto: Rojo

Destacados
- Motor de 2 tiempos de 145.45 cc
- 8.58 HP y 15 Nm de torque
- Peso de solo 325 kg
- Precio de entrada accesible

Resumen
Motor: 2 tiempos
Cilindrada: 145.45 cc
Llantas: 4-8, aro de una pieza
Potencia: 8.58 HP
Torque: 15 Nm

Motor
Motor: 2 tiempos UG GLP
Cilindrada: 145.45 cc
Diámetro × carrera: 57 mm × 57 mm
Bujía: 1 (Champion RL82C)
Refrigeración: Forzada por aire
Embrague: Multidisco húmedo
Transmisión: Manual, malla constante: 4 marchas + 1 reversa
Potencia máxima: 8.58 HP a 5,000 ± 250 RPM
Torque máximo: 15 Nm a 3,300 ± 250 RPM

Chasis y Carrocería
Chasis: Monocasco
Neumáticos: 4-8, 4-6 PR, aro de una pieza
Frenos: Tambor de expansión hidráulica, delantero y posterior
Freno de estacionamiento: Zapata de expansión mecánica
Presión de llantas: Delantera 36 PSI · posterior 40 PSI

Consumo y Rendimiento
Velocidad máxima: 60 km/h
Capacidad de tanque: 20.6 L
Capacidad de escalada: 16% (9.1°) máx.

Dimensiones
Largo: 2,658 mm
Ancho: 1,300 mm
Alto: 1,700 mm
Radio de giro: 2,880 mm
Peso: 325 kg

Sistema eléctrico
Sistema eléctrico: 12 V CC
Batería: 32 Ah (arranque eléctrico)
Bocina: 12 V DC, tipo 2A

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2025/04/8.png
Azul: https://torito.pe/wp-content/uploads/2025/04/7-1.png$torito$ WHERE nommod = 'Torito 2T UG GLP' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito 2T UG GSL
UPDATE public.modelo SET premod = 12699 WHERE nommod = 'Torito 2T UG GSL' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo', 'Azul', 'Amarillo', 'Verde', 'Negro']) FROM public.modelo m
 WHERE m.nommod = 'Torito 2T UG GSL' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$El Torito más accesible de la línea. Motor 2 tiempos a gasolina, ideal para comenzar tu negocio de transporte con la menor inversión.$torito$ WHERE nommod = 'Torito 2T UG GSL' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores 2 Tiempos
Tipo de motor: 2 tiempos
Combustible: Gasolina
Uso: Pasajeros
Techo: Clásico
Color de la foto: Rojo

Destacados
- El precio más bajo de la línea
- 8.44 HP y 17 Nm de torque
- Peso de 340 kg
- Mantenimiento sencillo

Resumen
Motor: 2 tiempos
Cilindrada: 145.45 cc
Llantas: 4-8 sin cámara
Potencia: 8.44 HP
Torque: 17 Nm

Motor
Motor: 2 tiempos UG GSL
Cilindrada: 145.45 cc
Diámetro × carrera: 57 mm × 57 mm
Bujía: 1 (Champion RL82C)
Refrigeración: Forzada por aire
Embrague: Multidisco húmedo
Transmisión: Manual, malla constante: 4 marchas + 1 reversa
Potencia máxima: 8.44 HP a 4,000 ± 250 RPM
Torque máximo: 17 Nm a 3,000 ± 250 RPM

Chasis y Carrocería
Chasis: Monocasco
Neumáticos: 4-8, 4-6 PR (sin cámara)
Frenos: Tambor de expansión hidráulica, delantero y posterior
Freno de estacionamiento: Zapata de expansión mecánica
Presión de llantas: Delantera 36 PSI · posterior 40 PSI

Consumo y Rendimiento
Velocidad máxima: 60 km/h
Capacidad de tanque: 8 L
Capacidad de escalada: 18% (10.2°) máx.

Dimensiones
Largo: 2,658 mm
Ancho: 1,300 mm
Alto: 1,700 mm
Radio de giro: 2,880 mm
Peso: 340 kg

Sistema eléctrico
Sistema eléctrico: 12 V CC
Batería: 32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)
Bocina: 12 V DC, tipo 2A

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2025/04/8.png
Azul: https://torito.pe/wp-content/uploads/2025/04/7-1.png$torito$ WHERE nommod = 'Torito 2T UG GSL' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito Crom Plus GNV
UPDATE public.modelo SET premod = 17199 WHERE nommod = 'Torito Crom Plus GNV' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Rojo']) FROM public.modelo m
 WHERE m.nommod = 'Torito Crom Plus GNV' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$El Crom Plus GNV es el motocar para quien quiere gastar menos: funciona con gas natural, el combustible más económico por kilómetro.$torito$ WHERE nommod = 'Torito Crom Plus GNV' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores Crom Plus
Tipo de motor: 4 tiempos
Combustible: GNV
Uso: Pasajeros
Techo: Especial
Color de la foto: Rojo

Destacados
- Motor de 198.88 cc
- Tanque de GNV de 30 L (4.5 kg)
- 8.78 HP y 14.5 Nm
- El combustible más económico

Resumen
Motor: 4 tiempos
Cilindrada: 198.88 cc
Llantas: 4-8 sin cámara
Potencia: 8.78 HP
Torque: 14.5 Nm

Motor
Motor: 4 tiempos GNV
Cilindrada: 198.88 cc
Diámetro × carrera: 63.5 mm × 62.8 mm
Bujía: Doble bujía
Refrigeración: Forzada por aire y aceite
Embrague: Multidisco húmedo
Transmisión: Manual, malla constante: 4 marchas + 1 reversa
Potencia máxima: 8.78 HP a 5,000 ± 250 RPM
Torque máximo: 14.5 Nm a 3,500 ± 250 RPM

Chasis y Carrocería
Neumáticos: 4.00-8, 6 PR, aro de una pieza
Capacidad de escalada: 19% (10.8°) máx.

Consumo y Rendimiento
Capacidad de tanque: 30 L / 4.5 kg de GNV (reserva 3 L)

Dimensiones
Largo: 2,635 mm
Ancho: 1,300 mm
Alto: 1,710 mm
Peso: 348 kg

Sistema eléctrico
Sistema eléctrico: 12 V CC
Batería: 32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)
Bocina: 12 V DC, tipo 2A

Fotos por color
Rojo: https://torito.pe/wp-content/uploads/2025/10/Para-pasajeros-4-T.png$torito$ WHERE nommod = 'Torito Crom Plus GNV' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito Crom Plus GLP
UPDATE public.modelo SET premod = 17199 WHERE nommod = 'Torito Crom Plus GLP' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Azul']) FROM public.modelo m
 WHERE m.nommod = 'Torito Crom Plus GLP' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$Crom Plus con GLP: equilibrio entre potencia y ahorro, con 9.32 HP y 16 Nm para el trabajo diario.$torito$ WHERE nommod = 'Torito Crom Plus GLP' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores Crom Plus
Tipo de motor: 4 tiempos
Combustible: GLP
Uso: Pasajeros
Techo: Especial
Color de la foto: Azul

Destacados
- 9.32 HP y 16 Nm de torque
- Opera con GLP
- Peso de 370 kg
- Excelente relación precio-rendimiento

Resumen
Motor: 4 tiempos
Cilindrada: 198.88 cc
Llantas: 4-8 sin cámara
Potencia: 9.32 HP
Torque: 16 Nm

Motor
Motor: 4 tiempos UG GLP
Cilindrada: 198.88 cc
Diámetro × carrera: 63.5 mm × 62.8 mm
Bujía: 2 (Champion RG6HCC / Bosch UR6CC)
Refrigeración: Forzada por aire y aceite
Embrague: Multidisco húmedo (7 discos)
Transmisión: Engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 9.32 HP a 5,000 ± 250 RPM
Torque máximo: 16 Nm a 3,500 ± 250 RPM

Chasis y Carrocería
Chasis: Monocasco
Neumáticos: 4-8, 4-6 PR (sin cámara)
Frenos: Tambor de expansión hidráulica, delantero y posterior
Freno de estacionamiento: Zapata de expansión mecánica
Presión de llantas: Delantera 36 PSI · posterior 40 PSI
Capacidad de escalada: 16.5% (9.1°) máx.

Consumo y Rendimiento
Velocidad máxima: 65 km/h
Capacidad de tanque: 20.6 L de GLP + 3 L de gasolina

Dimensiones
Largo: 2,635 mm
Ancho: 1,300 mm
Alto: 1,710 mm
Radio de giro: 2,880 mm
Peso: 370 kg

Sistema eléctrico
Sistema eléctrico: 12 V CC
Batería: 32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)
Bocina: 12 V DC, tipo 2A

Fotos por color
Azul: https://torito.pe/wp-content/uploads/2025/04/646c02f5bcb15589337055.png$torito$ WHERE nommod = 'Torito Crom Plus GLP' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

-- Torito Crom Plus GSL
UPDATE public.modelo SET premod = 17199 WHERE nommod = 'Torito Crom Plus GSL' AND premod IS NULL;
SELECT public.hu012_guardar_colores(m.codmod, ARRAY['Azul']) FROM public.modelo m
 WHERE m.nommod = 'Torito Crom Plus GSL' AND NOT EXISTS (SELECT 1 FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo);
UPDATE public.modelo SET desmod = $torito$Crom Plus a gasolina: la versión más potente de la familia, con 10.19 HP y 17.10 Nm de torque.$torito$ WHERE nommod = 'Torito Crom Plus GSL' AND char_length(btrim(coalesce(desmod, ''))) < 40;
UPDATE public.modelo SET carmod = $torito$Familia: Motores Crom Plus
Tipo de motor: 4 tiempos
Combustible: Gasolina
Uso: Pasajeros
Techo: Especial
Color de la foto: Azul

Destacados
- 10.19 HP y 17.10 Nm de torque
- Opera con gasolina
- Peso de 348 kg
- Diseño Crom Plus

Resumen
Motor: 4 tiempos
Cilindrada: 198.88 cc
Llantas: 4-8 sin cámara
Potencia: 10.19 HP
Torque: 17.10 Nm

Motor
Motor: 4 tiempos UG a gasolina
Cilindrada: 198.88 cc
Diámetro × carrera: 63.5 mm × 62.8 mm
Bujía: 2 (Champion RG6HCC / Bosch UR6CC)
Refrigeración: Forzada por aire y aceite
Embrague: Multidisco húmedo (7 discos)
Transmisión: Engranaje constante, manual: 4 marchas + 1 reversa
Potencia máxima: 10.19 HP a 5,000 ± 250 RPM
Torque máximo: 17.10 Nm a 3,500 ± 250 RPM

Chasis y Carrocería
Chasis: Monocasco
Neumáticos: 4-8, 4-6 PR (sin cámara)
Frenos: Tambor de expansión hidráulica, delantero y posterior
Freno de estacionamiento: Zapata de expansión mecánica
Presión de llantas: Delantera 36 PSI · posterior 40 PSI

Consumo y Rendimiento
Velocidad máxima: 65 km/h
Capacidad de tanque: 8 L
Capacidad de escalada: 19% (10.8°) máx.

Dimensiones
Largo: 2,635 mm
Ancho: 1,300 mm
Alto: 1,710 mm
Radio de giro: 2,880 mm
Peso: 348 kg

Sistema eléctrico
Sistema eléctrico: 12 V CC
Batería: 32 Ah (arranque eléctrico) / 7 Ah (arranque no eléctrico)
Bocina: 12 V DC, tipo 2A

Fotos por color
Azul: https://torito.pe/wp-content/uploads/2025/04/3-2.png$torito$ WHERE nommod = 'Torito Crom Plus GSL' AND coalesce(carmod, '') NOT LIKE 'Familia:%';

COMMIT;

-- Comprobación: cada modelo con su precio, sus colores y la ficha completa (sí)
SELECT m.nommod AS modelo, m.premod AS precio,
  (SELECT string_agg(c.nomcmo, ', ') FROM public.colormodelo c WHERE c.codmod = m.codmod AND c.estcmo) AS colores,
  CASE WHEN m.carmod LIKE 'Familia:%' THEN 'sí' ELSE 'no' END AS ficha_completa
FROM public.modelo m ORDER BY m.nommod;
