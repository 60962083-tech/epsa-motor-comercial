-- =====================================================================
-- EPSA Motor · Borrar las facturas de PRUEBA de la HU-030 (PASO-10)
--
-- Borra SOLO las facturas cuya serie empieza con F999- (las de prueba) y lo
-- que ellas crearon: sus líneas, sus motos (y todo lo que cuelga de esas
-- motos: traslados, preparación, etc.), las compras que registraron solas,
-- sus intentos y recepciones, y el código de prueba B3-PRUEBA-NUEVO.
-- No toca facturas reales (F067-…), ni modelos, ni compras registradas a mano.
--
-- Busca solo qué tablas dependen de cada moto o compra, así sigue sirviendo
-- aunque el backend agregue tablas nuevas. No crea tablas (no pide RLS).
-- Los archivos XML y PDF de prueba quedan en Storage › facturas-compra ›
-- panel; se pueden borrar a mano desde ahí (no afectan nada).
--
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- Si algo falla no se borra nada. Se puede ejecutar más de una vez.
-- =====================================================================

BEGIN;

-- Función temporal (desaparece al terminar): borra filas y, antes, todo lo que las referencia
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
      WHERE c.contype = 'f' AND c.confrelid = p_tabla AND c.conrelid <> p_tabla
        AND c.confdeltype IN ('a', 'r')   -- las que tienen ON DELETE CASCADE o SET NULL las resuelve la base
    LOOP
      PERFORM pg_temp.epsa_borrar(r.hija,
        format('(%s) IN (SELECT %s FROM %s WHERE %s)', r.cols_hija, r.cols_padre, p_tabla, p_filtro), p_nivel + 1);
    END LOOP;
  END IF;
  EXECUTE format('DELETE FROM %s WHERE %s', p_tabla, p_filtro);
END;
$$;

DO $$
DECLARE
  v_docs bigint[];
  v_motos bigint[];
  v_compras bigint[];
BEGIN
  SELECT coalesce(array_agg(coddoc), '{}') INTO v_docs FROM public.documentocompra WHERE iddoc LIKE 'F999-%';

  -- Compras que esas facturas registraron solas (no las registradas a mano)
  SELECT coalesce(array_agg(DISTINCT dc.codcom), '{}') INTO v_compras
  FROM public.documentocompracompra dc
  WHERE dc.coddoc = ANY (v_docs) AND dc.tipvinculo = 'Automatico'
    AND NOT EXISTS (SELECT 1 FROM public.documentocompracompra o WHERE o.codcom = dc.codcom AND NOT (o.coddoc = ANY (v_docs)));

  -- Motos creadas por esas facturas o de esas compras
  SELECT coalesce(array_agg(DISTINCT x.coduni), '{}') INTO v_motos FROM (
    SELECT v.coduni FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l ON l.codlin = v.codlin
    WHERE l.coddoc = ANY (v_docs) AND v.coduni IS NOT NULL
    UNION SELECT u.coduni FROM public.unidad u WHERE u.codcom = ANY (v_compras)
  ) x;

  RAISE NOTICE 'Facturas de prueba: %, compras: %, motos: %', cardinality(v_docs), cardinality(v_compras), cardinality(v_motos);

  -- El historial de preparación no se puede borrar (es de solo lectura); solo para quitar datos de prueba
  -- se suspende su protección dentro de esta misma operación y se vuelve a activar al final.
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hu033_historial_preparacion_inmutable') THEN
    EXECUTE 'ALTER TABLE public.historialpreparacionunidad DISABLE TRIGGER hu033_historial_preparacion_inmutable';
  END IF;
  -- La recepción por correo apunta a su intento activo: se suelta antes de borrar
  UPDATE public.recepcionintegracionfactura SET coditiactivo = NULL WHERE coddoc = ANY (v_docs);

  PERFORM pg_temp.epsa_borrar('public.unidad', format('coduni = ANY (%L::bigint[])', v_motos));
  PERFORM pg_temp.epsa_borrar('public.compra', format('codcom = ANY (%L::bigint[])', v_compras));
  PERFORM pg_temp.epsa_borrar('public.documentocompra', format('coddoc = ANY (%L::bigint[])', v_docs));

  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'hu033_historial_preparacion_inmutable') THEN
    EXECUTE 'ALTER TABLE public.historialpreparacionunidad ENABLE TRIGGER hu033_historial_preparacion_inmutable';
  END IF;
  -- El código de Crosland de prueba
  DELETE FROM public.equivalenciaproducto e
  WHERE upper(e.codext) = 'B3-PRUEBA-NUEVO'
    AND NOT EXISTS (SELECT 1 FROM public.lineadocumentocompra l WHERE l.codequ = e.codequ);
END;
$$;

COMMIT;

-- Comprobación: todo en 0
SELECT
  (SELECT count(*) FROM public.documentocompra WHERE iddoc LIKE 'F999-%') AS facturas_de_prueba,
  (SELECT count(*) FROM public.unidad WHERE nummotuni LIKE 'PRUEBA3%') AS motos_de_prueba,
  (SELECT count(*) FROM public.equivalenciaproducto WHERE upper(codext) = 'B3-PRUEBA-NUEVO') AS codigo_de_prueba;
