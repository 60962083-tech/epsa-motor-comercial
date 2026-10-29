-- Equivalencias provisionales de SKU Crosland confirmadas por el PO para la demostración HU-030.
-- Se resuelven proveedor y modelos por datos de negocio y se preservan las equivalencias históricas.
-- B2-BM150UG y B3-4TLPG250 permanecen sin equivalencia hasta definir su modelo interno.
-- BAJAJVERDE es una bonificación Accesorio y no se modifica en esta migración.
DO $equivalencias_po$
DECLARE
  v_codpro bigint;
  v_proveedores integer;
  v_mapping record;
  v_modelos integer;
  v_codmod bigint;
  v_existente record;
BEGIN
  SELECT count(*)::integer, min(p.codpro)
  INTO v_proveedores, v_codpro
  FROM public.proveedor p
  WHERE p.rucpro = '20502913752';

  IF v_proveedores <> 1 THEN
    RAISE EXCEPTION 'Se esperaba exactamente un proveedor Crosland con RUC 20502913752 y se encontraron %', v_proveedores;
  END IF;

  FOR v_mapping IN
    SELECT m.codext, m.nommod
    FROM (VALUES
      ('B3-4TLPGUG',      'Torito Crom Plus GLP'),
      ('B3-4TLPGUG4V',    'Torito 4V GLP'),
      ('B3-4TGSLUG',      'Torito Crom Plus GSL'),
      ('B3-2TLPGUG',      'Torito 2T UG GLP'),
      ('B3-4TCNGUG',      'Torito Crom Plus GNV'),
      ('B3-4TLPG250UG4V', 'Torito 250 4V GLP')
    ) AS m(codext, nommod)
  LOOP
    SELECT count(*)::integer, min(modelo.codmod)
    INTO v_modelos, v_codmod
    FROM public.modelo modelo
    WHERE modelo.nommod = v_mapping.nommod;

    IF v_modelos <> 1 THEN
      RAISE EXCEPTION 'Se esperaba exactamente un modelo "%" para el SKU % y se encontraron %',
        v_mapping.nommod, v_mapping.codext, v_modelos;
    END IF;

    SELECT e.claequ, e.codmod
    INTO v_existente
    FROM public.equivalenciaproducto e
    WHERE e.codpro = v_codpro
      AND e.estequ
      AND upper(btrim(e.codext)) = upper(btrim(v_mapping.codext))
    FOR UPDATE;

    IF FOUND THEN
      IF v_existente.claequ IS DISTINCT FROM 'Vehiculo'
         OR v_existente.codmod IS DISTINCT FROM v_codmod THEN
        RAISE EXCEPTION 'La equivalencia activa de Crosland para % contradice el mapping provisional del PO (modelo "%")',
          v_mapping.codext, v_mapping.nommod;
      END IF;
    ELSE
      INSERT INTO public.equivalenciaproducto (
        codpro, codext, claequ, codmod, estequ, fueaprequ, obsequ
      ) VALUES (
        v_codpro,
        v_mapping.codext,
        'Vehiculo',
        v_codmod,
        true,
        'Product Owner HU-030 - mappings provisionales 2026-10-28',
        'Asociación provisional para demostración; revisar cuando el negocio entregue la definición oficial del SKU.'
      );
    END IF;
  END LOOP;
END
$equivalencias_po$;
