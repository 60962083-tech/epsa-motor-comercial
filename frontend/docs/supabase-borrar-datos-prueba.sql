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

-- 2. Borrar (también lo que cuelga de esos registros: seguimiento, historial, preparación, movimientos…;
--    la base dice qué tablas dependen de cada uno, así sirve aunque se agreguen tablas nuevas)
BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.epsa_borrar(p_tabla regclass, p_filtro text, p_nivel integer DEFAULT 0)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE r record;
BEGIN
  IF p_nivel < 6 THEN
    FOR r IN
      SELECT c.conrelid::regclass AS hija,
        (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.n) FROM unnest(c.conkey) WITH ORDINALITY k(att, n)
           JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.att) AS cols_hija,
        (SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY k.n) FROM unnest(c.confkey) WITH ORDINALITY k(att, n)
           JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.att) AS cols_padre
      FROM pg_constraint c
      WHERE c.contype = 'f' AND c.confrelid = p_tabla AND c.conrelid <> p_tabla AND c.confdeltype IN ('a', 'r')
    LOOP
      PERFORM pg_temp.epsa_borrar(r.hija,
        format('(%s) IN (SELECT %s FROM %s WHERE %s)', r.cols_hija, r.cols_padre, p_tabla, p_filtro), p_nivel + 1);
    END LOOP;
  END IF;
  EXECUTE format('DELETE FROM %s WHERE %s', p_tabla, p_filtro);
END;
$$;

DO $$
DECLARE v_compras bigint[];
BEGIN
  -- El historial de preparación no se puede borrar (es de solo lectura); solo para quitar datos de prueba
  -- se suspende su protección dentro de esta misma operación y se vuelve a activar al final.
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hu033_historial_preparacion_inmutable') THEN
    EXECUTE 'ALTER TABLE public.historialpreparacionunidad DISABLE TRIGGER hu033_historial_preparacion_inmutable';
  END IF;
  -- Interesados de prueba
  PERFORM pg_temp.epsa_borrar('public.lead', $f$nomlea ILIKE 'prueba %'$f$);
  -- Compras de prueba (factura F999-…) con sus motos
  SELECT coalesce(array_agg(codcom), '{}') INTO v_compras FROM public.factura_compra WHERE numero ILIKE 'F999-%';
  PERFORM pg_temp.epsa_borrar('public.unidad', format('codcom = ANY (%L::bigint[])', v_compras));
  PERFORM pg_temp.epsa_borrar('public.compra', format('codcom = ANY (%L::bigint[])', v_compras));
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hu033_historial_preparacion_inmutable') THEN
    EXECUTE 'ALTER TABLE public.historialpreparacionunidad ENABLE TRIGGER hu033_historial_preparacion_inmutable';
  END IF;
END;
$$;

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
