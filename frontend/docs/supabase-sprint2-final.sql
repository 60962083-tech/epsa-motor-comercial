-- =====================================================================
-- EPSA Motor · Sprint 2 · Mejoras finales (PASO-11)
--
-- Qué agrega y por qué:
--  1. Compras a proveedor
--     - compra.codpro: el proveedor elegido al registrar la compra.
--     - compra.grupocom: identifica las compras que se registraron juntas
--       en un mismo pedido (varios modelos y colores a la vez).
--     - hu034_proveedores_compra: proveedores de motos para elegir.
--     - hu034_registrar_carrito: registra varias compras de una vez; se
--       guardan todas o ninguna.
--     - hu034_guardar_pedido: guarda el N° de pedido de Asiri de una compra
--       (así la factura que llega por correo completa esa compra).
--     - hu034_compras_listar: todas las compras, también las identificadas,
--       para que funcionen los filtros de la lista.
--     - hu034_compra_extra: proveedor, pedido y las demás compras del mismo
--       registro, para la pantalla de cada compra.
--  2. Web y catálogo: hu012_eliminar_modelo borra un modelo con sus colores y
--     fotos, solo la gerencia y solo si no tiene motos, compras ni interesados.
--  3. HU-030: la lista y el detalle de facturas reconocen las que llegaron
--     por correo (origen, fecha, PDF y XML guardados) y hu030_correos_listar
--     muestra cada correo recibido con su estado.
--  4. HU-033: hu033_preparacion_listar devuelve la preparación de todas las
--     motos en una sola consulta (usa las funciones de Michelle).
--  5. HU-001: hu001_cambiar_situacion_comercial pone a la venta una moto lista
--     para entrega («Disponible») o la retira («No disponible»). Las motos
--     nuevas quedan «No disponible» y nada más las ponía a la venta.
--
-- No cambia nada del Sprint 1 ni borra datos. Se puede ejecutar más de una vez.
-- Cómo se usa: Supabase > SQL Editor > New query > pegar TODO > Run.
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. Compras a proveedor
-- =====================================================================
ALTER TABLE public.compra ADD COLUMN IF NOT EXISTS codpro bigint REFERENCES public.proveedor(codpro);
ALTER TABLE public.compra ADD COLUMN IF NOT EXISTS grupocom uuid;
CREATE INDEX IF NOT EXISTS ix_compra_grupocom ON public.compra(grupocom) WHERE grupocom IS NOT NULL;
COMMENT ON COLUMN public.compra.codpro IS 'Proveedor elegido al registrar la compra (Sprint 2).';
COMMENT ON COLUMN public.compra.grupocom IS 'Compras registradas juntas en un mismo pedido del panel (Sprint 2).';

CREATE OR REPLACE FUNCTION public.hu034_exigir_gestion()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_codusu bigint;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo gerencia y administración registran compras.';
  END IF;
  SELECT codusu INTO v_codusu FROM public.usuario WHERE uuidusu = auth.uid() AND estusu;
  IF v_codusu IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Usuario no autorizado.';
  END IF;
  RETURN v_codusu;
END;
$$;

-- Proveedores de motos (los que facturan motos tienen RUC registrado; hoy, Crosland)
CREATE OR REPLACE FUNCTION public.hu034_proveedores_compra()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.hu034_exigir_gestion();
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('codpro', p.codpro::text, 'nompro', p.nompro, 'rucpro', p.rucpro) ORDER BY p.nompro)
    FROM public.proveedor p
    WHERE p.estpro AND p.rucpro IS NOT NULL
  ), '[]'::jsonb);
END;
$$;

-- N° de pedido de Asiri de una compra registrada a mano (vacío = quitarlo)
CREATE OR REPLACE FUNCTION public.hu034_guardar_pedido(p_codcom bigint, p_pedido text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_autor bigint;
  v_compra public.compra%ROWTYPE;
  v_codpro bigint;
  v_pedido text;
  v_otra bigint;
BEGIN
  v_autor := public.hu034_exigir_gestion();
  SELECT * INTO v_compra FROM public.compra WHERE codcom = p_codcom FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Esa compra no existe.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.documentocompracompra WHERE codcom = p_codcom) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Esta compra ya está vinculada a una factura recibida: su pedido no se cambia.';
  END IF;
  v_codpro := coalesce(v_compra.codpro, (SELECT codpro FROM public.proveedor WHERE rucpro = '20502913752'));
  IF v_codpro IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Falta registrar el proveedor Crosland con su RUC.';
  END IF;
  v_pedido := upper(btrim(regexp_replace(coalesce(p_pedido, ''), '[[:space:]]+', '', 'g')));
  IF v_pedido <> '' AND v_pedido !~ '^[A-Z0-9-]{1,40}$' THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'El N° de pedido solo lleva letras, números o guiones (máximo 40).';
  END IF;
  IF v_pedido <> '' THEN
    SELECT codcom INTO v_otra FROM public.referenciacompra
    WHERE codpro = v_codpro AND tipref = 'PedidoCrosland' AND estref = 'Activa'
      AND upper(btrim(valrefnormalizado)) = v_pedido AND codcom <> p_codcom
    LIMIT 1;
    IF v_otra IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = format('El pedido %s ya está en la compra N° %s.', v_pedido, v_otra);
    END IF;
    IF EXISTS (SELECT 1 FROM public.referenciacompra WHERE codcom = p_codcom AND tipref = 'PedidoCrosland'
               AND estref = 'Activa' AND upper(btrim(valrefnormalizado)) = v_pedido) THEN
      RETURN jsonb_build_object('codcom', p_codcom::text, 'pedido', v_pedido);
    END IF;
  END IF;
  UPDATE public.referenciacompra SET estref = 'Inactiva'
  WHERE codcom = p_codcom AND tipref = 'PedidoCrosland' AND estref = 'Activa';
  IF v_pedido <> '' THEN
    INSERT INTO public.referenciacompra (codcom, codpro, tipref, valreforiginal, valrefnormalizado, codusuaut)
    VALUES (p_codcom, v_codpro, 'PedidoCrosland', v_pedido, v_pedido, v_autor);
  END IF;
  RETURN jsonb_build_object('codcom', p_codcom::text, 'pedido', nullif(v_pedido, ''));
END;
$$;

-- Registrar varias compras de una vez (una por modelo y color). Todas o ninguna.
-- p_items: [{"codmod": 5, "color": "Negro", "cantidad": 3, "pedido": "0002010750"}, ...]
-- La misma clave reenviada (reintento) no registra nada dos veces.
CREATE OR REPLACE FUNCTION public.hu034_registrar_carrito(p_codpro bigint, p_items jsonb, p_clave uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_item jsonb;
  v_i integer := 0;
  v_codmod bigint;
  v_color text;
  v_cantidad integer;
  v_pedido text;
  v_r jsonb;
  v_codcom bigint;
  v_previas integer;
BEGIN
  PERFORM public.hu034_exigir_gestion();
  IF p_clave IS NULL OR jsonb_typeof(p_items) IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_items) < 1 OR jsonb_array_length(p_items) > 30 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Agrega entre 1 y 30 modelos a la compra.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.proveedor WHERE codpro = p_codpro AND estpro AND rucpro IS NOT NULL) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = 'Elige un proveedor de motos activo.';
  END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('carrito:' || p_clave::text, 34034));

  -- Reintento de la misma compra: se devuelve lo ya registrado
  SELECT count(*) INTO v_previas FROM public.compra WHERE grupocom = p_clave;
  IF v_previas > 0 THEN
    IF v_previas <> jsonb_array_length(p_items) THEN
      RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Esta compra ya se registró con otros datos.';
    END IF;
  ELSE
    IF (SELECT count(*) FROM (SELECT DISTINCT (e->>'codmod'), lower(btrim(e->>'color')) FROM jsonb_array_elements(p_items) e) x)
       <> jsonb_array_length(p_items) THEN
      RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Hay un modelo con el mismo color repetido: junta sus cantidades.';
    END IF;
    FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
      v_i := v_i + 1;
      IF coalesce(v_item->>'codmod', '') !~ '^[1-9][0-9]{0,17}$' OR coalesce(v_item->>'cantidad', '') !~ '^[1-9][0-9]{0,3}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = format('Revisa el modelo y la cantidad de la línea %s.', v_i);
      END IF;
      v_codmod := (v_item->>'codmod')::bigint;
      v_cantidad := (v_item->>'cantidad')::integer;
      v_color := btrim(regexp_replace(coalesce(v_item->>'color', ''), '[[:space:]]+', ' ', 'g'));
      v_pedido := nullif(btrim(coalesce(v_item->>'pedido', '')), '');
      IF v_color = '' THEN
        RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = format('Elige el color de la línea %s.', v_i);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.modelo WHERE codmod = v_codmod) THEN
        RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = format('El modelo de la línea %s ya no existe.', v_i);
      END IF;
      IF EXISTS (SELECT 1 FROM public.colormodelo WHERE codmod = v_codmod)
         AND NOT EXISTS (SELECT 1 FROM public.colormodelo WHERE codmod = v_codmod AND lower(nomcmo) = lower(v_color)) THEN
        RAISE EXCEPTION USING ERRCODE = 'PT422', MESSAGE = format('El color %s no es de ese modelo (línea %s).', v_color, v_i);
      END IF;
      v_r := public.hu034_registrar_compra(v_codmod, v_color, v_cantidad, md5(p_clave::text || ':' || v_i)::uuid);
      v_codcom := (v_r->'compra'->>'codcom')::bigint;
      UPDATE public.compra SET codpro = p_codpro, grupocom = p_clave WHERE codcom = v_codcom;
      IF v_pedido IS NOT NULL THEN
        PERFORM public.hu034_guardar_pedido(v_codcom, v_pedido);
      END IF;
    END LOOP;
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('codcom', c.codcom::text, 'codmod', c.codmod::text, 'nommod', m.nommod,
      'colcom', c.colcom, 'cancom', c.cancom, 'estcom', c.estcom,
      'pedido', (SELECT r.valrefnormalizado FROM public.referenciacompra r WHERE r.codcom = c.codcom AND r.estref = 'Activa' ORDER BY r.codref DESC LIMIT 1))
      ORDER BY c.codcom)
    FROM public.compra c JOIN public.modelo m ON m.codmod = c.codmod
    WHERE c.grupocom = p_clave
  ), '[]'::jsonb);
END;
$$;

-- Todas las compras (pendientes e identificadas) con su factura, pedido y origen
CREATE OR REPLACE FUNCTION public.hu034_compras_listar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_rol text := public.hu026_rol_actual();
BEGIN
  IF coalesce(v_rol, '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'codcom', c.codcom::text, 'codmod', c.codmod::text, 'nommod', m.nommod, 'colcom', c.colcom, 'cancom', c.cancom,
      'cantidad_pendiente', greatest(c.cancom - coalesce(u.n, 0), 0), 'cantidad_identificada', coalesce(u.n, 0),
      'estcom', c.estcom, 'feccom', c.feccom, 'horcom', to_char(c.horcom, 'HH24:MI'),
      'proveedor', p.nompro, 'grupo', c.grupocom::text,
      'origen', CASE WHEN EXISTS (SELECT 1 FROM public.documentocompracompra d WHERE d.codcom = c.codcom AND d.tipvinculo = 'Automatico')
                     THEN 'Factura importada' ELSE 'Registro manual' END,
      'pedido', (SELECT r.valrefnormalizado FROM public.referenciacompra r WHERE r.codcom = c.codcom AND r.estref = 'Activa' ORDER BY r.codref DESC LIMIT 1),
      'factura', CASE WHEN f.codfac IS NULL THEN NULL ELSE jsonb_build_object('numero', f.numero, 'emisor', f.emisor, 'cantidad_motos', f.cantidad_motos, 'fecha_emision', f.fecha_emision) END)
      ORDER BY c.codcom DESC)
    FROM public.compra c
    JOIN public.modelo m ON m.codmod = c.codmod
    LEFT JOIN public.proveedor p ON p.codpro = c.codpro
    LEFT JOIN public.factura_compra f ON f.codcom = c.codcom
    LEFT JOIN (SELECT codcom, count(*)::integer n FROM public.unidad WHERE codcom IS NOT NULL GROUP BY codcom) u ON u.codcom = c.codcom
  ), '[]'::jsonb);
END;
$$;

-- Proveedor, pedido y compras registradas junto con esta
CREATE OR REPLACE FUNCTION public.hu034_compra_extra(p_codcom bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_compra public.compra%ROWTYPE;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  SELECT * INTO v_compra FROM public.compra WHERE codcom = p_codcom;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Esa compra no existe.';
  END IF;
  RETURN jsonb_build_object(
    'codcom', v_compra.codcom::text,
    'proveedor', (SELECT nompro FROM public.proveedor WHERE codpro = v_compra.codpro),
    'pedido', (SELECT r.valrefnormalizado FROM public.referenciacompra r WHERE r.codcom = v_compra.codcom AND r.estref = 'Activa' ORDER BY r.codref DESC LIMIT 1),
    'vinculada', EXISTS (SELECT 1 FROM public.documentocompracompra WHERE codcom = v_compra.codcom),
    -- Factura que llegó por correo (o se subió en Facturas recibidas) y si se guardó su PDF
    'coddoc', (SELECT dc.coddoc::text FROM public.documentocompracompra dc WHERE dc.codcom = v_compra.codcom ORDER BY dc.coddoc LIMIT 1),
    'vinculo', (SELECT dc.tipvinculo FROM public.documentocompracompra dc WHERE dc.codcom = v_compra.codcom ORDER BY dc.coddoc LIMIT 1),
    'pdf', EXISTS (SELECT 1 FROM public.documentocompracompra dc JOIN public.documentocompra d ON d.coddoc = dc.coddoc
                   WHERE dc.codcom = v_compra.codcom AND (d.rutapdf IS NOT NULL
                     OR EXISTS (SELECT 1 FROM public.recepcionintegracionfactura r WHERE r.coddoc = d.coddoc AND r.rutapdf IS NOT NULL))),
    'grupo', CASE WHEN v_compra.grupocom IS NULL THEN '[]'::jsonb ELSE coalesce((
      SELECT jsonb_agg(jsonb_build_object('codcom', c.codcom::text, 'nommod', m.nommod, 'colcom', c.colcom, 'cancom', c.cancom,
        'estcom', c.estcom, 'factura', f.numero) ORDER BY c.codcom)
      FROM public.compra c JOIN public.modelo m ON m.codmod = c.codmod
      LEFT JOIN public.factura_compra f ON f.codcom = c.codcom
      WHERE c.grupocom = v_compra.grupocom AND c.codcom <> v_compra.codcom), '[]'::jsonb) END);
END;
$$;

-- =====================================================================
-- 2. Web y catálogo · Eliminar un modelo (solo gerencia)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hu012_eliminar_modelo(p_codmod bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_modelo public.modelo%ROWTYPE;
  v_motos bigint; v_compras bigint; v_interesados bigint; v_codigos bigint;
  v_partes text[] := ARRAY[]::text[];
  v_fotos jsonb;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') <> 'Gerente' THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo la gerencia puede eliminar modelos.';
  END IF;
  SELECT * INTO v_modelo FROM public.modelo WHERE codmod = p_codmod FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Ese modelo ya no existe.';
  END IF;
  SELECT count(*) INTO v_motos FROM public.unidad WHERE codmod = p_codmod;
  SELECT count(*) INTO v_compras FROM public.compra WHERE codmod = p_codmod;
  SELECT count(*) INTO v_interesados FROM public.lead WHERE codmod = p_codmod;
  SELECT count(*) INTO v_codigos FROM public.equivalenciaproducto WHERE codmod = p_codmod;
  IF v_motos > 0 THEN v_partes := v_partes || format('%s moto%s', v_motos, CASE WHEN v_motos = 1 THEN '' ELSE 's' END); END IF;
  IF v_compras > 0 THEN v_partes := v_partes || format('%s compra%s', v_compras, CASE WHEN v_compras = 1 THEN '' ELSE 's' END); END IF;
  IF v_interesados > 0 THEN v_partes := v_partes || format('%s interesado%s', v_interesados, CASE WHEN v_interesados = 1 THEN '' ELSE 's' END); END IF;
  IF v_codigos > 0 THEN v_partes := v_partes || format('%s código%s de Crosland', v_codigos, CASE WHEN v_codigos = 1 THEN '' ELSE 's' END); END IF;
  IF cardinality(v_partes) > 0 THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409',
      MESSAGE = format('No se puede eliminar %s porque tiene %s registrados. Puedes retirarlo de la web.', v_modelo.nommod, array_to_string(v_partes, ', '));
  END IF;
  SELECT coalesce(jsonb_agg(urlimo), '[]'::jsonb) INTO v_fotos FROM public.imagenmodelo WHERE codmod = p_codmod;
  BEGIN
    DELETE FROM public.imagenmodelo WHERE codmod = p_codmod;
    DELETE FROM public.colormodelo WHERE codmod = p_codmod;
    DELETE FROM public.modelo WHERE codmod = p_codmod;
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409',
      MESSAGE = format('No se puede eliminar %s porque otros registros lo usan. Puedes retirarlo de la web.', v_modelo.nommod);
  END;
  RETURN jsonb_build_object('codmod', p_codmod::text, 'nommod', v_modelo.nommod, 'fotos', v_fotos);
END;
$$;

-- =====================================================================
-- 3. HU-030 · Facturas que llegan por correo
-- =====================================================================
-- Lista de facturas con su resultado (las del correo traen su recepción)
CREATE OR REPLACE FUNCTION public.hu030_documentos_listar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.hu030_exigir_gestion();
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'coddoc', d.coddoc::text, 'factura', d.iddoc, 'serie', d.serdoc, 'numero', d.numdoc,
      'emitida', d.fecemidoc, 'recibida', coalesce(r.fecprimerarec, d.fecbackendrec, d.fecprimerproc, d.fecultimoint),
      'origen', CASE WHEN r.codrec IS NOT NULL OR d.gmailmessageid IS NOT NULL THEN 'Correo' ELSE 'Panel' END,
      'estado', d.estdoc, 'error', d.coderrdoc, 'motivo', d.motdoc,
      'total', d.totalapagar, 'moneda', d.monedoc, 'proveedor', coalesce(d.razonsocialemisordoc, p.nompro),
      'pdf', coalesce(d.rutapdf, r.rutapdf) IS NOT NULL, 'xml', coalesce(d.rutaxml, r.rutaxml) IS NOT NULL,
      'lineas', (SELECT count(*) FROM public.lineadocumentocompra l WHERE l.coddoc = d.coddoc),
      'revision', (SELECT count(*) FROM public.lineadocumentocompra l WHERE l.coddoc = d.coddoc AND l.estlin = 'Revision'),
      'motos', (SELECT count(*) FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l ON l.codlin = v.codlin WHERE l.coddoc = d.coddoc),
      'motosIngresadas', (SELECT count(*) FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l ON l.codlin = v.codlin WHERE l.coddoc = d.coddoc AND v.coduni IS NOT NULL),
      'compras', coalesce((SELECT jsonb_agg(c.codcom::text ORDER BY c.codcom) FROM public.documentocompracompra c WHERE c.coddoc = d.coddoc), '[]'::jsonb))
      ORDER BY coalesce(r.fecprimerarec, d.fecbackendrec, d.fecprimerproc, d.fecultimoint) DESC NULLS LAST, d.coddoc DESC)
    FROM public.documentocompra d
    LEFT JOIN public.proveedor p ON p.codpro = d.codpro
    LEFT JOIN LATERAL (SELECT * FROM public.recepcionintegracionfactura x WHERE x.coddoc = d.coddoc
                       ORDER BY x.fecprimerarec LIMIT 1) r ON true
  ), '[]'::jsonb);
END;
$$;

-- Detalle de una factura: líneas, motos, compras, intentos y archivos guardados
CREATE OR REPLACE FUNCTION public.hu030_documento_detalle(p_coddoc bigint)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_doc public.documentocompra%ROWTYPE;
  v_rec public.recepcionintegracionfactura%ROWTYPE;
BEGIN
  PERFORM public.hu030_exigir_gestion();
  SELECT * INTO v_doc FROM public.documentocompra WHERE coddoc = p_coddoc;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Esa factura no existe.';
  END IF;
  SELECT * INTO v_rec FROM public.recepcionintegracionfactura WHERE coddoc = p_coddoc
  ORDER BY (rutaxml IS NOT NULL) DESC, (rutapdf IS NOT NULL) DESC, fecprimerarec LIMIT 1;
  RETURN jsonb_build_object(
    'coddoc', v_doc.coddoc::text, 'factura', v_doc.iddoc, 'tipo', v_doc.tipdoc, 'emitida', v_doc.fecemidoc, 'vence', v_doc.fecvencdoc,
    'recibida', coalesce(v_rec.fecprimerarec, v_doc.fecbackendrec, v_doc.fecprimerproc, v_doc.fecultimoint),
    'correo', coalesce(v_doc.fecgmailrec, v_rec.fecprimerarec),
    'origen', CASE WHEN v_rec.codrec IS NOT NULL OR v_doc.gmailmessageid IS NOT NULL THEN 'Correo' ELSE 'Panel' END,
    'estado', v_doc.estdoc, 'error', v_doc.coderrdoc, 'motivo', v_doc.motdoc,
    'emisor', jsonb_build_object('ruc', v_doc.rucemisordoc, 'nombre', v_doc.razonsocialemisordoc),
    'comprador', jsonb_build_object('ruc', v_doc.ruccompradordoc, 'nombre', v_doc.razonsocialcompradordoc),
    'moneda', v_doc.monedoc, 'pedido', v_doc.pedidocabecera,
    'totales', jsonb_build_object('valorVenta', v_doc.valorventadeclarado, 'impuestos', v_doc.impuestosdeclarados,
      'total', v_doc.totalapagar, 'gratuitas', v_doc.totaloperacionesgratuitas),
    'advertencias', coalesce(to_jsonb(v_doc.advertencias), '[]'::jsonb),
    'rutaXml', coalesce(v_doc.rutaxml, v_rec.rutaxml), 'rutaPdf', coalesce(v_doc.rutapdf, v_rec.rutapdf),
    'pdfPendiente', coalesce(v_doc.rutapdf, v_rec.rutapdf) IS NULL,
    'lineas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'numero', l.numlinea, 'codigo', l.codext, 'descripcion', l.deslin, 'cantidad', l.canlin,
        'clasificacion', l.claext, 'estado', l.estlin, 'motivo', l.motlin, 'pedido', l.pedidocrosland, 'valor', l.valorlin,
        'gratuita', l.esoperaciongratuita,
        'motos', coalesce((SELECT jsonb_agg(jsonb_build_object(
            'orden', v.ordveh, 'motor', v.motororiginal, 'chasis', v.chasisoriginal, 'vin', v.vinoriginal, 'color', v.colororiginal,
            'anio', v.anomodelo, 'estado', v.estvehdoc, 'motivo', v.motvehdoc, 'coduni', v.coduni::text,
            'modelo', m.nommod, 'ubicacion', ub.nomubi) ORDER BY v.ordveh)
          FROM public.vehiculodocumento v
          LEFT JOIN public.unidad u ON u.coduni = v.coduni
          LEFT JOIN public.modelo m ON m.codmod = u.codmod
          LEFT JOIN public.ubicacion ub ON ub.codubi = u.codubi
          WHERE v.codlin = l.codlin), '[]'::jsonb))
        ORDER BY CASE WHEN l.numlinea ~ '^[0-9]+$' THEN l.numlinea::bigint END, l.numlinea)
      FROM public.lineadocumentocompra l WHERE l.coddoc = v_doc.coddoc), '[]'::jsonb),
    'compras', coalesce((SELECT jsonb_agg(jsonb_build_object('codcom', c.codcom::text, 'modelo', m.nommod, 'color', c.colcom,
        'cantidad', c.cancom, 'estado', c.estcom, 'vinculo', dc.tipvinculo) ORDER BY c.codcom)
      FROM public.documentocompracompra dc JOIN public.compra c ON c.codcom = dc.codcom LEFT JOIN public.modelo m ON m.codmod = c.codmod
      WHERE dc.coddoc = v_doc.coddoc), '[]'::jsonb),
    'intentos', coalesce((SELECT jsonb_agg(jsonb_build_object('inicio', i.fecinicio, 'fin', i.fecfin, 'resultado', i.resint,
        'error', i.coderrint, 'actor', CASE WHEN i.tipactor = 'Usuario' THEN public.epsa_nombre_usuario(i.codusu) ELSE 'Proceso automático (correo)' END,
        'lineas', i.cantlineas, 'motos', i.cantvehiculos, 'ingresadas', i.cantprocesados, 'revision', i.cantrevision) ORDER BY i.codint DESC)
      FROM public.intentodocumento i WHERE i.coddoc = v_doc.coddoc), '[]'::jsonb));
END;
$$;

-- Cada correo recibido con su estado (como las etiquetas que el proceso pone en Gmail)
CREATE OR REPLACE FUNCTION public.hu030_correos_listar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  PERFORM public.hu030_exigir_gestion();
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'codrec', r.codrec::text, 'recibido', r.fecprimerarec, 'actualizado', r.fecactualizacion,
      'estado', CASE
        WHEN r.estrec = 'Error' THEN 'Error'
        WHEN r.estrec = 'Procesando' THEN 'Pendiente'
        WHEN d.estdoc IN ('Importado parcialmente', 'Pendiente de revision', 'Pendiente de revisión', 'Error') THEN 'En revisión'
        ELSE 'Procesado' END,
      'error', r.coderrrec, 'pdf', r.rutapdf IS NOT NULL, 'xml', r.rutaxml IS NOT NULL,
      'coddoc', d.coddoc::text, 'factura', d.iddoc, 'estadoFactura', d.estdoc,
      'revisiones', (SELECT count(*) FROM public.intentointegracionfactura i WHERE i.codrec = r.codrec),
      'motos', coalesce((r.resumen->'conteos'->>'importados')::integer, 0))
      ORDER BY r.fecprimerarec DESC)
    FROM (SELECT * FROM public.recepcionintegracionfactura ORDER BY fecprimerarec DESC LIMIT 100) r
    LEFT JOIN public.documentocompra d ON d.coddoc = r.coddoc
  ), '[]'::jsonb);
END;
$$;

-- =====================================================================
-- 4. HU-033 · Preparación de todas las motos en una consulta
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hu033_preparacion_listar()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora', 'Vendedor') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Perfil no autorizado';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(public.hu033_proyectar_preparacion_unidad(u.coduni)
      || jsonb_build_object('proveedorTecho', pr.nompro, 'detalleTecho', u.dettecuni) ORDER BY u.coduni)
    FROM public.unidad u
    JOIN public.preparacionunidad p ON p.coduni = u.coduni
    LEFT JOIN public.proveedor pr ON pr.codpro = u.codpro
  ), '[]'::jsonb);
END;
$$;

-- =====================================================================
-- 5. HU-001 · Poner a la venta una moto lista para entrega (o retirarla)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.hu001_cambiar_situacion_comercial(p_coduni bigint, p_situacion text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE v_actual text;
BEGIN
  IF coalesce(public.hu026_rol_actual(), '') NOT IN ('Gerente', 'Administradora') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Solo gerencia y administración ponen motos a la venta.';
  END IF;
  IF p_situacion IS NULL OR p_situacion NOT IN ('Disponible', 'No disponible') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT400', MESSAGE = 'Situación no válida.';
  END IF;
  SELECT estcomuni INTO v_actual FROM public.unidad WHERE coduni = p_coduni FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'PT404', MESSAGE = 'Esa moto no existe.';
  END IF;
  IF v_actual NOT IN ('Disponible', 'No disponible') THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = format('La moto está %s: no se cambia desde aquí.', lower(v_actual));
  END IF;
  IF p_situacion = 'Disponible' AND NOT coalesce((public.hu033_proyectar_preparacion_unidad(p_coduni)->>'preparacionCompleta')::boolean, false) THEN
    RAISE EXCEPTION USING ERRCODE = 'PT409', MESSAGE = 'Todavía no está lista para entrega: termina su armado y su techo en Preparación.';
  END IF;
  UPDATE public.unidad SET estcomuni = p_situacion WHERE coduni = p_coduni AND estcomuni IS DISTINCT FROM p_situacion;
  RETURN jsonb_build_object('coduni', p_coduni::text, 'situacion', p_situacion);
END;
$$;

-- =====================================================================
-- Permisos: solo usuarios con sesión (cada función revisa el rol)
-- =====================================================================
REVOKE ALL ON FUNCTION public.hu034_exigir_gestion(), public.hu034_proveedores_compra(), public.hu034_guardar_pedido(bigint, text),
  public.hu034_registrar_carrito(bigint, jsonb, uuid), public.hu034_compras_listar(), public.hu034_compra_extra(bigint),
  public.hu012_eliminar_modelo(bigint), public.hu030_documentos_listar(), public.hu030_documento_detalle(bigint),
  public.hu030_correos_listar(), public.hu033_preparacion_listar(), public.hu001_cambiar_situacion_comercial(bigint, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.hu034_proveedores_compra(), public.hu034_guardar_pedido(bigint, text),
  public.hu034_registrar_carrito(bigint, jsonb, uuid), public.hu034_compras_listar(), public.hu034_compra_extra(bigint),
  public.hu012_eliminar_modelo(bigint), public.hu030_documentos_listar(), public.hu030_documento_detalle(bigint),
  public.hu030_correos_listar(), public.hu033_preparacion_listar(), public.hu001_cambiar_situacion_comercial(bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.hu034_exigir_gestion() FROM authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Comprobación: debe salir una fila con 12 funciones y las 2 columnas nuevas
SELECT
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN ('hu034_exigir_gestion', 'hu034_proveedores_compra', 'hu034_guardar_pedido',
     'hu034_registrar_carrito', 'hu034_compras_listar', 'hu034_compra_extra', 'hu012_eliminar_modelo',
     'hu030_documentos_listar', 'hu030_documento_detalle', 'hu030_correos_listar', 'hu033_preparacion_listar',
     'hu001_cambiar_situacion_comercial')) AS funciones,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'compra'
   AND column_name IN ('codpro', 'grupocom')) AS columnas_nuevas;
