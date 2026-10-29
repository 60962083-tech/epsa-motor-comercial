import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { parsearFacturaUbl } from '../src/utils/factura.importacion.xml.parser.js';
import { clasificarLineasFactura } from '../src/utils/factura.importacion.clasificacion.js';
import { agruparComprasFactura } from '../src/utils/factura.importacion.agrupacion.js';

const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';
const ACTOR_UUID = '9a1d7d2e-2d30-4f5a-8b90-030000000001';
const read = (path: string) => readFileSync(path, 'utf8');
const xmlFixture = readFileSync('tests/fixtures/factura-importacion/factura_valida.xml');

async function crearDb() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL UNIQUE);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  await db.exec(read('tests/fixtures/esquema-base.sql'));
  await db.exec(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Ubicación sintética','Almacen');`);
  await db.exec(read('supabase/migrations/202610030001_hu026_ubicaciones.sql'));
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${ADMIN_UUID}','admin-hu030@test.local'),('${ACTOR_UUID}','integracion.facturas@epsa.internal');
    INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
    INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu) VALUES
      ('${ADMIN_UUID}',1,'Admin','Sintético','admin-hu030@test.local');
    INSERT INTO tipomotocar(nomtmo) VALUES ('QA sintético');
    INSERT INTO modelo(codtmo,nommod,marmod,desmod,carmod,estmod) VALUES
      (1,'Torito 250 4V GLP','Bajaj','Ficha sintética','GLP','Publicado'),
      (1,'Torito Crom Plus GLP','Bajaj','Ficha sintética','GLP','Publicado'),
      (1,'Torito 4V GLP','Bajaj','Ficha sintética','GLP','Publicado'),
      (1,'Torito Crom Plus GSL','Bajaj','Ficha sintética','Gasolina','Publicado'),
      (1,'Torito 2T UG GLP','Bajaj','Ficha sintética','GLP','Publicado'),
      (1,'Torito Crom Plus GNV','Bajaj','Ficha sintética','GNV','No publicado');`);
  await db.exec(read('supabase/migrations/202610040001_hu034_compra_pendiente.sql'));
  await db.exec(read('supabase/migrations/202610060001_hu002_identificacion_unidades.sql'));
  await db.exec(read('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql'));
  await db.exec(read('supabase/migrations/202610210001_hu001_consulta_inventario.sql'));
  await db.exec(read('supabase/migrations/202610080001_hu004_configuracion_techo.sql'));
  await db.exec(read('supabase/migrations/202610240001_hu030_modelo_documental.sql'));
  await db.exec(read('supabase/migrations/202610240002_hu030_ajustes_modelo_documental.sql'));
  await db.exec(read('supabase/migrations/202610240003_hu030_importacion_transaccional.sql'));
  await db.exec(read('supabase/migrations/202610250001_hu030_integracion_backend.sql'));
  await db.exec(read('supabase/migrations/202610250001_hu030_integracion_backend.sql'));
  await db.exec(read('supabase/migrations/202610280003_hu033_preparacion_unidad.sql'));
  await db.exec(read('supabase/migrations/202610280004_hu001_preparacion_operativa.sql'));
  const provisionalEquivalencesMigration = read('supabase/migrations/202610280001_hu030_equivalencias_provisionales_crosland.sql');
  await db.exec(provisionalEquivalencesMigration);
  await db.exec(provisionalEquivalencesMigration);
  const provider = (await db.query<any>(`SELECT codpro FROM proveedor WHERE rucpro='20502913752'`)).rows[0].codpro;
  const model = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0].codmod;
  await db.exec(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod) VALUES
    (${provider},'SYNTH-MOTO','Vehiculo',${model}),(${provider},'SYNTH-ACC','Accesorio',NULL);`);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [ADMIN_UUID]);
  return db;
}

async function payloadImportacion(db: PGlite, identity: string) {
  const document = parsearFacturaUbl(xmlFixture);
  document.rucEmisor = '20502913752';
  document.rucComprador = '20555595469';
  document.idDocumento = identity;
  document.serie = identity.split('-')[0]!;
  document.numero = identity.split('-')[1]!;
  for (let index = 0; index < 2; index += 1) {
    document.lineas[index]!.pedidoLinea = `${identity}-ORDER-${index + 1}`;
    document.lineas[index]!.propiedadesPorCodigo['5015'] = [`ENGINE-${identity}-${index + 1}`];
    document.lineas[index]!.propiedadesPorCodigo['5019'] = [`CHASSIS-${identity}-${index + 1}`];
  }
  document.lineas.forEach((line, index) => { line.codigoExterno = index < 2 ? 'SYNTH-MOTO' : 'SYNTH-ACC'; });
  const model = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0].codmod;
  const classification = clasificarLineasFactura(document, [
    { codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo', codmod: String(model), activa: true },
    { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio', codmod: null, activa: true }
  ]);
  return {
    documento: document,
    lineas: document.lineas.map((line, index) => ({ ...line, ...classification[index]! })),
    advertencias: document.advertencias,
    checksumXml: createHash('sha256').update(xmlFixture).digest('hex'),
    origen: 'XML_Interno',
    gruposCalculados: agruparComprasFactura(classification)
  };
}

test('HU-030 Fase 3: migración incremental, wrappers y reserva atómica', async t => {
  const db = await crearDb();
  try {
    const indexes = (await db.query<any>(`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename='documentocompra'`)).rows;
    assert.ok(indexes.some((i: any) => i.indexname === 'uq_documentocompra_messageid'));
    assert.ok(!indexes.some((i: any) => i.indexname === 'uq_documentocompra_messageid_hash'
      || i.indexname === 'uq_documentocompra_messageid_legacy'));

    const privileges = (await db.query<any>(`SELECT
      has_function_privilege('authenticated','public.listar_equivalencias_importacion(text)','EXECUTE') human_list,
      has_function_privilege('authenticated','public.importar_documento_compra(jsonb)','EXECUTE') human_import,
      has_function_privilege('service_role','public.hu030_listar_equivalencias_tecnicas(text)','EXECUTE') tech_list,
      has_function_privilege('service_role','public.hu030_importar_documento_tecnico(jsonb)','EXECUTE') tech_import,
      has_function_privilege('anon','public.hu030_integracion_reservar_tecnico(text,text,bigint,text,text,text)','EXECUTE') anon_tech,
      has_function_privilege('service_role','public.hu030_integracion_finalizar_tecnico(uuid,text,text,text,text,bigint,text,text,boolean,text,text,jsonb,smallint)','EXECUTE') tech_finalize,
      has_function_privilege('authenticated','public.hu030_integracion_reservar_tecnico(text,text,bigint,text,text,text)','EXECUTE') auth_tech,
      has_function_privilege('anon','public.hu030_importar_documento_core(jsonb)','EXECUTE') anon_core,
      has_function_privilege('authenticated','public.hu030_importar_documento_core(jsonb)','EXECUTE') auth_core,
      has_function_privilege('service_role','public.hu030_importar_documento_core(jsonb)','EXECUTE') core_tech`)).rows[0];
    assert.deepEqual(privileges, { human_list: true, human_import: true, tech_list: true, tech_import: true, tech_finalize: true,
      anon_tech: false, auth_tech: false, anon_core: false, auth_core: false, core_tech: false });
    for (const table of ['recepcionintegracionfactura', 'intentointegracionfactura']) {
      assert.equal((await db.query<any>(`SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass`, [`public.${table}`])).rows[0].relrowsecurity, true);
      for (const role of ['anon','authenticated','service_role']) {
        assert.equal((await db.query<any>('SELECT has_table_privilege($1,$2,$3) yes', [role, `public.${table}`, 'SELECT'])).rows[0].yes, false);
      }
    }

    const human = (await db.query<any>(`SELECT public.listar_equivalencias_importacion('20502913752') r`)).rows[0].r;
    assert.ok(Array.isArray(human));
    const torito4vCodmod = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 4V GLP'`)).rows[0].codmod;
    const humanPoMapping = human.find((item: any) => item.codigoExterno === 'B3-4TLPGUG4V');
    assert.deepEqual(humanPoMapping, {
      codigoExterno: 'B3-4TLPGUG4V', clasificacion: 'Vehiculo', codmod: String(torito4vCodmod),
      activa: true, nombreModelo: 'Torito 4V GLP'
    });
    assert.equal(human.some((item: any) => item.codigoExterno === 'B2-BM150UG' || item.codigoExterno === 'B3-4TLPG250'), false);
    const humanBajaj = human.find((item: any) => item.codigoExterno === 'BAJAJVERDE');
    assert.equal(humanBajaj?.clasificacion, 'Accesorio');
    assert.equal(humanBajaj?.codmod, null);
    const humanPayload = await payloadImportacion(db, 'HUMAN-00000001');
    const humanResult = (await db.query<any>(`SELECT public.importar_documento_compra($1::jsonb) r`,
      [JSON.stringify(humanPayload)])).rows[0].r;
    assert.equal(humanResult.estadoDocumento, 'Importado');

    await t.test('HU-030 inicializa preparación pendiente y la reimportación no reinicia avances', async () => {
      const hu030Payload = await payloadImportacion(db, 'PREP-00003301');
      const imported = (await db.query<any>('SELECT public.importar_documento_compra($1::jsonb) r',
        [JSON.stringify(hu030Payload)])).rows[0].r;
      assert.equal(imported.estadoDocumento, 'Importado');
      assert.equal(imported.unidades.length, 2);
      const coduni = imported.unidades[0].coduni as string;
      const initial = (await db.query<any>('SELECT public.hu033_consultar_preparacion_unidad($1) r', [coduni])).rows[0].r;
      assert.equal(initial.actual.armado, 'Pendiente');
      assert.equal(initial.actual.techo.estado, 'Pendiente');
      assert.equal(initial.actual.techo.configuracion, null);
      assert.equal(initial.actual.preparacionCompleta, false);

      const advanced = (await db.query<any>(
        `SELECT public.hu033_actualizar_preparacion_unidad($1,'Armado','Terminado',1,NULL,'Interno',$2) r`,
        [coduni, 'HU033-HU030-REIMPORT-KEY']
      )).rows[0].r;
      assert.equal(advanced.armado, 'Terminado');
      assert.equal(advanced.version, '2');

      const inventarioAvanzado = (await db.query<any>(
        'SELECT public.hu001_consultar_inventario(NULL,NULL,NULL,NULL,NULL,NULL,100,0) r'
      )).rows[0].r;
      const unidadAvanzada = inventarioAvanzado.items.find((item: any) => item.coduni === coduni);
      assert.equal(unidadAvanzada.preparacionOperativa.armado, 'Terminado');
      assert.equal(unidadAvanzada.preparacionOperativa.version, '2');
      assert.equal('historial' in unidadAvanzada.preparacionOperativa, false);
      const estadoNoPreparacion = {
        ubicacionConfirmada: unidadAvanzada.ubicacionConfirmada,
        situacionComercial: unidadAvanzada.situacionComercial
      };

      const retried = (await db.query<any>('SELECT public.importar_documento_compra($1::jsonb) r',
        [JSON.stringify(hu030Payload)])).rows[0].r;
      assert.equal(retried.reintento, true);
      assert.equal(retried.unidades[0].coduni, coduni);
      const afterRetry = (await db.query<any>('SELECT public.hu033_consultar_preparacion_unidad($1) r', [coduni])).rows[0].r;
      assert.equal(afterRetry.actual.armado, 'Terminado');
      assert.equal(afterRetry.actual.version, '2');
      assert.equal(afterRetry.historial.length, 1);
      const inventarioReimportado = (await db.query<any>(
        'SELECT public.hu001_consultar_inventario(NULL,NULL,NULL,NULL,NULL,NULL,100,0) r'
      )).rows[0].r;
      const unidadReimportada = inventarioReimportado.items.find((item: any) => item.coduni === coduni);
      assert.equal(unidadReimportada.preparacionOperativa.armado, 'Terminado');
      assert.equal(unidadReimportada.preparacionOperativa.version, '2');
      assert.deepEqual({
        ubicacionConfirmada: unidadReimportada.ubicacionConfirmada,
        situacionComercial: unidadReimportada.situacionComercial
      }, estadoNoPreparacion);
    });

    await db.query(`SELECT set_config('request.jwt.claim.sub','',false)`);
    await assert.rejects(db.query(`SELECT public.listar_equivalencias_importacion('20502913752')`), (e: any) => e.code === '42501');
    await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [ADMIN_UUID]);
    const technicalPayload = await payloadImportacion(db, 'TECH-00000001');
    await db.exec('SET ROLE service_role');
    const technical = (await db.query<any>(`SELECT public.hu030_listar_equivalencias_tecnicas('20502913752') r`)).rows[0].r;
    assert.ok(Array.isArray(technical));
    const technicalPoMapping = technical.find((item: any) => item.codigoExterno === 'B3-4TLPGUG4V');
    assert.deepEqual(technicalPoMapping, humanPoMapping);
    assert.equal(technical.some((item: any) => item.codigoExterno === 'B2-BM150UG' || item.codigoExterno === 'B3-4TLPG250'), false);
    const technicalResult = (await db.query<any>(`SELECT public.hu030_importar_documento_tecnico($1::jsonb) r`,
      [JSON.stringify(technicalPayload)])).rows[0].r;
    assert.equal(technicalResult.estadoDocumento, 'Importado');
    const technicalRetry = (await db.query<any>(`SELECT public.hu030_importar_documento_tecnico($1::jsonb) r`,
      [JSON.stringify(technicalPayload)])).rows[0].r;
    assert.equal(technicalRetry.reintento, true);
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query(`SELECT public.hu030_listar_equivalencias_tecnicas('20502913752')`), (e: any) => e.code === '42501');
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE authenticated');
    await assert.rejects(db.query(`SELECT public.hu030_listar_equivalencias_tecnicas('20502913752')`), (e: any) => e.code === '42501');
    await assert.rejects(db.query(`SELECT public.hu030_importar_documento_core('{}'::jsonb)`), (e: any) => e.code === '42501');
    await db.exec('RESET ROLE');
    await db.exec('SET ROLE service_role');
    await assert.rejects(db.query(`SELECT public.hu030_importar_documento_core('{}'::jsonb)`), (e: any) => e.code === '42501');
    await db.exec('RESET ROLE');

    const reserve = async (nonce: string, message: string, xml: string, pdf: string | null = null) =>
      (await db.query<any>(`SELECT public.hu030_integracion_reservar_tecnico('test-key',$1,1792886400,$2,$3,$4) r`,
        [nonce,message,xml,pdf])).rows[0].r;
    const finalize = async (receipt: string, nonce: string, operation: string, state: string,
      document: number | null, xmlPath: string | null, pdfPath: string | null,
      pending: boolean | null, error: string | null, summary: unknown, status: number,
      verifiedPdf: string | null = null) =>
      (await db.query<any>(`SELECT public.hu030_integracion_finalizar_tecnico($1,'test-key',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) r`,
        [receipt,nonce,operation,state,document,xmlPath,pdfPath,pending,verifiedPdf,error,summary,status])).rows[0].r;
    const existingDocument = (await db.query<any>(`SELECT min(coddoc)::bigint coddoc FROM documentocompra`)).rows[0].coddoc as number;
    const first = await reserve('00000000-0000-4000-8000-000000000001','same-gmail','a'.repeat(64));
    const secondXmlSameGmail = await reserve('00000000-0000-4000-8000-000000000002','same-gmail','b'.repeat(64));
    assert.equal(first.resultado,'Nueva');
    assert.equal(secondXmlSameGmail.resultado,'Nueva');
    assert.notEqual(first.codrec,secondXmlSameGmail.codrec);
    assert.equal((await db.query<any>(`SELECT count(*)::int n FROM recepcionintegracionfactura WHERE gmailmessageid='same-gmail'`)).rows[0].n,2);

    const sameXmlDifferentGmail = await reserve('00000000-0000-4000-8000-000000000006','another-gmail','a'.repeat(64));
    assert.equal(sameXmlDifferentGmail.resultado,'Nueva');
    assert.notEqual(sameXmlDifferentGmail.codrec,first.codrec);

    const processing = await reserve('00000000-0000-4000-8000-000000000003','same-gmail','a'.repeat(64));
    assert.equal(processing.resultado,'Procesando');
    const repeatedNonce = await reserve('00000000-0000-4000-8000-000000000003','other-gmail','c'.repeat(64));
    assert.equal(repeatedNonce.resultado,'NONCE_REPETIDO');

    const concurrent = await Promise.all([
      reserve('00000000-0000-4000-8000-000000000007','parallel-gmail','7'.repeat(64)),
      reserve('00000000-0000-4000-8000-000000000008','parallel-gmail','7'.repeat(64))
    ]);
    assert.deepEqual(concurrent.map((item: any) => item.resultado).sort(), ['Nueva','Procesando']);
    const sameNonceConcurrent = await Promise.all([
      reserve('00000000-0000-4000-8000-000000000009','nonce-gmail','9'.repeat(64)),
      reserve('00000000-0000-4000-8000-000000000009','nonce-other','a'.repeat(64))
    ]);
    assert.equal(sameNonceConcurrent.filter((item: any) => item.resultado === 'NONCE_REPETIDO').length,1);

    await db.query(`UPDATE recepcionintegracionfactura SET estrec='Error' WHERE codrec=$1`, [first.codrec]);
    const retryable = await reserve('00000000-0000-4000-8000-000000000010','same-gmail','a'.repeat(64));
    assert.equal(retryable.resultado,'Reintentar');

    const declaredOnly = await reserve('00000000-0000-4000-8000-000000000029','declared-only','9'.repeat(64),'a'.repeat(64));
    assert.equal(declaredOnly.resultado,'Nueva');
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [declaredOnly.codrec])).rows[0].sha256pdf,null);
    assert.equal((await db.query<any>(`SELECT sha256pdfdeclarado FROM intentointegracionfactura WHERE coditi=$1`, [declaredOnly.coditi])).rows[0].sha256pdfdeclarado,'a'.repeat(64));
    await finalize(declaredOnly.codrec,'00000000-0000-4000-8000-000000000029','Procesar','Error',null,null,null,true,
      'HASH_PDF_NO_COINCIDE',null,400);
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [declaredOnly.codrec])).rows[0].sha256pdf,null);
    const declaredRetry = await reserve('00000000-0000-4000-8000-000000000030','declared-only','9'.repeat(64),'b'.repeat(64));
    assert.equal(declaredRetry.resultado,'Reintentar');
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [declaredOnly.codrec])).rows[0].sha256pdf,null);
    await finalize(declaredRetry.codrec,'00000000-0000-4000-8000-000000000030','Procesar','Error',null,null,null,true,
      'MULTIPART_INVALIDO',null,400);

    const staleA = await reserve('00000000-0000-4000-8000-000000000014','stale-gmail','b'.repeat(64),'1'.repeat(64));
    await db.query(`UPDATE recepcionintegracionfactura SET fecactualizacion=now()-interval '16 minutes' WHERE codrec=$1`, [staleA.codrec]);
    const staleB = await reserve('00000000-0000-4000-8000-000000000015','stale-gmail','b'.repeat(64),'1'.repeat(64));
    assert.equal(staleB.resultado,'Reintentar');
    assert.notEqual(staleB.coditi,staleA.coditi);
    const staleBefore = (await db.query<any>(`SELECT estrec,coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen,coditiactivo,fecactualizacion FROM recepcionintegracionfactura WHERE codrec=$1`, [staleA.codrec])).rows[0];
    const lost = await finalize(staleA.codrec, '00000000-0000-4000-8000-000000000014', 'Procesar', 'Completada',
      existingDocument, `documentos/${staleA.codrec}/original.xml`, `documentos/${staleA.codrec}/original.pdf`, false, null, { stale: true }, 201, '1'.repeat(64));
    assert.equal(lost.resultado,'LEASE_PERDIDO');
    assert.deepEqual((await db.query<any>(`SELECT estrec,coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen,coditiactivo,fecactualizacion FROM recepcionintegracionfactura WHERE codrec=$1`, [staleA.codrec])).rows[0], staleBefore);
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [staleA.codrec])).rows[0].sha256pdf,null);
    const winner = await finalize(staleB.codrec, '00000000-0000-4000-8000-000000000015', 'Procesar', 'Completada',
      existingDocument, `documentos/${staleB.codrec}/original.xml`, `documentos/${staleB.codrec}/original.pdf`, false, null, { owner: 'B' }, 201, '1'.repeat(64));
    assert.equal(winner.resultado,'Completada');
    assert.equal(winner.resumen.owner,'B');
    assert.equal((await db.query<any>(`SELECT coditiactivo FROM recepcionintegracionfactura WHERE codrec=$1`, [staleB.codrec])).rows[0].coditiactivo,null);
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [staleB.codrec])).rows[0].sha256pdf,'1'.repeat(64));
    assert.equal((await finalize(staleB.codrec, '00000000-0000-4000-8000-000000000015', 'SoloIntento', 'Error',
      null, null, null, null, 'RETRY_INVALIDO', null, 400)).resultado,'INTENTO_CERRADO');

    const immutableReceipt = await reserve('00000000-0000-4000-8000-000000000023','immutable-gmail','8'.repeat(64));
    const anotherDocument = (await db.query<any>(`SELECT max(coddoc)::bigint coddoc FROM documentocompra`)).rows[0].coddoc as number;
    assert.notEqual(anotherDocument, existingDocument);
    const immutablePath = `documentos/${immutableReceipt.codrec}/original.xml`;
    await db.query(`UPDATE recepcionintegracionfactura SET coddoc=$2,rutaxml=$3,rutapdf=$4,pdfpendiente=false,sha256pdf=$5 WHERE codrec=$1`,
      [immutableReceipt.codrec,existingDocument,immutablePath,`documentos/${immutableReceipt.codrec}/original.pdf`,'9'.repeat(64)]);
    const immutableBefore = (await db.query<any>(`SELECT coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen FROM recepcionintegracionfactura WHERE codrec=$1`, [immutableReceipt.codrec])).rows[0];
    const invariant = await finalize(immutableReceipt.codrec,'00000000-0000-4000-8000-000000000023','Procesar','Completada',
      anotherDocument,immutablePath,immutableBefore.rutapdf,true,null,{ changed:true },201);
    assert.equal(invariant.resultado,'INVARIANTE_RECEPCION');
    assert.deepEqual((await db.query<any>(`SELECT coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen FROM recepcionintegracionfactura WHERE codrec=$1`, [immutableReceipt.codrec])).rows[0],immutableBefore);

    const completedRetry = await reserve('00000000-0000-4000-8000-000000000016','stale-gmail','b'.repeat(64));
    assert.equal(completedRetry.resultado,'Completada');
    const durableBefore = (await db.query<any>(`SELECT estrec,coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen,fecactualizacion FROM recepcionintegracionfactura WHERE codrec=$1`, [staleA.codrec])).rows[0];
    await finalize(completedRetry.codrec, '00000000-0000-4000-8000-000000000016', 'SoloIntento', 'Error',
      null, null, null, null, 'MULTIPART_INVALIDO', null, 400);
    assert.deepEqual((await db.query<any>(`SELECT estrec,coddoc,rutaxml,rutapdf,pdfpendiente,coderrrec,resumen,fecactualizacion FROM recepcionintegracionfactura WHERE codrec=$1`, [staleA.codrec])).rows[0], durableBefore);
    assert.equal((await db.query<any>(`SELECT resultado,httpstatus FROM intentointegracionfactura WHERE nonce='00000000-0000-4000-8000-000000000016'`)).rows[0].resultado,'MULTIPART_INVALIDO');

    const pdfReceipt = await reserve('00000000-0000-4000-8000-000000000017','pdf-complete','c'.repeat(64));
    await db.query(`UPDATE recepcionintegracionfactura SET estrec='Completada',coddoc=$2,pdfpendiente=true,
      rutaxml=$3,coditiactivo=NULL,resumen=$4 WHERE codrec=$1`,
      [pdfReceipt.codrec,existingDocument,`documentos/${pdfReceipt.codrec}/original.xml`,
        { coddoc: String(existingDocument), estadoDocumento: 'Importado', conteos: { lineas: 1, vehiculos: 1, importados: 1, revision: 0 }, advertencias: [] }]);
    const pdfConcurrent = await Promise.all([
      reserve('00000000-0000-4000-8000-000000000018','pdf-complete','c'.repeat(64),'a'.repeat(64)),
      reserve('00000000-0000-4000-8000-000000000019','pdf-complete','c'.repeat(64),'b'.repeat(64))
    ]);
    assert.deepEqual(pdfConcurrent.map((item: any) => item.resultado).sort(), ['CompletarPdf','PdfProcesando']);
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [pdfReceipt.codrec])).rows[0].sha256pdf,null);
    const pdfOwner = pdfConcurrent.find((item: any) => item.resultado === 'CompletarPdf')!;
    const pdfWaiter = pdfConcurrent.find((item: any) => item.resultado === 'PdfProcesando')!;
    const pdfOwnerNonce = pdfOwner === pdfConcurrent[0]
      ? '00000000-0000-4000-8000-000000000018' : '00000000-0000-4000-8000-000000000019';
    const pdfWaiterNonce = pdfWaiter === pdfConcurrent[0]
      ? '00000000-0000-4000-8000-000000000018' : '00000000-0000-4000-8000-000000000019';
    assert.equal((await finalize(pdfReceipt.codrec,pdfWaiterNonce,'CompletarPdf','Completada',existingDocument,
      `documentos/${pdfReceipt.codrec}/original.xml`,`documentos/${pdfReceipt.codrec}/original.pdf`,false,null,null,200,'b'.repeat(64))).resultado,'INTENTO_CERRADO');
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [pdfReceipt.codrec])).rows[0].sha256pdf,null);
    const invalidOwnerResult = await finalize(pdfReceipt.codrec,pdfOwnerNonce,'CompletarPdf','Error',existingDocument,
      `documentos/${pdfReceipt.codrec}/original.xml`,null,true,'HASH_PDF_NO_COINCIDE',null,400);
    assert.equal(invalidOwnerResult.resultado,'HASH_PDF_NO_COINCIDE');
    assert.equal((await db.query<any>(`SELECT sha256pdf,pdfpendiente,coditiactivo FROM recepcionintegracionfactura WHERE codrec=$1`, [pdfReceipt.codrec])).rows[0].sha256pdf,null);
    const pdfRetry = await reserve('00000000-0000-4000-8000-000000000024','pdf-complete','c'.repeat(64),'b'.repeat(64));
    assert.equal(pdfRetry.resultado,'CompletarPdf');
    const pdfFinal = await finalize(pdfReceipt.codrec, pdfOwnerNonce,
      'CompletarPdf','Completada',existingDocument,`documentos/${pdfReceipt.codrec}/original.xml`,
      `documentos/${pdfReceipt.codrec}/original.pdf`,false,null,{ pdfPendiente:false },200,'b'.repeat(64));
    assert.equal(pdfFinal.resultado,'INTENTO_CERRADO');
    const pdfRetryFinal = await finalize(pdfReceipt.codrec,'00000000-0000-4000-8000-000000000024',
      'CompletarPdf','Completada',existingDocument,`documentos/${pdfReceipt.codrec}/original.xml`,
      `documentos/${pdfReceipt.codrec}/original.pdf`,false,null,{ pdfPendiente:false },200,'b'.repeat(64));
    assert.equal(pdfRetryFinal.resultado,'Completada');
    assert.equal((await db.query<any>(`SELECT pdfpendiente FROM recepcionintegracionfactura WHERE codrec=$1`, [pdfReceipt.codrec])).rows[0].pdfpendiente,false);
    assert.equal((await db.query<any>(`SELECT sha256pdf,rutapdf FROM recepcionintegracionfactura WHERE codrec=$1`, [pdfReceipt.codrec])).rows[0].sha256pdf,'b'.repeat(64));
    const changedPdf = await reserve('00000000-0000-4000-8000-000000000020','pdf-complete','c'.repeat(64),'e'.repeat(64));
    assert.equal(changedPdf.resultado,'PDF_EVIDENCIA_CONFLICTO');

    const pendingStorage = await reserve('00000000-0000-4000-8000-000000000025','pdf-storage-failure','2'.repeat(64));
    await db.query(`UPDATE recepcionintegracionfactura SET estrec='Completada',coddoc=$2,pdfpendiente=true,
      rutaxml=$3,coditiactivo=NULL,resumen=$4 WHERE codrec=$1`,
      [pendingStorage.codrec,existingDocument,`documentos/${pendingStorage.codrec}/original.xml`,
        { coddoc:String(existingDocument),estadoDocumento:'Importado',conteos:{lineas:1,vehiculos:1,importados:1,revision:0},advertencias:[] }]);
    const storageOwner = await reserve('00000000-0000-4000-8000-000000000026','pdf-storage-failure','2'.repeat(64),'a'.repeat(64));
    assert.equal(storageOwner.resultado,'CompletarPdf');
    await finalize(storageOwner.codrec,'00000000-0000-4000-8000-000000000026','CompletarPdf','Error',existingDocument,
      `documentos/${storageOwner.codrec}/original.xml`,null,true,'PDF_STORAGE_PENDING',null,503,'a'.repeat(64));
    const pendingEvidence = (await db.query<any>(`SELECT sha256pdf,rutapdf,pdfpendiente,coderrrec FROM recepcionintegracionfactura WHERE codrec=$1`, [storageOwner.codrec])).rows[0];
    assert.deepEqual(pendingEvidence,{ sha256pdf:'a'.repeat(64),rutapdf:null,pdfpendiente:true,coderrrec:'PDF_STORAGE_PENDING' });
    assert.equal((await reserve('00000000-0000-4000-8000-000000000027','pdf-storage-failure','2'.repeat(64),'b'.repeat(64))).resultado,'PDF_EVIDENCIA_CONFLICTO');
    const sameDeclaredRetry = await reserve('00000000-0000-4000-8000-000000000028','pdf-storage-failure','2'.repeat(64),'a'.repeat(64));
    assert.equal(sameDeclaredRetry.resultado,'CompletarPdf');
    const attemptWithDifferentVerifiedHash = await finalize(sameDeclaredRetry.codrec,'00000000-0000-4000-8000-000000000028',
      'CompletarPdf','Completada',existingDocument,`documentos/${sameDeclaredRetry.codrec}/original.xml`,
      `documentos/${sameDeclaredRetry.codrec}/original.pdf`,false,null,{ changed:true },200,'c'.repeat(64));
    assert.equal(attemptWithDifferentVerifiedHash.resultado,'PDF_EVIDENCIA_CONFLICTO');
    assert.deepEqual((await db.query<any>(`SELECT sha256pdf,rutapdf,pdfpendiente FROM recepcionintegracionfactura WHERE codrec=$1`, [sameDeclaredRetry.codrec])).rows[0],
      { sha256pdf:'a'.repeat(64),rutapdf:null,pdfpendiente:true });
    const sameDeclaredRetryAgain = await reserve('00000000-0000-4000-8000-000000000031','pdf-storage-failure','2'.repeat(64),'a'.repeat(64));
    assert.equal(sameDeclaredRetryAgain.resultado,'CompletarPdf');
    await finalize(sameDeclaredRetryAgain.codrec,'00000000-0000-4000-8000-000000000031','CompletarPdf','Completada',existingDocument,
      `documentos/${sameDeclaredRetryAgain.codrec}/original.xml`,`documentos/${sameDeclaredRetryAgain.codrec}/original.pdf`,false,null,
      { pdfPendiente:false },200,'a'.repeat(64));
    assert.deepEqual((await db.query<any>(`SELECT sha256pdf,pdfpendiente FROM recepcionintegracionfactura WHERE codrec=$1`, [sameDeclaredRetryAgain.codrec])).rows[0],
      { sha256pdf:'a'.repeat(64),pdfpendiente:false });

    const conflictReceipt = await reserve('00000000-0000-4000-8000-000000000021','conflict-gmail','f'.repeat(64));
    await finalize(conflictReceipt.codrec,'00000000-0000-4000-8000-000000000021','Procesar','Completada',existingDocument,
      `documentos/${conflictReceipt.codrec}/original.xml`,null,true,'CONFLICTO_DOCUMENTAL',
      { coddoc:String(existingDocument),estadoDocumento:'Pendiente de revision',conteos:{ lineas:1,vehiculos:1,importados:0,revision:1 },advertencias:[] },409);
    const conflictRetry = await reserve('00000000-0000-4000-8000-000000000022','conflict-gmail','f'.repeat(64));
    assert.equal(conflictRetry.resultado,'ConflictoDocumental');
    assert.equal(conflictRetry.coddoc,String(existingDocument));

    const conflictPdf = await reserve('00000000-0000-4000-8000-000000000033','conflict-pdf-gmail','6'.repeat(64),'a'.repeat(64));
    assert.equal(conflictPdf.resultado,'Nueva');
    const conflictPdfSummary = { coddoc:String(existingDocument),estadoDocumento:'Pendiente de revision',
      pdfPendiente:true,conteos:{ lineas:1,vehiculos:1,importados:0,revision:1 },advertencias:[] };
    const conflictPdfFinal = await finalize(conflictPdf.codrec,'00000000-0000-4000-8000-000000000033','Procesar','Completada',existingDocument,
      `documentos/${conflictPdf.codrec}/original.xml`,null,true,'CONFLICTO_DOCUMENTAL',conflictPdfSummary,409,'a'.repeat(64));
    assert.equal(conflictPdfFinal.resultado,'CONFLICTO_DOCUMENTAL');
    assert.notEqual(conflictPdfFinal.resultado,'INVARIANTE_RECEPCION');
    const conflictPdfStored = (await db.query<any>(`SELECT estrec,coddoc,coderrrec,sha256pdf,rutapdf,pdfpendiente,resumen
      FROM recepcionintegracionfactura WHERE codrec=$1`, [conflictPdf.codrec])).rows[0];
    assert.equal(conflictPdfStored.estrec,'Completada');
    assert.equal(conflictPdfStored.coddoc,existingDocument);
    assert.equal(conflictPdfStored.coderrrec,'CONFLICTO_DOCUMENTAL');
    assert.equal(conflictPdfStored.sha256pdf,'a'.repeat(64));
    assert.equal(conflictPdfStored.rutapdf,null);
    assert.equal(conflictPdfStored.pdfpendiente,true);
    assert.equal(conflictPdfStored.resumen.estadoDocumento,'Pendiente de revision');

    const conflictPdfDifferentRetry = await reserve('00000000-0000-4000-8000-000000000034','conflict-pdf-gmail','6'.repeat(64),'b'.repeat(64));
    assert.equal(conflictPdfDifferentRetry.resultado,'PDF_EVIDENCIA_CONFLICTO');
    const conflictPdfRetry = await reserve('00000000-0000-4000-8000-000000000035','conflict-pdf-gmail','6'.repeat(64),'a'.repeat(64));
    assert.equal(conflictPdfRetry.resultado,'CompletarPdf');
    const completedConflictPdf = await finalize(conflictPdfRetry.codrec,'00000000-0000-4000-8000-000000000035','CompletarPdf','Completada',existingDocument,
      `documentos/${conflictPdfRetry.codrec}/original.xml`,`documentos/${conflictPdfRetry.codrec}/original.pdf`,false,
      'CONFLICTO_DOCUMENTAL',{ ...conflictPdfSummary,pdfPendiente:false,reintento:true },409,'a'.repeat(64));
    assert.equal(completedConflictPdf.resultado,'CONFLICTO_DOCUMENTAL');
    const conflictPdfCompleted = (await db.query<any>(`SELECT estrec,coderrrec,sha256pdf,rutapdf,pdfpendiente,resumen
      FROM recepcionintegracionfactura WHERE codrec=$1`, [conflictPdf.codrec])).rows[0];
    assert.equal(conflictPdfCompleted.estrec,'Completada');
    assert.equal(conflictPdfCompleted.coderrrec,'CONFLICTO_DOCUMENTAL');
    assert.equal(conflictPdfCompleted.sha256pdf,'a'.repeat(64));
    assert.equal(conflictPdfCompleted.rutapdf,`documentos/${conflictPdf.codrec}/original.pdf`);
    assert.equal(conflictPdfCompleted.pdfpendiente,false);
    assert.equal(conflictPdfCompleted.resumen.estadoDocumento,'Pendiente de revision');

    const addedPdf = await reserve('00000000-0000-4000-8000-000000000011','same-gmail','a'.repeat(64),'c'.repeat(64));
    assert.equal(addedPdf.resultado,'Procesando');
    assert.equal(addedPdf.sha256Pdf,null);
    const samePdf = await reserve('00000000-0000-4000-8000-000000000012','same-gmail','a'.repeat(64),'c'.repeat(64));
    assert.equal(samePdf.resultado,'Procesando');
    const changedPdfAfterRetry = await reserve('00000000-0000-4000-8000-000000000013','same-gmail','a'.repeat(64),'f'.repeat(64));
    assert.equal(changedPdfAfterRetry.resultado,'Procesando');

    const withPdf = await reserve('00000000-0000-4000-8000-000000000004','pdf-gmail','d'.repeat(64),'e'.repeat(64));
    assert.equal(withPdf.resultado,'Nueva');
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [withPdf.codrec])).rows[0].sha256pdf,null);
    const concurrentDeclaration = await reserve('00000000-0000-4000-8000-000000000005','pdf-gmail','d'.repeat(64),'f'.repeat(64));
    assert.equal(concurrentDeclaration.resultado,'Procesando');
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [withPdf.codrec])).rows[0].sha256pdf,null);
    await finalize(withPdf.codrec,'00000000-0000-4000-8000-000000000004','Procesar','Completada',existingDocument,
      `documentos/${withPdf.codrec}/original.xml`,`documentos/${withPdf.codrec}/original.pdf`,false,null,
      { pdfPendiente:false },201,'e'.repeat(64));
    assert.equal((await db.query<any>(`SELECT sha256pdf FROM recepcionintegracionfactura WHERE codrec=$1`, [withPdf.codrec])).rows[0].sha256pdf,'e'.repeat(64));
    const confirmedHashConflict = await reserve('00000000-0000-4000-8000-000000000032','pdf-gmail','d'.repeat(64),'f'.repeat(64));
    assert.equal(confirmedHashConflict.resultado,'PDF_EVIDENCIA_CONFLICTO');
  } finally {
    await db.close();
  }
});
