BEGIN;

-- La FK de usuario.uuidusu exige una identidad Auth preprovisionada.
-- Esta migración solo la consulta; nunca crea ni modifica auth.users.
DO $actor_tecnico$
DECLARE
  v_email constant text := 'integracion.facturas@epsa.internal';
  v_auth_id uuid;
  v_auth_count integer;
  v_rol bigint;
  v_usuario public.usuario%ROWTYPE;
  v_usuario_count integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='auth' AND table_name='users' AND column_name='email') THEN
    RAISE EXCEPTION USING MESSAGE='ACTOR_TECNICO_AUTH_NO_PROVISIONADO';
  END IF;
  SELECT count(*)::integer INTO v_auth_count FROM auth.users WHERE lower(email)=lower(v_email);
  IF v_auth_count<>1 THEN
    RAISE EXCEPTION USING MESSAGE='ACTOR_TECNICO_AUTH_NO_PROVISIONADO';
  END IF;
  SELECT id INTO v_auth_id FROM auth.users WHERE lower(email)=lower(v_email);

  SELECT codrol INTO v_rol FROM public.rol WHERE nomrol='Administradora' AND estrol=true;
  IF v_rol IS NULL THEN RAISE EXCEPTION 'No existe un rol Administradora activo para la identidad técnica'; END IF;
  SELECT count(*)::integer INTO v_usuario_count FROM public.usuario WHERE uuidusu=v_auth_id OR lower(corusu)=lower(v_email);
  IF v_usuario_count>1 THEN RAISE EXCEPTION 'La identidad técnica coincide con más de un usuario'; END IF;
  SELECT * INTO v_usuario FROM public.usuario WHERE uuidusu=v_auth_id OR lower(corusu)=lower(v_email) FOR UPDATE;
  IF FOUND THEN
    IF v_usuario.uuidusu<>v_auth_id OR lower(v_usuario.corusu)<>lower(v_email)
       OR v_usuario.nomusu<>'Integracion' OR v_usuario.apepatusu<>'Facturas'
       OR v_usuario.codrol<>v_rol OR v_usuario.estusu IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'La identidad técnica existente no coincide con la configuración esperada';
    END IF;
  ELSE
    INSERT INTO public.usuario(uuidusu,codrol,nomusu,apepatusu,corusu,estusu)
    VALUES (v_auth_id,v_rol,'Integracion','Facturas',v_email,true);
  END IF;
END
$actor_tecnico$;

CREATE OR REPLACE FUNCTION public.listar_equivalencias_importacion(p_ruc_emisor text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_codpro bigint; v_resultado jsonb;
BEGIN
  IF coalesce(public.hu026_rol_actual(),'') NOT IN ('Gerente','Administradora') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Perfil no autorizado';
  END IF;
  IF p_ruc_emisor IS NULL OR p_ruc_emisor !~ '^[0-9]{11}$' THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='RUC emisor inválido';
  END IF;
  SELECT codpro INTO v_codpro FROM public.proveedor WHERE rucpro=p_ruc_emisor AND estpro=true;
  IF v_codpro IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Proveedor no autorizado'; END IF;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'codigoExterno',e.codext,'clasificacion',e.claequ,'codmod',e.codmod::text,
    'activa',e.estequ,'nombreModelo',m.nommod
  ) ORDER BY upper(btrim(e.codext)),e.codequ),'[]'::jsonb)
  INTO v_resultado
  FROM public.equivalenciaproducto e
  LEFT JOIN public.modelo m ON m.codmod=e.codmod
  WHERE e.codpro=v_codpro AND e.estequ=true;
  RETURN v_resultado;
END
$$;

CREATE OR REPLACE FUNCTION public.importar_documento_compra(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_doc jsonb;
  v_lineas_json jsonb;
  v_linea jsonb;
  v_vehiculo jsonb;
  v_elemento record;
  v_lock bigint;
  v_codpro bigint;
  v_coddoc bigint;
  v_codint bigint;
  v_codlin bigint;
  v_codequ bigint;
  v_codmod bigint;
  v_codcom bigint;
  v_coduni bigint;
  v_codubi bigint;
  v_codusu bigint;
  v_coddoc_existente bigint;
  v_checksum text;
  v_checksum_existente text;
  v_conflicto boolean := false;
  v_reintento boolean := false;
  v_fallo boolean := false;
  v_estado_original text;
  v_fecha date;
  v_vencimiento date;
  v_color text;
  v_motor text;
  v_chasis text;
  v_pedido text;
  v_pedido_norm text;
  v_numero text;
  v_emisor text;
  v_tipvinculo text;
  v_match_count integer;
  v_match_codcom bigint;
  v_existentes bigint;
  v_revision integer := 0;
  v_vehiculos integer := 0;
  v_procesados integer := 0;
  v_lineas integer := 0;
  v_resultado_intento text;
  v_estado_doc text;
  v_advertencias jsonb;
  v_compras jsonb;
  v_unidades jsonb;
  v_lineas_revision jsonb;
  v_grupo record;
BEGIN
  IF coalesce(public.hu026_rol_actual(),'') NOT IN ('Gerente','Administradora') THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='Perfil no autorizado';
  END IF;
  IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_payload->'documento') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_payload->'lineas') IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_payload->'advertencias') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Estructura de importación inválida';
  END IF;
  v_doc:=p_payload->'documento';
  v_lineas_json:=p_payload->'lineas';
  v_lineas:=jsonb_array_length(v_lineas_json);
  SELECT coalesce(sum(jsonb_array_length(value->'vehiculos')),0)::integer INTO v_vehiculos
    FROM jsonb_array_elements(v_lineas_json) AS x(value);
  v_checksum:=lower(p_payload->>'checksumXml');
  IF jsonb_typeof(v_doc->'totales') IS DISTINCT FROM 'object'
     OR jsonb_typeof(v_doc->'firmaPresente') IS DISTINCT FROM 'boolean' THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Metadatos documentales inválidos';
  END IF;
  IF coalesce(v_doc->>'tipoDocumento','')='' OR coalesce(v_doc->>'serie','')=''
     OR coalesce(v_doc->>'numero','')='' OR coalesce(v_doc->>'idDocumento','')=''
     OR coalesce(v_doc->>'rucEmisor','') !~ '^[0-9]{11}$'
     OR coalesce(v_doc->>'rucComprador','') !~ '^[0-9]{11}$'
     OR coalesce(v_doc->>'moneda','')=''
     OR coalesce(v_doc->>'fechaEmision','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     OR char_length(v_doc->>'tipoDocumento')>10 OR char_length(v_doc->>'idDocumento')>120
     OR char_length(v_doc->>'serie')>40 OR char_length(v_doc->>'numero')>40
     OR char_length(coalesce(v_doc->>'moneda',''))>3
     OR char_length(coalesce(v_doc->>'ublVersion',''))>20
     OR char_length(coalesce(v_doc->>'razonSocialEmisor',''))>250
     OR char_length(coalesce(v_doc->>'razonSocialComprador',''))>250
     OR char_length(coalesce(v_doc->>'pedidoCabecera',''))>150
     OR (v_doc->>'idDocumento')<>((v_doc->>'serie')||'-'||(v_doc->>'numero'))
     OR v_checksum !~ '^[0-9a-f]{64}$' OR jsonb_array_length(v_lineas_json)=0 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Identidad documental inválida';
  END IF;
  IF v_doc->>'tipoDocumento'<>'01' OR v_doc->>'moneda'<>'PEN'
     OR v_doc->>'rucComprador'<>'20555595469'
     OR coalesce(v_doc->>'cantidadLineasDeclarada','') !~ '^[0-9]{1,6}$' THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Datos fiscales del documento inválidos';
  END IF;
  IF (v_doc->>'cantidadLineasDeclarada')::integer<>v_lineas THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Cantidad de líneas declarada discrepante';
  END IF;
  BEGIN v_fecha:=(v_doc->>'fechaEmision')::date;
  EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Fecha de emisión inválida'; END;
  IF coalesce(v_doc->>'fechaVencimiento','')<>'' THEN
    IF (v_doc->>'fechaVencimiento') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Fecha de vencimiento inválida';
    END IF;
    BEGIN v_vencimiento:=(v_doc->>'fechaVencimiento')::date;
    EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Fecha de vencimiento inválida'; END;
  END IF;
  IF EXISTS (SELECT 1 FROM (VALUES
      (v_doc#>>'{totales,valorVentaDeclarado}'),(v_doc#>>'{totales,impuestos}'),
      (v_doc#>>'{totales,totalAntesImpuestos}'),(v_doc#>>'{totales,totalIncluidosImpuestos}'),
      (v_doc#>>'{totales,totalPagar}'),(v_doc#>>'{totales,totalOperacionesGratuitasDeclarado}')
    ) totals(valor) WHERE nullif(valor,'') IS NOT NULL AND valor !~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$') THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Totales documentales inválidos';
  END IF;
  IF p_payload->>'origen' IS NOT NULL AND char_length(p_payload->>'origen')>80 THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Origen inválido';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lineas_json) x(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
       OR coalesce(value->>'numeroLinea','')=''
       OR char_length(value->>'numeroLinea')>100
       OR char_length(coalesce(value->>'codigoExterno',''))>120
       OR char_length(coalesce(value->>'unidadMedida',''))>30
       OR char_length(coalesce(value->>'pedidoLinea',''))>100
       OR char_length(coalesce(value->>'clasificacionUnspc',''))>30
       OR char_length(coalesce(value->>'priceTypeCode',''))>10
       OR char_length(coalesce(value->>'taxExemptionReasonCode',''))>10
       OR char_length(coalesce(value->>'taxScheme',''))>20
       OR jsonb_typeof(value->'propiedadesOriginales') IS DISTINCT FROM 'array'
       OR jsonb_typeof(value->'additionalInformation') IS DISTINCT FROM 'array'
       OR jsonb_typeof(value->'vehiculos') IS DISTINCT FROM 'array'
       OR jsonb_typeof(value->'operacionGratuita') IS DISTINCT FROM 'boolean') THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Línea documental inválida';
  END IF;
  IF jsonb_array_length(p_payload->'advertencias')>100 OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_payload->'advertencias') AS x(value)
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'string' OR value #>> '{}' !~ '^[A-Z0-9_]{1,100}$'
  ) THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Advertencias documentales inválidas';
  END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(v_lineas_json) x(value)
    CROSS JOIN LATERAL (VALUES
      (value->>'cantidad'),(value->>'valorLinea'),(value->>'precioUnitario'),
      (value->>'precioReferencial'),(value->>'valorOperacionGratuita')) n(valor)
    WHERE nullif(n.valor,'') IS NOT NULL AND n.valor !~ '^-?[0-9]{1,12}(\.[0-9]{1,6})?$') THEN
    RAISE EXCEPTION USING ERRCODE='PT400', MESSAGE='Monto o cantidad inválidos';
  END IF;
  SELECT codpro INTO v_codpro FROM public.proveedor WHERE rucpro=v_doc->>'rucEmisor' AND estpro=true;
  IF v_codpro IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='Proveedor no autorizado'; END IF;
  -- Actor de auditoría; la autorización sigue dependiendo exclusivamente de
  -- hu026_rol_actual() y no de esta identidad técnica.
  SELECT u.codusu INTO v_codusu FROM public.usuario u JOIN public.rol r ON r.codrol=u.codrol
  WHERE lower(u.corusu)='integracion.facturas@epsa.internal' AND u.estusu=true
    AND r.nomrol='Administradora' AND r.estrol=true;
  IF v_codusu IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT500', MESSAGE='Actor técnico no disponible'; END IF;

  -- Serializa la identidad documental antes del SELECT/INSERT; el índice único es defensa adicional.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_codpro::text||':'||(v_doc->>'tipoDocumento')||':'||(v_doc->>'serie')||':'||(v_doc->>'numero'), 3030));
  SELECT coddoc,sha256xml,estdoc INTO v_coddoc_existente,v_checksum_existente,v_estado_original
  FROM public.documentocompra
  WHERE codpro=v_codpro AND tipdoc=v_doc->>'tipoDocumento' AND serdoc=v_doc->>'serie' AND numdoc=v_doc->>'numero'
  FOR UPDATE;
  v_checksum:=lower(p_payload->>'checksumXml');
  IF v_coddoc_existente IS NULL THEN
    INSERT INTO public.documentocompra(
      codpro,tipdoc,iddoc,serdoc,numdoc,fecemidoc,fecvencdoc,monedoc,rucemisordoc,
      razonsocialemisordoc,ruccompradordoc,razonsocialcompradordoc,estdoc,sha256xml,
      origendoc,cuentaoperativa,versionubl,pedidocabecera,valorventadeclarado,
      impuestosdeclarados,totalantesimpuestos,totalincluidoimpuestos,totalapagar,
      totaloperacionesgratuitas,firmapresente,advertencias
    ) VALUES (
      v_codpro,v_doc->>'tipoDocumento',v_doc->>'idDocumento',v_doc->>'serie',v_doc->>'numero',v_fecha,
      v_vencimiento,v_doc->>'moneda',v_doc->>'rucEmisor',
      left(v_doc->>'razonSocialEmisor',250),v_doc->>'rucComprador',left(v_doc->>'razonSocialComprador',250),
      'Procesando',v_checksum,coalesce(nullif(p_payload->>'origen',''),'XML_Interno'),NULL,
      v_doc->>'ublVersion',left(v_doc->>'pedidoCabecera',150),
      nullif(v_doc#>>'{totales,valorVentaDeclarado}','')::numeric,
      nullif(v_doc#>>'{totales,impuestos}','')::numeric,
      nullif(v_doc#>>'{totales,totalAntesImpuestos}','')::numeric,
      nullif(v_doc#>>'{totales,totalIncluidosImpuestos}','')::numeric,
      nullif(v_doc#>>'{totales,totalPagar}','')::numeric,
      nullif(v_doc#>>'{totales,totalOperacionesGratuitasDeclarado}','')::numeric,
      coalesce((v_doc->>'firmaPresente')::boolean,false),p_payload->'advertencias'
    ) RETURNING coddoc INTO v_coddoc;
    v_estado_original:='Recibido';
  ELSE
    v_coddoc:=v_coddoc_existente;
    v_reintento:=lower(coalesce(v_checksum_existente,''))=v_checksum;
  END IF;
  UPDATE public.documentocompra SET numintento=numintento+1,fecprimerproc=coalesce(fecprimerproc,now()),fecultimoint=now()
    WHERE coddoc=v_coddoc;
  INSERT INTO public.intentodocumento(coddoc,tipactor,codusu,resint,fecfin,cantlineas,cantvehiculos,cantprocesados,cantrevision)
    VALUES(v_coddoc,'Automatico',v_codusu,'Procesando',NULL,v_lineas,v_vehiculos,0,0)
    RETURNING codint INTO v_codint;

  IF v_coddoc_existente IS NOT NULL AND lower(coalesce(v_checksum_existente,''))<>v_checksum THEN
    v_conflicto:=true;
    UPDATE public.documentocompra SET estdoc='Pendiente de revision',coderrdoc='DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO',
      motdoc='La misma identidad documental llegó con otro checksum; se conserva el contenido original.' WHERE coddoc=v_coddoc;
  ELSE
    BEGIN
      -- Verifica clave semántica y ubicación en cada llamada, y bloquea su fila frente a cambios administrativos.
      SELECT u.codubi INTO v_codubi FROM public.ubicacionclave k JOIN public.ubicacion u ON u.codubi=k.codubi
      WHERE k.claubi='ALMACEN_CROSLAND_ANCON' AND k.estucl=true AND u.estubi=true AND u.tipubi='Almacen'
      FOR SHARE OF k,u;
      IF v_codubi IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409', MESSAGE='Ubicación inicial no disponible'; END IF;

      v_lineas_json:=p_payload->'lineas';
      FOR v_linea IN SELECT value FROM jsonb_array_elements(v_lineas_json) AS x(value) LOOP
        INSERT INTO public.lineadocumentocompra(
          coddoc,numlinea,codext,deslin,canlin,unimed,pedidocrosland,valorlin,
          claext,estlin,motlin,propsoriginales,additionalinformation,preciounitario,
          precioreferencial,codunspsc,esoperaciongratuita,valoroperaciongratuita,
          pricetypecode,taxexemptionreasoncode,taxschemeid
        ) VALUES (
          v_coddoc,v_linea->>'numeroLinea',left(v_linea->>'codigoExterno',120),v_linea->>'descripcion',
          nullif(v_linea->>'cantidad','')::numeric,left(v_linea->>'unidadMedida',30),left(v_linea->>'pedidoLinea',100),
          nullif(v_linea->>'valorLinea','')::numeric,'Desconocido','Pendiente',NULL,
          coalesce(v_linea->'propiedadesOriginales','[]'::jsonb),coalesce(v_linea->'additionalInformation','[]'::jsonb),
          nullif(v_linea->>'precioUnitario','')::numeric,nullif(v_linea->>'precioReferencial','')::numeric,
          left(v_linea->>'clasificacionUnspc',30),coalesce((v_linea->>'operacionGratuita')::boolean,false),
          nullif(v_linea->>'valorOperacionGratuita','')::numeric,left(v_linea->>'priceTypeCode',10),
          left(v_linea->>'taxExemptionReasonCode',10),left(v_linea->>'taxScheme',20)
        ) ON CONFLICT (coddoc,numlinea) DO UPDATE SET
          codext=EXCLUDED.codext,deslin=EXCLUDED.deslin,canlin=EXCLUDED.canlin,unimed=EXCLUDED.unimed,
          pedidocrosland=EXCLUDED.pedidocrosland,valorlin=EXCLUDED.valorlin,
          propsoriginales=EXCLUDED.propsoriginales,additionalinformation=EXCLUDED.additionalinformation,
          preciounitario=EXCLUDED.preciounitario,precioreferencial=EXCLUDED.precioreferencial,
          codunspsc=EXCLUDED.codunspsc,esoperaciongratuita=EXCLUDED.esoperaciongratuita,
          valoroperaciongratuita=EXCLUDED.valoroperaciongratuita,pricetypecode=EXCLUDED.pricetypecode,
          taxexemptionreasoncode=EXCLUDED.taxexemptionreasoncode,taxschemeid=EXCLUDED.taxschemeid
        RETURNING codlin INTO v_codlin;

        SELECT count(*),min(e.codequ),min(e.codmod) INTO v_match_count,v_codequ,v_codmod
        FROM public.equivalenciaproducto e
        WHERE e.codpro=v_codpro AND e.estequ=true AND upper(btrim(e.codext))=upper(btrim(coalesce(v_linea->>'codigoExterno','')));
        IF (SELECT estlin FROM public.lineadocumentocompra WHERE codlin=v_codlin)='Procesada'
           AND EXISTS(SELECT 1 FROM public.vehiculodocumento WHERE codlin=v_codlin AND coduni IS NOT NULL) THEN
          CONTINUE;
        END IF;
        IF v_match_count=0 THEN
          UPDATE public.lineadocumentocompra SET claext='Desconocido',codequ=NULL,estlin='Revision',motlin='CODIGO_SIN_EQUIVALENCIA',fecprocesamiento=now() WHERE codlin=v_codlin;
          CONTINUE;
        ELSIF v_match_count>1 THEN
          UPDATE public.lineadocumentocompra SET claext='Desconocido',codequ=NULL,estlin='Revision',motlin='EQUIVALENCIA_AMBIGUA',fecprocesamiento=now() WHERE codlin=v_codlin;
          CONTINUE;
        END IF;
        SELECT e.claequ,e.codmod INTO v_elemento FROM public.equivalenciaproducto e WHERE e.codequ=v_codequ;
        UPDATE public.lineadocumentocompra SET codequ=v_codequ,claext=v_elemento.claequ WHERE codlin=v_codlin;
        IF v_elemento.claequ='Accesorio' THEN
          UPDATE public.lineadocumentocompra SET estlin='Procesada',motlin=NULL,fecprocesamiento=now() WHERE codlin=v_codlin;
          CONTINUE;
        END IF;
        IF v_elemento.codmod IS NULL THEN
          UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='EQUIVALENCIA_MODELO_AUSENTE',fecprocesamiento=now() WHERE codlin=v_codlin;
          CONTINUE;
        END IF;
        IF jsonb_array_length(v_linea->'vehiculos')=0 THEN
          UPDATE public.lineadocumentocompra SET estlin='Revision',
            motlin=CASE WHEN coalesce(v_linea->>'motivo','') ~ '^[A-Z0-9_]{1,80}$' THEN v_linea->>'motivo' ELSE 'CANDIDATO_VEHICULO_AUSENTE' END,
            fecprocesamiento=now() WHERE codlin=v_codlin;
          CONTINUE;
        END IF;
        FOR v_vehiculo IN SELECT value FROM jsonb_array_elements(v_linea->'vehiculos') AS x(value) LOOP
          v_color:=nullif(btrim(regexp_replace(coalesce(v_vehiculo->>'color',''),'[[:space:]]+',' ','g')),'');
          v_motor:=nullif(btrim(regexp_replace(coalesce(v_vehiculo->>'motor',''),'[[:space:]]+',' ','g')),'');
          v_chasis:=nullif(btrim(regexp_replace(coalesce(v_vehiculo->>'chasis',''),'[[:space:]]+',' ','g')),'');
          IF coalesce(v_linea->>'estado','')<>'Candidato' OR coalesce(v_vehiculo->>'linea','')<>v_linea->>'numeroLinea'
             OR coalesce(v_vehiculo->>'codigoExterno','')<>coalesce(v_linea->>'codigoExterno','')
             OR v_color IS NULL OR v_motor IS NULL OR v_chasis IS NULL
             OR char_length(v_color)>50 OR char_length(v_motor)>100 OR char_length(v_chasis)>100
             OR (nullif(v_vehiculo->>'anioFabricacion','') IS NOT NULL AND (v_vehiculo->>'anioFabricacion') !~ '^[0-9]{4}$')
             OR (nullif(v_vehiculo->>'anioModelo','') IS NOT NULL AND (v_vehiculo->>'anioModelo') !~ '^[0-9]{4}$') THEN
            INSERT INTO public.vehiculodocumento(codlin,ordveh,motororiginal,vinoriginal,chasisoriginal,colororiginal,
              anofabricacion,anomodelo,pedidocrosland,propsoriginales,estvehdoc,motvehdoc)
            VALUES(v_codlin,coalesce((SELECT max(ordveh)+1 FROM public.vehiculodocumento WHERE codlin=v_codlin),1),
              left(v_vehiculo->>'motor',120),left(v_vehiculo->>'vin',120),left(v_vehiculo->>'chasis',120),left(v_vehiculo->>'color',100),
              nullif(v_vehiculo->>'anioFabricacion','')::smallint,nullif(v_vehiculo->>'anioModelo','')::smallint,
              left(v_vehiculo->>'pedido',100),v_vehiculo,'Revision',
              CASE WHEN coalesce(v_linea->>'motivo','') ~ '^[A-Z0-9_]{1,80}$' THEN v_linea->>'motivo' ELSE 'CANDIDATO_INVALIDO' END)
            ON CONFLICT(codlin,ordveh) DO UPDATE SET estvehdoc='Revision',motvehdoc=EXCLUDED.motvehdoc
              WHERE public.vehiculodocumento.coduni IS NULL;
          ELSE
            INSERT INTO public.vehiculodocumento(codlin,ordveh,motororiginal,vinoriginal,chasisoriginal,colororiginal,
              anofabricacion,anomodelo,pedidocrosland,propsoriginales,estvehdoc,motvehdoc)
            VALUES(v_codlin,coalesce((SELECT max(ordveh)+1 FROM public.vehiculodocumento WHERE codlin=v_codlin),1),
              v_motor,left(v_vehiculo->>'vin',120),v_chasis,v_color,
              nullif(v_vehiculo->>'anioFabricacion','')::smallint,nullif(v_vehiculo->>'anioModelo','')::smallint,
              left(v_vehiculo->>'pedido',100),v_vehiculo,'Candidato',NULL)
            ON CONFLICT(codlin,ordveh) DO UPDATE SET
              motororiginal=EXCLUDED.motororiginal,vinoriginal=EXCLUDED.vinoriginal,chasisoriginal=EXCLUDED.chasisoriginal,
              colororiginal=EXCLUDED.colororiginal,anofabricacion=EXCLUDED.anofabricacion,anomodelo=EXCLUDED.anomodelo,
              pedidocrosland=EXCLUDED.pedidocrosland,propsoriginales=EXCLUDED.propsoriginales
              WHERE public.vehiculodocumento.coduni IS NULL;
          END IF;
        END LOOP;
      END LOOP;

      -- Serializa por número normalizado, con el mismo namespace de locks que HU-002.
      FOR v_lock IN
        SELECT DISTINCT k FROM (
          SELECT pg_catalog.hashtextextended('motor:'||public.hu002_normalizar(v.motororiginal),2) k
            FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
            WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato'
          UNION ALL
          SELECT pg_catalog.hashtextextended('chasis:'||public.hu002_normalizar(v.chasisoriginal),2) k
            FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
            WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato'
        ) locks ORDER BY k
      LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_lock); END LOOP;

      -- Duplicados dentro del mismo documento se dejan todos en revisión antes de crear unidades.
      UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='MOTOR_DUPLICADO_EN_DOCUMENTO'
      FROM public.lineadocumentocompra l
      WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND v.estvehdoc='Candidato'
        AND public.hu002_normalizar(v.motororiginal) IN (
          SELECT public.hu002_normalizar(v2.motororiginal) FROM public.vehiculodocumento v2
          JOIN public.lineadocumentocompra l2 USING(codlin)
          WHERE l2.coddoc=v_coddoc AND v2.estvehdoc='Candidato'
          GROUP BY public.hu002_normalizar(v2.motororiginal) HAVING count(*)>1);
      UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='CHASIS_DUPLICADO_EN_DOCUMENTO'
      FROM public.lineadocumentocompra l
      WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND v.estvehdoc='Candidato'
        AND public.hu002_normalizar(v.chasisoriginal) IN (
          SELECT public.hu002_normalizar(v2.chasisoriginal) FROM public.vehiculodocumento v2
          JOIN public.lineadocumentocompra l2 USING(codlin)
          WHERE l2.coddoc=v_coddoc AND v2.estvehdoc='Candidato'
          GROUP BY public.hu002_normalizar(v2.chasisoriginal) HAVING count(*)>1);
      UPDATE public.lineadocumentocompra l SET estlin='Revision',motlin=v.motvehdoc
      FROM public.vehiculodocumento v WHERE v.codlin=l.codlin AND l.coddoc=v_coddoc AND v.estvehdoc='Revision';

      -- Series que ya pertenecen a otra unidad no se vuelven a registrar.
      FOR v_elemento IN
        SELECT v.codvehdoc,v.codlin,v.motororiginal,v.chasisoriginal,v.coduni
        FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
        WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato' AND v.coduni IS NULL
        ORDER BY v.codvehdoc
      LOOP
        SELECT coduni INTO v_coduni FROM public.unidad
        WHERE public.hu002_normalizar(nummotuni)=public.hu002_normalizar(v_elemento.motororiginal)
        LIMIT 1;
        IF v_coduni IS NOT NULL THEN
          UPDATE public.vehiculodocumento SET estvehdoc='Revision',motvehdoc='MOTOR_YA_REGISTRADO' WHERE codvehdoc=v_elemento.codvehdoc;
          UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='MOTOR_YA_REGISTRADO' WHERE codlin=v_elemento.codlin;
          v_coduni:=NULL;
          CONTINUE;
        END IF;
        SELECT coduni INTO v_coduni FROM public.unidad
        WHERE public.hu002_normalizar(chauni)=public.hu002_normalizar(v_elemento.chasisoriginal)
        LIMIT 1;
        IF v_coduni IS NOT NULL THEN
          UPDATE public.vehiculodocumento SET estvehdoc='Revision',motvehdoc='CHASIS_YA_REGISTRADO' WHERE codvehdoc=v_elemento.codvehdoc;
          UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CHASIS_YA_REGISTRADO' WHERE codlin=v_elemento.codlin;
          v_coduni:=NULL;
        END IF;
      END LOOP;

      -- Bloquea los pedidos exactos antes de conciliarlos o registrarlos.
      FOR v_lock IN
        SELECT DISTINCT pg_catalog.hashtextextended('PedidoCrosland:'||upper(btrim(regexp_replace(v.pedidocrosland,'[[:space:]]+',' ','g')))||':'||v_codpro::text,3030) k
        FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
        WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato' AND nullif(btrim(v.pedidocrosland),'') IS NOT NULL
        ORDER BY k
      LOOP PERFORM pg_catalog.pg_advisory_xact_lock(v_lock); END LOOP;

      -- Una agrupación que apunta a más de una compra manual no se divide ni se duplica automáticamente.
      FOR v_grupo IN
        SELECT e.codmod,initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g')))) color,
          count(DISTINCT r.codcom) compras
        FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
        JOIN public.equivalenciaproducto e ON e.codequ=l.codequ AND e.estequ
        LEFT JOIN public.referenciacompra r ON r.codpro=v_codpro AND r.tipref='PedidoCrosland' AND r.estref='Activa'
          AND upper(btrim(r.valrefnormalizado))=upper(btrim(regexp_replace(v.pedidocrosland,'[[:space:]]+',' ','g')))
        WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato'
        GROUP BY e.codmod,initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))
        HAVING count(DISTINCT r.codcom)>1
      LOOP
        UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='CONCILIACION_AMBIGUA'
        FROM public.lineadocumentocompra l JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
        WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
          AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color
          AND v.estvehdoc='Candidato';
        UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CONCILIACION_AMBIGUA'
        WHERE codlin IN (SELECT v.codlin FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
          JOIN public.equivalenciaproducto e ON e.codequ=l.codequ WHERE l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
          AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color);
      END LOOP;

      FOR v_grupo IN
        SELECT e.codmod,initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g')))) color,
          count(*)::integer cantidad
        FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
        JOIN public.equivalenciaproducto e ON e.codequ=l.codequ AND e.estequ
        WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato' AND v.coduni IS NULL
        GROUP BY e.codmod,initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))
        ORDER BY e.codmod,initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))
      LOOP
        v_codcom:=NULL; v_match_count:=0; v_match_codcom:=NULL;
        SELECT count(DISTINCT r.codcom),min(r.codcom) INTO v_match_count,v_match_codcom
        FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
        JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
        JOIN public.referenciacompra r ON r.codpro=v_codpro AND r.tipref='PedidoCrosland' AND r.estref='Activa'
          AND upper(btrim(r.valrefnormalizado))=upper(btrim(regexp_replace(v.pedidocrosland,'[[:space:]]+',' ','g')))
        WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato' AND e.codmod=v_grupo.codmod
          AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color;

        IF v_match_count>1 THEN
          UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='CONCILIACION_AMBIGUA'
          FROM public.lineadocumentocompra l JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
          WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
            AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color AND v.estvehdoc='Candidato';
          UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CONCILIACION_AMBIGUA'
            WHERE coddoc=v_coddoc AND codlin IN (SELECT v.codlin FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
              JOIN public.equivalenciaproducto e ON e.codequ=l.codequ WHERE l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
              AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color);
          CONTINUE;
        ELSIF v_match_count=1 THEN
          SELECT * INTO v_elemento FROM public.compra WHERE codcom=v_match_codcom FOR UPDATE;
          SELECT count(*) INTO v_existentes FROM public.unidad WHERE codcom=v_match_codcom;
          IF v_elemento.codmod<>v_grupo.codmod
             OR public.hu002_normalizar(v_elemento.colcom)<>public.hu002_normalizar(v_grupo.color)
             OR v_elemento.estcom NOT IN ('Pendiente de factura','Pendiente de identificación')
             OR v_elemento.cancom-v_existentes<v_grupo.cantidad
             OR (NOT EXISTS(SELECT 1 FROM public.factura_compra f WHERE f.codcom=v_match_codcom)
                 AND v_elemento.cancom<>v_grupo.cantidad) THEN
            UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='CONCILIACION_INCOMPATIBLE'
            FROM public.lineadocumentocompra l JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
            WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
              AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color AND v.estvehdoc='Candidato';
            UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CONCILIACION_INCOMPATIBLE'
              WHERE coddoc=v_coddoc AND codlin IN (SELECT v.codlin FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
                JOIN public.equivalenciaproducto e ON e.codequ=l.codequ WHERE l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
                AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color);
            CONTINUE;
          END IF;
          v_codcom:=v_match_codcom; v_tipvinculo:='Conciliado';
        ELSE
          INSERT INTO public.compra(codmod,codusu,colcom,feccom,cancom,estcom,obscom)
          VALUES(v_grupo.codmod,v_codusu,v_grupo.color,v_fecha,v_grupo.cantidad,'Pendiente de factura',
            'Importación automática desde documento '||left(v_doc->>'idDocumento',120))
          RETURNING codcom INTO v_codcom;
          v_tipvinculo:='Automatico';
        END IF;

        v_numero:=left(coalesce(nullif(v_doc->>'idDocumento',''),(v_doc->>'serie')||'-'||(v_doc->>'numero')),80);
        v_emisor:=left(coalesce(nullif(v_doc->>'razonSocialEmisor',''),v_doc->>'rucEmisor'),160);
        SELECT * INTO v_elemento FROM public.factura_compra WHERE codcom=v_codcom FOR UPDATE;
        IF FOUND THEN
          IF v_elemento.cantidad_motos<>(SELECT cancom FROM public.compra WHERE codcom=v_codcom) THEN
            UPDATE public.vehiculodocumento v SET estvehdoc='Revision',motvehdoc='CONCILIACION_INCOMPATIBLE'
            FROM public.lineadocumentocompra l JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
            WHERE l.codlin=v.codlin AND l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
              AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color AND v.estvehdoc='Candidato';
            UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CONCILIACION_INCOMPATIBLE'
              WHERE coddoc=v_coddoc AND codlin IN (SELECT v.codlin FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
                JOIN public.equivalenciaproducto e ON e.codequ=l.codequ WHERE l.coddoc=v_coddoc AND e.codmod=v_grupo.codmod
                AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color);
            CONTINUE;
          END IF;
        ELSE
          INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
          SELECT v_codcom,v_emisor,v_numero,v_fecha,c.cancom,v_codusu FROM public.compra c WHERE c.codcom=v_codcom;
        END IF;
        INSERT INTO public.documentocompracompra(coddoc,codcom,tipvinculo,codusucon)
        VALUES(v_coddoc,v_codcom,v_tipvinculo,NULL) ON CONFLICT(coddoc,codcom) DO NOTHING;

        FOR v_elemento IN
          SELECT v.* FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
          JOIN public.equivalenciaproducto e ON e.codequ=l.codequ
          WHERE l.coddoc=v_coddoc AND v.estvehdoc='Candidato' AND v.coduni IS NULL AND e.codmod=v_grupo.codmod
            AND initcap(lower(btrim(regexp_replace(v.colororiginal,'[[:space:]]+',' ','g'))))=v_grupo.color
          ORDER BY v.codvehdoc
        LOOP
          v_pedido:=nullif(btrim(regexp_replace(coalesce(v_elemento.pedidocrosland,''),'[[:space:]]+',' ','g')),'');
          IF v_pedido IS NOT NULL THEN
            v_pedido_norm:=upper(v_pedido);
            SELECT codcom INTO v_match_codcom FROM public.referenciacompra
            WHERE codpro=v_codpro AND tipref='PedidoCrosland' AND estref='Activa' AND upper(btrim(valrefnormalizado))=v_pedido_norm;
            IF v_match_codcom IS NOT NULL AND v_match_codcom<>v_codcom THEN
              UPDATE public.vehiculodocumento SET estvehdoc='Revision',motvehdoc='CONCILIACION_AMBIGUA' WHERE codvehdoc=v_elemento.codvehdoc;
              UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CONCILIACION_AMBIGUA' WHERE codlin=v_elemento.codlin;
              v_match_codcom:=NULL; CONTINUE;
            END IF;
            INSERT INTO public.referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
            VALUES(v_codcom,v_codpro,'PedidoCrosland',left(v_pedido,150),left(v_pedido_norm,150),v_codusu)
            ON CONFLICT DO NOTHING;
          END IF;
          v_motor:=public.hu002_normalizar(v_elemento.motororiginal);
          v_chasis:=public.hu002_normalizar(v_elemento.chasisoriginal);
          SELECT coduni INTO v_coduni FROM public.unidad WHERE public.hu002_normalizar(nummotuni)=v_motor OR public.hu002_normalizar(chauni)=v_chasis LIMIT 1;
          IF v_coduni IS NOT NULL THEN
            IF EXISTS(SELECT 1 FROM public.unidad WHERE coduni=v_coduni AND public.hu002_normalizar(nummotuni)=v_motor) THEN
              UPDATE public.vehiculodocumento SET estvehdoc='Revision',motvehdoc='MOTOR_YA_REGISTRADO' WHERE codvehdoc=v_elemento.codvehdoc;
              UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='MOTOR_YA_REGISTRADO' WHERE codlin=v_elemento.codlin;
            ELSE
              UPDATE public.vehiculodocumento SET estvehdoc='Revision',motvehdoc='CHASIS_YA_REGISTRADO' WHERE codvehdoc=v_elemento.codvehdoc;
              UPDATE public.lineadocumentocompra SET estlin='Revision',motlin='CHASIS_YA_REGISTRADO' WHERE codlin=v_elemento.codlin;
            END IF;
            v_coduni:=NULL; CONTINUE;
          END IF;
          INSERT INTO public.unidad(codcom,codmod,codubi,nummotuni,chauni,coluni)
          VALUES(v_codcom,v_grupo.codmod,v_codubi,v_motor,v_chasis,v_grupo.color) RETURNING coduni INTO v_coduni;
          UPDATE public.vehiculodocumento SET coduni=v_coduni,estvehdoc='Procesado',motvehdoc=NULL WHERE codvehdoc=v_elemento.codvehdoc;
        END LOOP;
      END LOOP;

      UPDATE public.lineadocumentocompra l SET
        estlin=CASE WHEN EXISTS(SELECT 1 FROM public.vehiculodocumento v WHERE v.codlin=l.codlin AND v.estvehdoc='Revision') THEN 'Revision'
          WHEN EXISTS(SELECT 1 FROM public.vehiculodocumento v WHERE v.codlin=l.codlin AND v.estvehdoc<>'Procesado') THEN 'Pendiente'
          ELSE 'Procesada' END,
        motlin=coalesce((SELECT v.motvehdoc FROM public.vehiculodocumento v WHERE v.codlin=l.codlin AND v.estvehdoc='Revision' ORDER BY v.ordveh LIMIT 1),l.motlin),
        fecprocesamiento=now()
      WHERE l.coddoc=v_coddoc AND l.claext='Vehiculo';
    EXCEPTION WHEN OTHERS THEN
      v_fallo:=true;
    END;
  END IF;

  SELECT count(*) INTO v_procesados FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
    WHERE l.coddoc=v_coddoc AND v.estvehdoc='Procesado';
  SELECT (SELECT count(*) FROM public.lineadocumentocompra WHERE coddoc=v_coddoc AND estlin IN ('Revision','Error','Pendiente'))
       + (SELECT count(*) FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
          WHERE l.coddoc=v_coddoc AND v.estvehdoc='Revision') INTO v_revision;
  IF v_conflicto THEN
    UPDATE public.intentodocumento SET resint='Error',fecfin=now(),coderrint='DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO',
      mensajesanitizado='La misma identidad documental llegó con otro contenido.',cantlineas=v_lineas,
      cantvehiculos=v_vehiculos,cantprocesados=v_procesados,cantrevision=v_revision WHERE codint=v_codint;
  ELSIF v_fallo THEN
    IF v_estado_original NOT IN ('Importado','Importado parcialmente') THEN
      UPDATE public.documentocompra SET estdoc='Error',coderrdoc='ERROR_TECNICO_IMPORTACION',motdoc='La importación falló; los cambios del intento fueron revertidos.' WHERE coddoc=v_coddoc;
    END IF;
    UPDATE public.intentodocumento SET resint='Error',fecfin=now(),coderrint='ERROR_TECNICO_IMPORTACION',
      mensajesanitizado='Error técnico durante la importación.',cantlineas=v_lineas,
      cantvehiculos=v_vehiculos,cantprocesados=v_procesados,cantrevision=v_revision WHERE codint=v_codint;
  ELSE
    SELECT count(*) INTO v_lineas FROM public.lineadocumentocompra WHERE coddoc=v_coddoc;
    IF v_conflicto THEN v_estado_doc:='Pendiente de revision'; v_resultado_intento:='Error';
    ELSIF v_fallo THEN v_estado_doc:=CASE WHEN v_estado_original IN ('Importado','Importado parcialmente') THEN v_estado_original ELSE 'Error' END; v_resultado_intento:='Error';
    ELSIF v_revision=0 THEN v_estado_doc:='Importado'; v_resultado_intento:='Exito';
    ELSIF v_procesados>0 OR EXISTS(SELECT 1 FROM public.lineadocumentocompra WHERE coddoc=v_coddoc AND estlin='Procesada' AND claext='Accesorio')
      THEN v_estado_doc:='Importado parcialmente'; v_resultado_intento:='Parcial';
    ELSE v_estado_doc:='Pendiente de revision'; v_resultado_intento:='Parcial';
    END IF;
    IF NOT v_fallo AND NOT v_conflicto THEN
      UPDATE public.documentocompra SET estdoc=v_estado_doc,coderrdoc=NULL,
        motdoc=CASE WHEN v_revision>0 THEN 'Quedan líneas o vehículos que requieren revisión.' ELSE NULL END
        WHERE coddoc=v_coddoc;
    END IF;
    UPDATE public.intentodocumento SET resint=v_resultado_intento,fecfin=now(),
      coderrint=CASE WHEN v_conflicto THEN 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO' WHEN v_fallo THEN 'ERROR_TECNICO_IMPORTACION' END,
      mensajesanitizado=CASE WHEN v_conflicto THEN 'La misma identidad documental llegó con otro contenido.' WHEN v_fallo THEN 'Error técnico durante la importación.' END,
      cantlineas=v_lineas,cantvehiculos=v_vehiculos,cantprocesados=v_procesados,cantrevision=v_revision
      WHERE codint=v_codint;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('codcom',c.codcom::text,'codmod',c.codmod::text,
    'color',c.colcom,'cantidad',(SELECT count(*)::integer FROM public.vehiculodocumento v
      JOIN public.lineadocumentocompra l USING(codlin) JOIN public.unidad u ON u.coduni=v.coduni
      WHERE l.coddoc=d.coddoc AND u.codcom=c.codcom),'tipoVinculo',d.tipvinculo) ORDER BY c.codcom),'[]'::jsonb)
    INTO v_compras FROM public.documentocompracompra d JOIN public.compra c USING(codcom) WHERE d.coddoc=v_coddoc;
  SELECT coalesce(jsonb_agg(jsonb_build_object('coduni',u.coduni::text,
    'motorEnmascarado',CASE WHEN char_length(u.nummotuni)<=7 THEN '***' ELSE left(u.nummotuni,3)||'***'||right(u.nummotuni,4) END,
    'chasisEnmascarado',CASE WHEN char_length(u.chauni)<=7 THEN '***' ELSE left(u.chauni,3)||'***'||right(u.chauni,4) END,
    'pedido',v.pedidocrosland) ORDER BY v.codvehdoc),'[]'::jsonb)
    INTO v_unidades FROM public.vehiculodocumento v JOIN public.lineadocumentocompra l USING(codlin)
    JOIN public.unidad u ON u.coduni=v.coduni WHERE l.coddoc=v_coddoc AND v.coduni IS NOT NULL;
  SELECT coalesce(jsonb_agg(jsonb_build_object('numeroLinea',l.numlinea,'codigo',l.codext,
    'motivo',coalesce(l.motlin,(SELECT v.motvehdoc FROM public.vehiculodocumento v
      WHERE v.codlin=l.codlin AND v.estvehdoc='Revision' ORDER BY v.ordveh LIMIT 1),'REVISION_REQUERIDA')) ORDER BY l.numlinea),'[]'::jsonb)
    INTO v_lineas_revision FROM public.lineadocumentocompra l
    WHERE l.coddoc=v_coddoc AND (l.estlin IN ('Revision','Error','Pendiente') OR EXISTS(
      SELECT 1 FROM public.vehiculodocumento v WHERE v.codlin=l.codlin AND v.estvehdoc='Revision'));
  SELECT advertencias INTO v_advertencias FROM public.documentocompra WHERE coddoc=v_coddoc;
  RETURN jsonb_build_object(
    'coddoc',v_coddoc::text,'estadoDocumento',(SELECT estdoc FROM public.documentocompra WHERE coddoc=v_coddoc),
    'reintento',v_reintento,'error',CASE WHEN v_conflicto THEN 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO' WHEN v_fallo THEN 'ERROR_TECNICO_IMPORTACION' ELSE NULL END,
    'compras',coalesce(v_compras,'[]'::jsonb),'unidades',coalesce(v_unidades,'[]'::jsonb),
    'lineasRevision',coalesce(v_lineas_revision,'[]'::jsonb),
    'conteos',jsonb_build_object('lineas',v_lineas,'vehiculos',v_vehiculos,'importados',v_procesados,'revision',v_revision),
    'advertencias',coalesce(v_advertencias,'[]'::jsonb)
  );
END
$$;

REVOKE ALL ON FUNCTION public.listar_equivalencias_importacion(text), public.importar_documento_compra(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_equivalencias_importacion(text), public.importar_documento_compra(jsonb) TO authenticated;
COMMENT ON FUNCTION public.importar_documento_compra(jsonb) IS 'Importa de forma transaccional un documento UBL ya parseado y validado; solo Gerente o Administradora autenticados; las unidades nuevas inician en Crossland Ancón.';
COMMENT ON FUNCTION public.listar_equivalencias_importacion(text) IS 'Devuelve únicamente equivalencias activas de un proveedor a usuarios Gerente o Administradora autenticados.';

COMMIT;
