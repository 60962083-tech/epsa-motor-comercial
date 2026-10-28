-- Ajustes incrementales al esquema documental HU-030 ya instalado.
-- Esta migración conserva las tablas y los registros existentes.

ALTER TABLE public.documentocompra
  ADD COLUMN IF NOT EXISTS versionubl varchar(20),
  ADD COLUMN IF NOT EXISTS pedidocabecera varchar(150),
  ADD COLUMN IF NOT EXISTS valorventadeclarado numeric(18,6),
  ADD COLUMN IF NOT EXISTS impuestosdeclarados numeric(18,6),
  ADD COLUMN IF NOT EXISTS totalantesimpuestos numeric(18,6),
  ADD COLUMN IF NOT EXISTS totalincluidoimpuestos numeric(18,6),
  ADD COLUMN IF NOT EXISTS totalapagar numeric(18,6),
  ADD COLUMN IF NOT EXISTS totaloperacionesgratuitas numeric(18,6),
  ADD COLUMN IF NOT EXISTS firmapresente boolean,
  ADD COLUMN IF NOT EXISTS advertencias jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.lineadocumentocompra
  ADD COLUMN IF NOT EXISTS preciounitario numeric(18,6),
  ADD COLUMN IF NOT EXISTS precioreferencial numeric(18,6),
  ADD COLUMN IF NOT EXISTS codunspsc varchar(30),
  ADD COLUMN IF NOT EXISTS esoperaciongratuita boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valoroperaciongratuita numeric(18,6),
  ADD COLUMN IF NOT EXISTS pricetypecode varchar(10),
  ADD COLUMN IF NOT EXISTS taxexemptionreasoncode varchar(10),
  ADD COLUMN IF NOT EXISTS taxschemeid varchar(20);

COMMENT ON COLUMN public.documentocompra.versionubl IS 'Versión UBL declarada por el XML procesado.';
COMMENT ON COLUMN public.documentocompra.pedidocabecera IS 'Referencia de pedido de cabecera extraída del XML.';
COMMENT ON COLUMN public.documentocompra.valorventadeclarado IS 'LineExtensionAmount declarado; excluye del cálculo los valores referenciales de operaciones gratuitas.';
COMMENT ON COLUMN public.documentocompra.totaloperacionesgratuitas IS 'Base total de operaciones gratuitas declarada en los TaxSubtotal correspondientes.';
COMMENT ON COLUMN public.documentocompra.firmapresente IS 'Indica si el XML contiene un nodo de firma; no afirma que la firma haya sido validada.';
COMMENT ON COLUMN public.documentocompra.advertencias IS 'Advertencias sanitizadas producidas por el análisis documental.';
COMMENT ON COLUMN public.lineadocumentocompra.precioreferencial IS 'Precio referencial separado del precio efectivo de la línea.';
COMMENT ON COLUMN public.lineadocumentocompra.esoperaciongratuita IS 'Indica si la línea representa una operación gratuita según sus códigos UBL.';
COMMENT ON COLUMN public.lineadocumentocompra.valoroperaciongratuita IS 'Valor de la operación gratuita, separado de la suma onerosa.';

DO $corregir_intentos$
DECLARE
  v_constraint text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.intentodocumento
    WHERE resint IN ('Exito','Parcial','Error') AND fecfin IS NULL
  ) THEN
    RAISE EXCEPTION 'Hay intentos finales sin fecfin; resuelva esos registros antes de aplicar los nuevos constraints';
  END IF;

  FOR v_constraint IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.intentodocumento'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%resint%'
  LOOP
    EXECUTE format('ALTER TABLE public.intentodocumento DROP CONSTRAINT %I', v_constraint);
  END LOOP;

  ALTER TABLE public.intentodocumento
    ADD CONSTRAINT ck_intentodocumento_resint
      CHECK (resint IN ('Procesando','Exito','Parcial','Error')),
    ADD CONSTRAINT ck_intentodocumento_fecfin
      CHECK (
        (resint = 'Procesando' AND fecfin IS NULL)
        OR (resint IN ('Exito','Parcial','Error') AND fecfin IS NOT NULL)
      );
END
$corregir_intentos$;

COMMENT ON CONSTRAINT uq_documentocompracompra ON public.documentocompracompra IS
  'UNIQUE(coddoc,codcom) evita duplicar el mismo vínculo, pero todavía permite vincular una compra a varios documentos. No agregar UNIQUE(codcom) hasta definir la facturación parcial.';
