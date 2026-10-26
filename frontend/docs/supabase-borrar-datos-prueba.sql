-- =====================================================================
-- EPSA Motor · Borrar SOLO los datos de prueba
--
-- Borra lo que se registró para probar, con estas marcas:
--   - Interesados cuyo nombre empieza con «Prueba» (web o panel), con su
--     seguimiento y sus asignaciones.
--   - Compras cuya factura empieza con «F999-», con sus motos y los
--     movimientos de esas motos.
-- No toca nada más: modelos, ubicaciones, cuentas ni datos reales.
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Primero muestra lo que va a borrar y al final lo que queda (debe salir 0).
-- =====================================================================

-- 1. Lo que se va a borrar
SELECT 'Interesado' AS tipo, codlea::text AS codigo, nomlea AS detalle FROM public.lead WHERE nomlea ILIKE 'prueba %'
UNION ALL
SELECT 'Compra', c.codcom::text, f.numero || ' · ' || m.nommod || ' · ' || c.cancom || ' motos'
FROM public.compra c JOIN public.factura_compra f ON f.codcom = c.codcom JOIN public.modelo m ON m.codmod = c.codmod
WHERE f.numero ILIKE 'F999-%'
UNION ALL
SELECT 'Moto', u.coduni::text, u.nummotuni || ' / ' || u.chauni
FROM public.unidad u JOIN public.factura_compra f ON f.codcom = u.codcom
WHERE f.numero ILIKE 'F999-%';

-- 2. Borrar
BEGIN;

-- Interesados de prueba
DELETE FROM public.seguimientolead WHERE codlea IN (SELECT codlea FROM public.lead WHERE nomlea ILIKE 'prueba %');
DELETE FROM public.asignacionlead WHERE codlea IN (SELECT codlea FROM public.lead WHERE nomlea ILIKE 'prueba %');
DELETE FROM public.lead WHERE nomlea ILIKE 'prueba %';

-- Compras de prueba (factura F999-…) con sus motos y movimientos
CREATE TEMP TABLE compras_prueba ON COMMIT DROP AS
  SELECT codcom FROM public.factura_compra WHERE numero ILIKE 'F999-%';
DELETE FROM public.movimientoubicacion WHERE coduni IN (SELECT coduni FROM public.unidad WHERE codcom IN (SELECT codcom FROM compras_prueba));
DELETE FROM public.separacion WHERE coduni IN (SELECT coduni FROM public.unidad WHERE codcom IN (SELECT codcom FROM compras_prueba));
DELETE FROM public.venta WHERE coduni IN (SELECT coduni FROM public.unidad WHERE codcom IN (SELECT codcom FROM compras_prueba));
DELETE FROM public.unidad WHERE codcom IN (SELECT codcom FROM compras_prueba);
DELETE FROM public.factura_compra WHERE codcom IN (SELECT codcom FROM compras_prueba);
DELETE FROM public.compra WHERE codcom IN (SELECT codcom FROM compras_prueba);

COMMIT;

-- 3. Comprobación: todo debe salir en 0
SELECT
  (SELECT count(*) FROM public.lead WHERE nomlea ILIKE 'prueba %') AS interesados_de_prueba,
  (SELECT count(*) FROM public.factura_compra WHERE numero ILIKE 'F999-%') AS compras_de_prueba;

-- 4. Compras que quedaron SIN factura (por ejemplo, si una prueba se cortó antes de registrarla).
--    Revisa la lista; si alguna es de prueba, bórrala con su número:
--    DELETE FROM public.compra WHERE codcom = <número> AND NOT EXISTS (SELECT 1 FROM public.unidad u WHERE u.codcom = <número>);
SELECT c.codcom AS numero, c.feccom AS fecha, m.nommod AS modelo, c.colcom AS color, c.cancom AS motos
FROM public.compra c JOIN public.modelo m ON m.codmod = c.codmod
WHERE NOT EXISTS (SELECT 1 FROM public.factura_compra f WHERE f.codcom = c.codcom)
ORDER BY c.codcom DESC;
