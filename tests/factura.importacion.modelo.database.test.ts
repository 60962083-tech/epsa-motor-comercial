import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync('supabase/migrations/202610240001_hu030_modelo_documental.sql', 'utf8');
const correctiveMigration = readFileSync('supabase/migrations/202610240002_hu030_ajustes_modelo_documental.sql', 'utf8');
const provisionalEquivalencesMigration = readFileSync('supabase/migrations/202610280001_hu030_equivalencias_provisionales_crosland.sql', 'utf8');
const base = readFileSync('tests/fixtures/esquema-base.sql', 'utf8');
const hu026 = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
const hu034 = readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8');
const hu002 = readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8');
const hu003 = readFileSync('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql', 'utf8');
const hu001 = readFileSync('supabase/migrations/202610210001_hu001_consulta_inventario.sql', 'utf8');

test('HU-030 modelo documental: restricciones, semillas, aislamiento y compatibilidad histórica', async (t) => {
  const db = new PGlite();
  const fail = async (sql: string, code = '23514') => assert.rejects(db.exec(sql), (error: any) => error.code === code);
  let codproCrosland = 0;
  let codproLegacy = 0;
  let codcomLegacy = 0;
  let coddoc = 0;
  let codlin = 0;
  let codmod = 0;
  let facturaColumnsBefore: any[] = [];
  let facturaIndexesBefore: any[] = [];

  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(base);
    await db.exec(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Ubicación previa sintética','Almacen')`);
    await db.exec(hu026);
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        VALUES ('00000000-0000-0000-0000-000000000001',1,'QA','Sintético','qa-factura@test.local');
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO modelo(codtmo,nommod,marmod,desmod,carmod,estmod) VALUES
        (1,'Torito 250 4V GLP','Bajaj','Modelo sintético','Datos sintéticos','Publicado'),
        (1,'Torito Crom Plus GLP','Bajaj','Modelo sintético','Datos sintéticos','Publicado'),
        (1,'Torito 4V GLP','Bajaj','Modelo sintético','Datos sintéticos','Publicado'),
        (1,'Torito Crom Plus GSL','Bajaj','Modelo sintético','Datos sintéticos','Publicado'),
        (1,'Torito 2T UG GLP','Bajaj','Modelo sintético','Datos sintéticos','Publicado'),
        (1,'Torito Crom Plus GNV','Bajaj','Modelo sintético','Datos sintéticos','No publicado');
      INSERT INTO proveedor(nompro,estpro) VALUES ('Proveedor histórico sin RUC',true);
      INSERT INTO compra(codmod,codusu,colcom,cancom,estcom) VALUES (1,1,'Negro',1,'Pendiente de factura');
      INSERT INTO unidad(codcom,codmod,codpro,nummotuni,chauni)
        VALUES (1,1,1,'LEGACY-ENGINE-SYNTH','LEGACY-CHASSIS-SYNTH');`);
    codproLegacy = 1;
    codcomLegacy = 1;
    await db.exec(hu034);
    await db.exec(hu002);
    await db.exec(hu003);
    await db.exec(hu001);
    await db.exec(`INSERT INTO factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
      VALUES (${codcomLegacy},'Proveedor sintético','DOC-SYNTH-001',CURRENT_DATE,1,1)`);
    facturaColumnsBefore = (await db.query<any>(`SELECT column_name,data_type,is_nullable FROM information_schema.columns
      WHERE table_schema='public' AND table_name='factura_compra' ORDER BY ordinal_position`)).rows;
    facturaIndexesBefore = (await db.query<any>(`SELECT indexname,indexdef FROM pg_indexes
      WHERE schemaname='public' AND tablename='factura_compra' ORDER BY indexname`)).rows;
    await db.exec(migration);
    await db.exec(correctiveMigration);
    await db.exec(correctiveMigration);

    codproCrosland = (await db.query<any>(`SELECT codpro FROM proveedor WHERE rucpro='20502913752'`)).rows[0].codpro;
    codmod = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0].codmod;
    const bajajAntes = (await db.query<any>(`SELECT codequ,codext,claequ,codmod,estequ,fueaprequ,obsequ,codusuapr
      FROM equivalenciaproducto WHERE codpro=$1 AND codext='BAJAJVERDE' AND estequ`, [codproCrosland])).rows[0];
    await db.exec(provisionalEquivalencesMigration);
    await db.exec(provisionalEquivalencesMigration);
    const bajajDespues = (await db.query<any>(`SELECT codequ,codext,claequ,codmod,estequ,fueaprequ,obsequ,codusuapr
      FROM equivalenciaproducto WHERE codpro=$1 AND codext='BAJAJVERDE' AND estequ`, [codproCrosland])).rows[0];
    assert.deepEqual(bajajDespues, bajajAntes);
    coddoc = (await db.query<any>(`INSERT INTO documentocompra(codpro,tipdoc,iddoc,serdoc,numdoc,gmailmessageid)
      VALUES ($1,'01','S001-00000001','S001','00000001','factura-test-message-1') RETURNING coddoc`, [codproCrosland])).rows[0].coddoc;

    await t.test('proveedor.rucpro es VARCHAR(11), nullable, validado y único; filas antiguas quedan NULL', async () => {
      const column = (await db.query<any>(`SELECT data_type,character_maximum_length,is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='proveedor' AND column_name='rucpro'`)).rows[0];
      assert.deepEqual(column, { data_type: 'character varying', character_maximum_length: 11, is_nullable: 'YES' });
      assert.equal((await db.query<any>('SELECT rucpro FROM proveedor WHERE codpro=$1', [codproLegacy])).rows[0].rucpro, null);
      assert.equal((await db.query<any>(`SELECT nompro,estpro FROM proveedor WHERE codpro=$1`, [codproCrosland])).rows[0].nompro, 'CROSLAND AUTOMOTRIZ S.A.C.');
      assert.equal((await db.query<any>('SELECT rucpro FROM proveedor WHERE codpro=$1', [codproCrosland])).rows[0].rucpro, '20502913752');
      await fail(`INSERT INTO proveedor(nompro,rucpro) VALUES ('RUC corto','123')`);
      await fail(`INSERT INTO proveedor(nompro,rucpro) VALUES ('RUC no numérico','1234567890A')`);
      await fail(`INSERT INTO proveedor(nompro,rucpro) VALUES ('RUC largo','123456789012')`, '22001');
      await assert.rejects(db.exec(`INSERT INTO proveedor(nompro,rucpro) VALUES ('Proveedor duplicado','20502913752')`), (error: any) => error.code === '23505');
    });

    await t.test('unidad.codpro legado queda intacto y la clave Ancón es semántica', async () => {
      assert.equal((await db.query<any>('SELECT codpro FROM unidad WHERE codcom=$1', [codcomLegacy])).rows[0].codpro, codproLegacy);
      const location = (await db.query<any>(`SELECT u.codubi,u.nomubi,u.tipubi,u.estubi,k.estucl FROM ubicacionclave k
        JOIN ubicacion u ON u.codubi=k.codubi WHERE k.claubi='ALMACEN_CROSLAND_ANCON'`)).rows[0];
      assert.equal(location.nomubi, 'Crossland Ancón');
      assert.equal(location.tipubi, 'Almacen');
      assert.equal(location.estubi, true);
      assert.equal(location.estucl, true);
      assert.notEqual(String(location.codubi), '4');
    });

    await t.test('equivalencias provisionales del PO se resuelven por modelo, son idempotentes y preservan BAJAJVERDE', async () => {
      const vehicle = (await db.query<any>(`SELECT e.codext,e.claequ,e.codmod,m.nommod,e.fueaprequ,e.codusuapr
        FROM equivalenciaproducto e LEFT JOIN modelo m USING(codmod)
        WHERE e.codpro=$1 AND upper(btrim(e.codext))='B3-4TLPG250UG4V' AND e.estequ`, [codproCrosland])).rows[0];
      assert.equal(vehicle.claequ, 'Vehiculo');
      assert.equal(vehicle.nommod, 'Torito 250 4V GLP');
      assert.equal(String(vehicle.codmod), String(codmod));
      assert.equal(vehicle.fueaprequ, 'Product Owner HU-030 - 2026-10-24');
      assert.equal(vehicle.codusuapr, null);
      const accessory = (await db.query<any>(`SELECT claequ,codmod FROM equivalenciaproducto
        WHERE codpro=$1 AND codext='BAJAJVERDE' AND estequ`, [codproCrosland])).rows[0];
      assert.deepEqual(accessory, { claequ: 'Accesorio', codmod: null });

      const expectedVehicles = [
        ['B3-4TLPGUG', 'Torito Crom Plus GLP'],
        ['B3-4TLPGUG4V', 'Torito 4V GLP'],
        ['B3-4TGSLUG', 'Torito Crom Plus GSL'],
        ['B3-2TLPGUG', 'Torito 2T UG GLP'],
        ['B3-4TCNGUG', 'Torito Crom Plus GNV'],
        ['B3-4TLPG250UG4V', 'Torito 250 4V GLP']
      ];
      for (const [codigo, nombreModelo] of expectedVehicles) {
        const matches = (await db.query<any>(`SELECT e.claequ,e.codmod,e.estequ,m.nommod,e.fueaprequ,e.obsequ
          FROM equivalenciaproducto e JOIN modelo m USING(codmod)
          WHERE e.codpro=$1 AND upper(btrim(e.codext))=upper(btrim($2)) AND e.estequ`,
        [codproCrosland, codigo])).rows;
        assert.equal(matches.length, 1, codigo);
        assert.equal(matches[0].claequ, 'Vehiculo', codigo);
        assert.equal(matches[0].estequ, true, codigo);
        assert.equal(matches[0].nommod, nombreModelo, codigo);
        if (codigo !== 'B3-4TLPG250UG4V') {
          assert.equal(matches[0].fueaprequ, 'Product Owner HU-030 - mappings provisionales 2026-10-28', codigo);
          assert.match(matches[0].obsequ, /provisional/i, codigo);
        }
      }
      for (const pendingCode of ['B2-BM150UG', 'B3-4TLPG250']) {
        assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM equivalenciaproducto
          WHERE codpro=$1 AND upper(btrim(codext))=upper(btrim($2)) AND estequ`, [codproCrosland, pendingCode])).rows[0].n, 0, pendingCode);
      }
      assert.equal((await db.query<any>(`SELECT estmod FROM modelo WHERE nommod='Torito Crom Plus GNV'`)).rows[0].estmod, 'No publicado');

      const correctModel = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 4V GLP'`)).rows[0].codmod;
      const otherModel = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito Crom Plus GLP'`)).rows[0].codmod;
      await db.query(`UPDATE equivalenciaproducto SET codmod=$1 WHERE codpro=$2 AND codext='B3-4TLPGUG4V' AND estequ`, [otherModel, codproCrosland]);
      await assert.rejects(db.exec(provisionalEquivalencesMigration), /contradice el mapping provisional/i);
      const notOverwritten = (await db.query<any>(`SELECT codmod FROM equivalenciaproducto
        WHERE codpro=$1 AND codext='B3-4TLPGUG4V' AND estequ`, [codproCrosland])).rows[0].codmod;
      assert.equal(String(notOverwritten), String(otherModel));
      await db.query(`UPDATE equivalenciaproducto SET codmod=$1 WHERE codpro=$2 AND codext='B3-4TLPGUG4V' AND estequ`, [correctModel, codproCrosland]);

      await fail(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod) VALUES (${codproCrosland},'INVALID-VEHICLE','Vehiculo',NULL)`);
      await fail(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod) VALUES (${codproCrosland},'INVALID-ACCESSORY','Accesorio',${codmod})`);
      await assert.rejects(db.exec(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod) VALUES (${codproCrosland},' b3-4tlpg250ug4v ','Accesorio',NULL)`), (error: any) => error.code === '23505');
      await db.exec(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod,estequ) VALUES (${codproCrosland},'OLD-CODE','Accesorio',NULL,false);
        INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod,estequ) VALUES (${codproCrosland},' old-code ','Accesorio',NULL,true);`);
    });

    await t.test('segunda migración agrega montos NUMERIC, metadatos UBL y datos de bonificación', async () => {
      const documentColumns = (await db.query<any>(`SELECT column_name,data_type,is_nullable
        FROM information_schema.columns WHERE table_schema='public' AND table_name='documentocompra'`)).rows;
      const lineColumns = (await db.query<any>(`SELECT column_name,data_type,is_nullable
        FROM information_schema.columns WHERE table_schema='public' AND table_name='lineadocumentocompra'`)).rows;
      const doc = new Map(documentColumns.map((column) => [column.column_name, column]));
      const line = new Map(lineColumns.map((column) => [column.column_name, column]));
      for (const column of ['valorventadeclarado','impuestosdeclarados','totalantesimpuestos','totalincluidoimpuestos','totalapagar','totaloperacionesgratuitas']) {
        assert.equal(doc.get(column)?.data_type, 'numeric', column);
      }
      for (const column of ['versionubl','pedidocabecera','firmapresente','advertencias']) assert.ok(doc.has(column), column);
      assert.equal(doc.get('advertencias')?.data_type, 'jsonb');
      await db.exec(`UPDATE documentocompra SET versionubl='2.1',pedidocabecera='HEADER-SYNTH-01',
        valorventadeclarado=2000,impuestosdeclarados=360,totalantesimpuestos=2000,
        totalincluidoimpuestos=2360,totalapagar=2360,totaloperacionesgratuitas=239.99,
        firmapresente=true,advertencias='["WARN-SYNTH"]'::jsonb WHERE coddoc=${coddoc}`);
      const persistedHeader = (await db.query<any>(`SELECT versionubl,pedidocabecera,
        valorventadeclarado::text,impuestosdeclarados::text,totalantesimpuestos::text,
        totalincluidoimpuestos::text,totalapagar::text,totaloperacionesgratuitas::text,
        firmapresente,advertencias FROM documentocompra WHERE coddoc=$1`, [coddoc])).rows[0];
      assert.deepEqual(persistedHeader, {
        versionubl: '2.1', pedidocabecera: 'HEADER-SYNTH-01', valorventadeclarado: '2000.000000',
        impuestosdeclarados: '360.000000', totalantesimpuestos: '2000.000000',
        totalincluidoimpuestos: '2360.000000', totalapagar: '2360.000000',
        totaloperacionesgratuitas: '239.990000', firmapresente: true, advertencias: ['WARN-SYNTH']
      });
      for (const column of ['preciounitario','precioreferencial','valoroperaciongratuita']) assert.equal(line.get(column)?.data_type, 'numeric', column);
      for (const column of ['codunspsc','esoperaciongratuita','pricetypecode','taxexemptionreasoncode','taxschemeid']) assert.ok(line.has(column), column);

      const freeLineId = (await db.query<any>(`INSERT INTO lineadocumentocompra(
        coddoc,numlinea,codext,claext,preciounitario,precioreferencial,codunspsc,
        esoperaciongratuita,valoroperaciongratuita,pricetypecode,taxexemptionreasoncode,taxschemeid
      ) VALUES ($1,'FREE-1','BAJAJVERDE','Accesorio',0,120,'25112000',true,120,'02','31','9996') RETURNING codlin`, [coddoc])).rows[0].codlin;
      const freeLine = (await db.query<any>(`SELECT preciounitario::text,precioreferencial::text,codunspsc,
        esoperaciongratuita,valoroperaciongratuita::text,pricetypecode,taxexemptionreasoncode,taxschemeid
        FROM lineadocumentocompra WHERE codlin=$1`, [freeLineId])).rows[0];
      assert.deepEqual(freeLine, {
        preciounitario: '0.000000', precioreferencial: '120.000000', codunspsc: '25112000', esoperaciongratuita: true,
        valoroperaciongratuita: '120.000000', pricetypecode: '02', taxexemptionreasoncode: '31', taxschemeid: '9996'
      });
    });

    await t.test('documento admite ausencia de archivos y mantiene identidades e intentos', async () => {
      const doc = (await db.query<any>('SELECT sha256xml,sha256pdf,rutaxml,rutapdf,pdfpendiente FROM documentocompra WHERE coddoc=$1', [coddoc])).rows[0];
      assert.deepEqual(doc, { sha256xml: null, sha256pdf: null, rutaxml: null, rutapdf: null, pdfpendiente: true });
      await assert.rejects(db.exec(`INSERT INTO documentocompra(codpro,tipdoc,serdoc,numdoc)
        VALUES (${codproCrosland},'01','S001','00000001')`), (error: any) => error.code === '23505');
      await assert.rejects(db.exec(`INSERT INTO documentocompra(gmailmessageid) VALUES ('factura-test-message-1')`), (error: any) => error.code === '23505');
      await db.exec(`INSERT INTO documentocompra(estdoc) VALUES ('Error');`);
      await assert.rejects(db.exec(`INSERT INTO documentocompra(estdoc) VALUES ('Exitoso')`), (error: any) => error.code === '23514');
      await db.exec(`INSERT INTO intentodocumento(coddoc,tipactor,resint,fecfin,cantlineas,cantvehiculos,cantrevision)
        VALUES (${coddoc},'Automatico','Error',now(),0,0,0),(${coddoc},'Usuario','Parcial',now(),4,2,1)`);
      assert.equal((await db.query<any>('SELECT count(*)::int AS n FROM intentodocumento WHERE coddoc=$1', [coddoc])).rows[0].n, 2);
    });

    await t.test('intentos Procesando admiten fecfin NULL y los resultados finales la exigen', async () => {
      await db.exec(`INSERT INTO intentodocumento(coddoc,tipactor,resint,fecfin)
        VALUES (${coddoc},'Automatico','Procesando',NULL)`);
      for (const result of ['Exito','Parcial','Error']) {
        await assert.rejects(db.exec(`INSERT INTO intentodocumento(coddoc,tipactor,resint,fecfin)
          VALUES (${coddoc},'Automatico','${result}',NULL)`), (error: any) => error.code === '23514');
        await db.exec(`INSERT INTO intentodocumento(coddoc,tipactor,resint,fecfin)
          VALUES (${coddoc},'Automatico','${result}',now())`);
      }
      await assert.rejects(db.exec(`INSERT INTO intentodocumento(coddoc,tipactor,resint,fecfin)
        VALUES (${coddoc},'Usuario','Procesando',now())`), (error: any) => error.code === '23514');
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM intentodocumento WHERE coddoc=$1 AND resint='Procesando' AND fecfin IS NULL`, [coddoc])).rows[0].n, 1);
      const resultChecks = (await db.query<any>(`SELECT conname FROM pg_constraint
        WHERE conrelid='public.intentodocumento'::regclass AND contype='c'
          AND pg_get_constraintdef(oid) ILIKE '%resint%' ORDER BY conname`)).rows.map((row) => row.conname);
      assert.deepEqual(resultChecks, ['ck_intentodocumento_fecfin','ck_intentodocumento_resint']);
    });

    await t.test('reaplicar la migración correctiva conserva todos los intentos', async () => {
      const before = (await db.query<any>('SELECT count(*)::int AS n FROM intentodocumento WHERE coddoc=$1', [coddoc])).rows[0].n;
      await db.exec(correctiveMigration);
      const after = (await db.query<any>('SELECT count(*)::int AS n FROM intentodocumento WHERE coddoc=$1', [coddoc])).rows[0].n;
      assert.equal(after, before);
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM pg_constraint
        WHERE conrelid='public.intentodocumento'::regclass AND conname IN ('ck_intentodocumento_resint','ck_intentodocumento_fecfin')`)).rows[0].n, 2);
    });

    await t.test('líneas, seriales, compras vinculadas y referencias conservan integridad', async () => {
      codlin = (await db.query<any>(`INSERT INTO lineadocumentocompra(coddoc,numlinea,codext,canlin,claext,estlin)
        VALUES ($1,'1','SYNTH-MOTO',1,'Vehiculo','Procesada') RETURNING codlin`, [coddoc])).rows[0].codlin;
      await assert.rejects(db.exec(`INSERT INTO lineadocumentocompra(coddoc,numlinea) VALUES (${coddoc},'1')`), (error: any) => error.code === '23505');
      await db.exec(`INSERT INTO vehiculodocumento(codlin,ordveh,motororiginal,vinoriginal,chasisoriginal)
        VALUES (${codlin},1,'MOTOR-SYNTH','VIN-SYNTH','CHASSIS-SYNTH');`);
      const serial = (await db.query<any>('SELECT motororiginal,vinoriginal,chasisoriginal FROM vehiculodocumento WHERE codlin=$1', [codlin])).rows[0];
      assert.deepEqual(serial, { motororiginal: 'MOTOR-SYNTH', vinoriginal: 'VIN-SYNTH', chasisoriginal: 'CHASSIS-SYNTH' });
      await db.exec(`INSERT INTO documentocompracompra(coddoc,codcom,tipvinculo) VALUES (${coddoc},${codcomLegacy},'Conciliado')`);
      await assert.rejects(db.exec(`INSERT INTO documentocompracompra(coddoc,codcom,tipvinculo) VALUES (${coddoc},${codcomLegacy},'Automatico')`), (error: any) => error.code === '23505');
      await db.exec(`INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado)
        VALUES (${codcomLegacy},${codproCrosland},'PedidoCrosland','ORDER-SYNTH-01','order-synth-01');`);
      await assert.rejects(db.exec(`INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado)
        VALUES (${codcomLegacy},${codproCrosland},'PedidoCrosland','ORDER-SYNTH-01','ORDER-SYNTH-01');`), (error: any) => error.code === '23505');
      await db.exec(`INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,estref)
        VALUES (${codcomLegacy},${codproCrosland},'PedidoCrosland','ORDER-SYNTH-01','ORDER-SYNTH-01','Inactiva');`);
    });

    await t.test('documentocompracompra conserva UNIQUE(coddoc,codcom) y permite documentos múltiples por compra', async () => {
      const anotherDocId = (await db.query<any>(`INSERT INTO documentocompra(codpro,tipdoc,iddoc,serdoc,numdoc)
        VALUES ($1,'01','S001-00000002','S001','00000002') RETURNING coddoc`, [codproCrosland])).rows[0].coddoc;
      await db.exec(`INSERT INTO documentocompracompra(coddoc,codcom,tipvinculo)
        VALUES (${anotherDocId},${codcomLegacy},'Conciliado')`);
      const links = (await db.query<any>('SELECT count(*)::int AS n FROM documentocompracompra WHERE codcom=$1', [codcomLegacy])).rows[0].n;
      assert.equal(links, 2);
      const constraint = (await db.query<any>(`SELECT pg_get_constraintdef(oid) AS definition
        FROM pg_constraint WHERE conrelid='public.documentocompracompra'::regclass
          AND conname='uq_documentocompracompra'`)).rows[0];
      assert.equal(constraint.definition, 'UNIQUE (coddoc, codcom)');
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM pg_constraint
        WHERE conrelid='public.documentocompracompra'::regclass AND contype='u'
          AND pg_get_constraintdef(oid)='UNIQUE (codcom)'`)).rows[0].n, 0);
    });

    await t.test('todas las tablas nuevas están cerradas por ACL y RLS, incluidas sus secuencias', async () => {
      const tables = ['ubicacionclave','equivalenciaproducto','documentocompra','lineadocumentocompra','vehiculodocumento','documentocompracompra','referenciacompra','intentodocumento'];
      const security = (await db.query<any>(`SELECT c.relname,c.relrowsecurity,
        has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
        has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
        has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
        has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,
        has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
        has_table_privilege('authenticated',c.oid,'INSERT') AS auth_insert,
        has_table_privilege('authenticated',c.oid,'UPDATE') AS auth_update,
        has_table_privilege('authenticated',c.oid,'DELETE') AS auth_delete
        FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname=ANY($1::text[])`, [tables])).rows;
      assert.equal(security.length, tables.length);
      for (const table of security) {
        assert.equal(table.relrowsecurity, true, table.relname);
        assert.equal(table.anon_select, false, table.relname);
        assert.equal(table.anon_insert, false, table.relname);
        assert.equal(table.anon_update, false, table.relname);
        assert.equal(table.anon_delete, false, table.relname);
        assert.equal(table.auth_select, false, table.relname);
        assert.equal(table.auth_insert, false, table.relname);
        assert.equal(table.auth_update, false, table.relname);
        assert.equal(table.auth_delete, false, table.relname);
      }
      const identityColumns: Array<[string, string]> = [
        ['ubicacionclave','coducl'], ['equivalenciaproducto','codequ'], ['documentocompra','coddoc'],
        ['lineadocumentocompra','codlin'], ['vehiculodocumento','codvehdoc'],
        ['documentocompracompra','coddcc'], ['referenciacompra','codref'], ['intentodocumento','codint']
      ];
      for (const [table, column] of identityColumns) {
        const seqName = (await db.query<any>('SELECT pg_get_serial_sequence($1,$2) AS name', [`public.${table}`, column])).rows[0].name;
        assert.ok(seqName, `${table} sequence`);
        const privileges = (await db.query<any>(`SELECT has_sequence_privilege('anon',$1,'USAGE') AS anon_usage,
          has_sequence_privilege('authenticated',$1,'USAGE') AS auth_usage`, [seqName])).rows[0];
        assert.equal(privileges.anon_usage, false, table);
        assert.equal(privileges.auth_usage, false, table);
      }
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM pg_policies
        WHERE schemaname='public' AND tablename=ANY($1::text[]) AND permissive='RESTRICTIVE'`, [tables])).rows[0].n, tables.length);
      await db.exec('SET ROLE authenticated');
      await assert.rejects(db.exec('SELECT * FROM documentocompra'), (error: any) => error.code === '42501');
      await assert.rejects(db.exec(`INSERT INTO documentocompra DEFAULT VALUES`), (error: any) => error.code === '42501');
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(db.exec('SELECT * FROM documentocompra'), (error: any) => error.code === '42501');
      await db.exec('RESET ROLE');
    });

    await t.test('HU-002, HU-034, HU-003 y HU-001 permanecen instalables y factura_compra conserva su vínculo único', async () => {
      assert.equal((await db.query<any>(`SELECT to_regclass('public.factura_compra') IS NOT NULL AS exists`)).rows[0].exists, true);
      assert.equal((await db.query<any>(`SELECT to_regprocedure('public.hu002_registrar_factura(bigint,text,text,date,integer)') IS NOT NULL AS exists`)).rows[0].exists, true);
      assert.equal((await db.query<any>(`SELECT to_regprocedure('public.hu034_registrar_compra(bigint,text,integer,uuid)') IS NOT NULL AS exists`)).rows[0].exists, true);
      assert.equal((await db.query<any>(`SELECT to_regprocedure('public.hu003_iniciar_movimiento(bigint,bigint,bigint,text)') IS NOT NULL AS exists`)).rows[0].exists, true);
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND tablename='factura_compra' AND indexdef ILIKE '%UNIQUE%CODCOM%'`)).rows[0].n, 1);
      const facturaColumnsAfter = (await db.query<any>(`SELECT column_name,data_type,is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='factura_compra' ORDER BY ordinal_position`)).rows;
      const facturaIndexesAfter = (await db.query<any>(`SELECT indexname,indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='factura_compra' ORDER BY indexname`)).rows;
      assert.deepEqual(facturaColumnsAfter, facturaColumnsBefore);
      assert.deepEqual(facturaIndexesAfter, facturaIndexesBefore);
      assert.equal((await db.query<any>(`SELECT count(*)::int AS n FROM factura_compra WHERE codcom=$1`, [codcomLegacy])).rows[0].n, 1);
      assert.equal((await db.query<any>(`SELECT to_regprocedure('public.hu001_consultar_inventario(bigint,bigint,text,text,bigint,bigint,integer,integer)') IS NOT NULL AS exists`)).rows[0].exists, true);
      const unit = (await db.query<any>(`SELECT codpro FROM unidad WHERE codcom=$1`, [codcomLegacy])).rows[0];
      assert.equal(unit.codpro, codproLegacy);
    });
  } finally {
    await db.close();
  }
});
