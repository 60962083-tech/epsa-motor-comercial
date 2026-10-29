import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

import { agruparComprasFactura } from '../src/utils/factura.importacion.agrupacion.js';
import { clasificarLineasFactura } from '../src/utils/factura.importacion.clasificacion.js';
import { parsearFacturaUbl } from '../src/utils/factura.importacion.xml.parser.js';
import type { FacturaUblParseada } from '../src/types/factura.importacion.types.js';

const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';
const ACTOR_TECNICO_UUID = '9a1d7d2e-2d30-4f5a-8b90-030000000001';
const fixture = readFileSync('tests/fixtures/factura-importacion/factura_valida.xml');
const base = readFileSync('tests/fixtures/esquema-base.sql', 'utf8');
const hu026 = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
const hu034 = readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8');
const hu002 = readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8');
const hu003 = readFileSync('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql', 'utf8');
const hu001 = readFileSync('supabase/migrations/202610210001_hu001_consulta_inventario.sql', 'utf8');
const hu030a = readFileSync('supabase/migrations/202610240001_hu030_modelo_documental.sql', 'utf8');
const hu030b = readFileSync('supabase/migrations/202610240002_hu030_ajustes_modelo_documental.sql', 'utf8');
const hu030c = readFileSync('supabase/migrations/202610240003_hu030_importacion_transaccional.sql', 'utf8');

async function crearContexto(opciones: { omitirActorTecnico?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text NOT NULL UNIQUE);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
  await db.exec(base);
  await db.exec(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Ubicación inicial sintética','Almacen');`);
  await db.exec(hu026);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${ADMIN_UUID}','admin-factura@test.local');
    INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
    INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
      VALUES ('${ADMIN_UUID}',1,'Admin','Sintético','admin-factura@test.local');
    INSERT INTO tipomotocar(nomtmo) VALUES ('QA sintético');
    INSERT INTO modelo(codtmo,nommod,marmod,desmod,carmod,estmod)
      VALUES (1,'Torito 250 4V GLP','Bajaj','Modelo sintético','Ficha sintética','Publicado');`);
  if (!opciones.omitirActorTecnico) {
    await db.query('INSERT INTO auth.users(id,email) VALUES ($1,$2)', [ACTOR_TECNICO_UUID, 'integracion.facturas@epsa.internal']);
  }
  await db.exec(hu034);
  await db.exec(hu002);
  await db.exec(hu003);
  await db.exec(hu001);
  await db.exec(hu030a);
  await db.exec(hu030b);
  try {
    await db.exec(hu030c);
    await db.exec(hu030c);
  } catch (error) {
    await db.close();
    throw error;
  }
  const provider = (await db.query<any>(`SELECT codpro FROM proveedor WHERE rucpro='20502913752'`)).rows[0].codpro as string;
  const model = (await db.query<any>(`SELECT codmod FROM modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0].codmod as string;
  await db.exec(`INSERT INTO equivalenciaproducto(codpro,codext,claequ,codmod) VALUES
    (${provider},'SYNTH-MOTO','Vehiculo',${model}),(${provider},'SYNTH-ACC','Accesorio',NULL);`);
  await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [ADMIN_UUID]);
  const location = (await db.query<any>(`SELECT codubi FROM ubicacionclave WHERE claubi='ALMACEN_CROSLAND_ANCON'`)).rows[0].codubi as string;
  return { db, provider: String(provider), model: String(model), location: String(location) };
}

function construirPayload(
  model: string,
  opts: { id?: string; checksum?: string; codigoDesconocido?: boolean; allDesconocido?: boolean;
    duplicarMotor?: boolean; duplicarChasis?: boolean; motorExistente?: string; chasisExistente?: string;
    faltaMotorSegundaLinea?: boolean } = {}
) {
  const document = parsearFacturaUbl(fixture) as FacturaUblParseada;
  document.rucEmisor = '20502913752';
  document.razonSocialEmisor = 'Crosland Proveedor Sintético';
  document.rucComprador = '20555595469';
  if (opts.id) {
    document.idDocumento = opts.id;
    document.serie = opts.id.split('-')[0]!;
    document.numero = opts.id.split('-')[1]!;
    document.lineas[0]!.pedidoLinea = `ORDER-${opts.id}-01`;
    document.lineas[1]!.pedidoLinea = `ORDER-${opts.id}-02`;
    document.lineas[0]!.propiedadesPorCodigo['5015'] = [`ENGINE-${opts.id}-01`];
    document.lineas[0]!.propiedadesPorCodigo['5019'] = [`CHASSIS-${opts.id}-01`];
    document.lineas[1]!.propiedadesPorCodigo['5015'] = [`ENGINE-${opts.id}-02`];
    document.lineas[1]!.propiedadesPorCodigo['5019'] = [`CHASSIS-${opts.id}-02`];
  }
  if (opts.codigoDesconocido) document.lineas[3]!.codigoExterno = 'CODIGO-SIN-EQUIVALENCIA';
  if (opts.allDesconocido) document.lineas.forEach((line, index) => { line.codigoExterno = `UNKNOWN-${index}`; });
  if (opts.duplicarMotor) {
    document.lineas[1]!.propiedadesPorCodigo['5015'] = [...document.lineas[0]!.propiedadesPorCodigo['5015']!];
  }
  if (opts.duplicarChasis) {
    document.lineas[1]!.propiedadesPorCodigo['5019'] = [...document.lineas[0]!.propiedadesPorCodigo['5019']!];
  }
  if (opts.faltaMotorSegundaLinea) delete document.lineas[1]!.propiedadesPorCodigo['5015'];
  if (opts.motorExistente) document.lineas[0]!.propiedadesPorCodigo['5015'] = [opts.motorExistente];
  if (opts.chasisExistente) document.lineas[0]!.propiedadesPorCodigo['5019'] = [opts.chasisExistente];
  const equivalencias = [
    { codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo' as const, codmod: model, activa: true },
    { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio' as const, codmod: null, activa: true }
  ];
  const clasificacion = clasificarLineasFactura(document, equivalencias);
  return {
    documento: document,
    lineas: document.lineas.map((line, index) => ({ ...line, ...clasificacion[index]! })),
    advertencias: document.advertencias,
    checksumXml: opts.checksum ?? createHash('sha256').update(fixture).digest('hex'),
    origen: 'XML_Interno',
    gruposCalculados: agruparComprasFactura(clasificacion)
  };
}

async function importar(db: PGlite, payload: ReturnType<typeof construirPayload>) {
  return (await db.query<any>('SELECT public.importar_documento_compra($1::jsonb) AS resultado', [JSON.stringify(payload)])).rows[0].resultado;
}

test('HU-030 Fase 2: importación transaccional compatible con HU-001/002/003/034', async (t) => {
  const { db, provider, model, location } = await crearContexto();
  try {
    const firstPayload = construirPayload(model);
    const first = await importar(db, firstPayload);

    await t.test('documento nuevo persiste cabecera y líneas, agrupa dos motos y excluye accesorios', async () => {
      assert.equal(first.estadoDocumento, 'Importado');
      assert.equal(first.reintento, false);
      assert.equal(first.conteos.lineas, 4);
      assert.equal(first.conteos.vehiculos, 2);
      assert.equal(first.conteos.importados, 2);
      assert.equal(first.compras.length, 1);
      assert.equal(first.compras[0].codmod, model);
      assert.equal(first.compras[0].color, 'Negro');
      assert.equal(first.compras[0].cantidad, 2);
      assert.equal(first.compras[0].tipoVinculo, 'Automatico');
      assert.equal((await db.query<any>('SELECT estcom FROM compra WHERE codcom=$1', [first.compras[0].codcom])).rows[0].estcom, 'Identificada');
      assert.equal(first.unidades.length, 2);
      assert.ok(first.unidades.every((unit: any) => unit.motorEnmascarado.includes('***') && unit.chasisEnmascarado.includes('***')));
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM unidad')).rows[0].n, 2);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM compra WHERE codcom IN
        (SELECT codcom FROM documentocompracompra WHERE coddoc=$1)`, [first.coddoc])).rows[0].n, 1);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM lineadocumentocompra WHERE coddoc=$1` ,[first.coddoc])).rows[0].n, 4);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM vehiculodocumento v JOIN lineadocumentocompra l USING(codlin) WHERE l.coddoc=$1` ,[first.coddoc])).rows[0].n, 2);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM lineadocumentocompra WHERE coddoc=$1 AND claext='Accesorio' AND estlin='Procesada'`, [first.coddoc])).rows[0].n, 2);
      const units = (await db.query<any>(`SELECT u.codubi,u.codpro,u.coluni,u.estcomuni,u.codcom,u.nummotuni,u.chauni
        FROM unidad u ORDER BY u.coduni`)).rows;
      assert.ok(units.every((unit: any) => String(unit.codubi) === location));
      assert.ok(units.every((unit: any) => unit.codpro === null));
      assert.ok(units.every((unit: any) => unit.coluni === 'Negro'));
      assert.ok(units.every((unit: any) => unit.estcomuni === 'No disponible'));
      assert.equal(new Set(units.map((unit: any) => unit.codcom)).size, 1);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM factura_compra WHERE codcom=$1`, [first.compras[0].codcom])).rows[0].n, 1);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM referenciacompra WHERE codpro=$1 AND tipref='PedidoCrosland' AND estref='Activa'`, [provider])).rows[0].n, 2);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM documentocompracompra WHERE coddoc=$1`, [first.coddoc])).rows[0].n, 1);
      const orders = (await db.query<any>(`SELECT v.pedidocrosland FROM vehiculodocumento v JOIN lineadocumentocompra l USING(codlin)
        WHERE l.coddoc=$1 ORDER BY v.codvehdoc`, [first.coddoc])).rows.map((row: any) => row.pedidocrosland);
      assert.deepEqual(orders, ['ORDER-SYNTH-0001','ORDER-SYNTH-0002']);
      const hu001 = (await db.query<any>('SELECT public.hu001_consultar_inventario(NULL,NULL,NULL,NULL,NULL,NULL,50,0) r')).rows[0].r;
      assert.equal(hu001.total, 2);
      assert.equal(hu001.items.length, 2);
      const hu002 = (await db.query<any>('SELECT public.hu002_consultar_unidades($1) r', [first.compras[0].codcom])).rows[0].r;
      assert.equal(hu002.cantidad_identificada, 2);
      assert.equal(hu002.factura.cantidad_motos, 2);
      const hu034 = (await db.query<any>('SELECT public.hu034_obtener_compra($1) r', [first.compras[0].codcom])).rows[0].r;
      assert.equal(hu034.cancom, 2);
    });

    await t.test('reintento conserva IDs, crea otro intento y no duplica nada', async () => {
      const stateBefore = (await db.query<any>('SELECT estcom FROM compra WHERE codcom=$1', [first.compras[0].codcom])).rows[0].estcom;
      const retry = await importar(db, firstPayload);
      assert.equal(retry.reintento, true);
      assert.deepEqual(retry.compras.map((buy: any) => buy.codcom), first.compras.map((buy: any) => buy.codcom));
      assert.deepEqual(retry.unidades.map((unit: any) => unit.coduni), first.unidades.map((unit: any) => unit.coduni));
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM documentocompra')).rows[0].n, 1);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM lineadocumentocompra')).rows[0].n, 4);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM compra')).rows[0].n, 1);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM unidad')).rows[0].n, 2);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM vehiculodocumento')).rows[0].n, 2);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM referenciacompra')).rows[0].n, 2);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM documentocompracompra')).rows[0].n, 1);
      const attempts = (await db.query<any>('SELECT count(*)::int n FROM intentodocumento WHERE coddoc=$1', [first.coddoc])).rows[0].n;
      assert.equal(attempts, 2);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM intentodocumento WHERE coddoc=$1 AND resint='Procesando' AND fecfin IS NULL`, [first.coddoc])).rows[0].n, 0);
      const stateAfter = (await db.query<any>('SELECT estcom FROM compra WHERE codcom=$1', [first.compras[0].codcom])).rows[0].estcom;
      assert.equal(stateBefore, 'Identificada');
      assert.equal(stateAfter, stateBefore);
    });

    await t.test('mismo documento con checksum distinto no reemplaza el XML y deja conflicto revisable', async () => {
      const conflict = await importar(db, construirPayload(model, { checksum: 'f'.repeat(64) }));
      assert.equal(conflict.coddoc, first.coddoc);
      assert.equal(conflict.estadoDocumento, 'Pendiente de revision');
      assert.equal(conflict.error, 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO');
      assert.equal((await db.query<any>('SELECT sha256xml FROM documentocompra WHERE coddoc=$1', [first.coddoc])).rows[0].sha256xml,
        createHash('sha256').update(fixture).digest('hex'));
    });

    await t.test('reintento idéntico no restablece ubicación ni estado operacional de unidades existentes', async () => {
      const other = (await db.query<any>(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Ubicación QA secundaria','Almacen') RETURNING codubi`)).rows[0].codubi;
      await db.exec(`UPDATE unidad SET codubi=${other},estcomuni='Reservada',dettecuni='Conservación de prueba';`);
      const retry = await importar(db, firstPayload);
      assert.equal(retry.estadoDocumento, 'Importado');
      const actual = (await db.query<any>('SELECT codubi,estcomuni,dettecuni FROM unidad ORDER BY coduni')).rows;
      assert.ok(actual.every((unit: any) => String(unit.codubi) === String(other)));
      assert.ok(actual.every((unit: any) => unit.estcomuni === 'Reservada' && unit.dettecuni === 'Conservación de prueba'));
    });

    await t.test('código desconocido produce importación parcial sin compra ni unidad adicional para accesorio', async () => {
      const partial = await importar(db, construirPayload(model, { id: 'S002-00000002', codigoDesconocido: true }));
      assert.equal(partial.estadoDocumento, 'Importado parcialmente');
      assert.ok(partial.lineasRevision.some((line: any) => line.motivo === 'CODIGO_SIN_EQUIVALENCIA'));
      assert.equal(partial.compras.length, 1);
      assert.equal(partial.compras[0].cantidad, 2);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM unidad')).rows[0].n, 4);
    });

    await t.test('motor duplicado dentro del mismo documento deja ambos candidatos en revisión', async () => {
      const duplicate = await importar(db, construirPayload(model, { id: 'S003-00000003', duplicarMotor: true }));
      assert.equal(duplicate.estadoDocumento, 'Importado parcialmente');
      assert.equal(duplicate.compras.length, 0);
      assert.equal(duplicate.conteos.importados, 0);
      assert.ok(duplicate.lineasRevision.some((line: any) => line.motivo === 'MOTOR_DUPLICADO_EN_DOCUMENTO'));
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM unidad')).rows[0].n, 4);
    });

    await t.test('chasis duplicado dentro del mismo documento no crea unidades duplicadas', async () => {
      const duplicate = await importar(db, construirPayload(model, { id: 'S008-00000008', duplicarChasis: true }));
      assert.equal(duplicate.conteos.importados, 0);
      assert.ok(duplicate.lineasRevision.some((line: any) => line.motivo === 'CHASIS_DUPLICADO_EN_DOCUMENTO'));
    });

    await t.test('serie ya registrada bloquea solo el vehículo afectado', async () => {
      await db.exec(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom) VALUES (${model},1,'Negro',1,'Pendiente de factura');
        INSERT INTO factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
          SELECT codcom,'Manual sintético','MANUAL-001','2026-10-20',1,1 FROM compra ORDER BY codcom DESC LIMIT 1;
        INSERT INTO unidad(codcom,codmod,nummotuni,chauni,coluni)
          SELECT codcom,${model},'ENGINE-ALREADY-USED','CHASSIS-ALREADY-USED','Negro' FROM compra ORDER BY codcom DESC LIMIT 1;`);
      const duplicate = await importar(db, construirPayload(model, { id: 'S004-00000004', motorExistente: 'ENGINE-ALREADY-USED' }));
      assert.equal(duplicate.estadoDocumento, 'Importado parcialmente');
      assert.ok(duplicate.lineasRevision.some((line: any) => line.motivo === 'MOTOR_YA_REGISTRADO'));
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM unidad WHERE nummotuni='ENGINE-ALREADY-USED'`)).rows[0].n, 1);
      assert.equal(duplicate.conteos.importados, 1);
      const chassisDuplicate = await importar(db, construirPayload(model, { id: 'S009-00000009', chasisExistente: 'CHASSIS-ALREADY-USED' }));
      assert.ok(chassisDuplicate.lineasRevision.some((line: any) => line.motivo === 'CHASIS_YA_REGISTRADO'));
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM unidad WHERE chauni='CHASSIS-ALREADY-USED'`)).rows[0].n, 1);
    });

    await t.test('conciliación exacta por pedido reutiliza compra compatible y no crea otra', async () => {
      const orderPayload = construirPayload(model, { id: 'S005-00000005' });
      const existing = (await db.query<any>(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom)
        VALUES (${model},1,'Negro',2,'Pendiente de factura') RETURNING codcom`)).rows[0].codcom;
      await db.exec(`INSERT INTO factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES (${existing},'Crosland Proveedor Sintético','S005-00000005','2026-10-20',2,1);
        INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
        VALUES (${existing},${provider},'PedidoCrosland','ORDER-S005-00000005-01','ORDER-S005-00000005-01',1),
               (${existing},${provider},'PedidoCrosland','ORDER-S005-00000005-02','ORDER-S005-00000005-02',1);`);
      const reconciled = await importar(db, orderPayload);
      assert.equal(reconciled.estadoDocumento, 'Importado');
      assert.equal(reconciled.compras.length, 1);
      assert.equal(reconciled.compras[0].codcom, String(existing));
      assert.equal(reconciled.compras[0].tipoVinculo, 'Conciliado');
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM compra WHERE codcom=$1', [existing])).rows[0].n, 1);
      assert.equal((await db.query<any>('SELECT estcom FROM compra WHERE codcom=$1', [existing])).rows[0].estcom, 'Identificada');
    });

    await t.test('conciliación manual incompleta deja la compra Pendiente de identificación', async () => {
      const payload = construirPayload(model, { id: 'S016-00000016', faltaMotorSegundaLinea: true });
      const manual = (await db.query<any>(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom)
        VALUES (${model},1,'Negro',2,'Pendiente de factura') RETURNING codcom`)).rows[0].codcom;
      await db.exec(`INSERT INTO factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES (${manual},'Proveedor QA','PARTIAL-001','2026-10-20',2,1);
        INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
        VALUES (${manual},${provider},'PedidoCrosland','ORDER-S016-00000016-01','ORDER-S016-00000016-01',1);`);
      const result = await importar(db, payload);
      assert.equal(result.compras.length, 1);
      assert.equal(result.compras[0].codcom, String(manual));
      assert.equal(result.unidades.length, 1);
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM unidad WHERE codcom=$1', [manual])).rows[0].n, 1);
      assert.equal((await db.query<any>('SELECT estcom FROM compra WHERE codcom=$1', [manual])).rows[0].estcom, 'Pendiente de identificación');
    });

    await t.test('la RPC valida RUC comprador, tipo, moneda, identidad y cantidad declarada', async () => {
      const invalidaciones = [
        (payload: ReturnType<typeof construirPayload>) => { payload.documento.rucComprador = '20123456789'; },
        (payload: ReturnType<typeof construirPayload>) => { payload.documento.tipoDocumento = '07'; },
        (payload: ReturnType<typeof construirPayload>) => { payload.documento.moneda = 'USD'; },
        (payload: ReturnType<typeof construirPayload>) => { payload.documento.cantidadLineasDeclarada = '3'; },
        (payload: ReturnType<typeof construirPayload>) => { payload.documento.idDocumento = 'OTRA-IDENTIDAD'; }
      ];
      let numeroCasoFiscal = 0;
      for (const invalidar of invalidaciones) {
        const payload = construirPayload(model, { id: `FISCAL-${String(++numeroCasoFiscal).padStart(8, '0')}` });
        invalidar(payload);
        await assert.rejects(importar(db, payload), (error: any) => error.code === 'PT400');
      }
      const proveedorNoAutorizado = construirPayload(model, { id: 'FISCAL-00000017' });
      proveedorNoAutorizado.documento.rucEmisor = '20999999999';
      await assert.rejects(importar(db, proveedorNoAutorizado), (error: any) => error.code === 'PT404');
    });

    await t.test('pedidos que apuntan a compras distintas quedan ambiguos sin crear compras', async () => {
      const payload = construirPayload(model, { id: 'S010-00000010' });
      const buys = (await db.query<any>(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom)
        VALUES (${model},1,'Negro',1,'Pendiente de factura'),(${model},1,'Negro',1,'Pendiente de factura') RETURNING codcom`)).rows;
      await db.exec(`INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
        VALUES (${buys[0].codcom},${provider},'PedidoCrosland','ORDER-S010-00000010-01','ORDER-S010-00000010-01',1),
               (${buys[1].codcom},${provider},'PedidoCrosland','ORDER-S010-00000010-02','ORDER-S010-00000010-02',1);`);
      const ambiguous = await importar(db, payload);
      assert.equal(ambiguous.compras.length, 0);
      assert.equal(ambiguous.estadoDocumento, 'Importado parcialmente');
      assert.ok(ambiguous.lineasRevision.every((line: any) => line.motivo === 'CONCILIACION_AMBIGUA'));
    });

    await t.test('compra manual aún sin factura no recibe una cantidad de factura inventada', async () => {
      const payload = construirPayload(model, { id: 'S013-00000013' });
      const manual = (await db.query<any>(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom)
        VALUES (${model},1,'Negro',3,'Pendiente de factura') RETURNING codcom`)).rows[0].codcom;
      await db.exec(`INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
        VALUES (${manual},${provider},'PedidoCrosland','ORDER-S013-00000013-01','ORDER-S013-00000013-01',1);`);
      const before = (await db.query<any>('SELECT count(*)::int n FROM compra')).rows[0].n;
      const result = await importar(db, payload);
      assert.equal(result.compras.length, 0);
      assert.ok(result.lineasRevision.some((line: any) => line.motivo === 'CONCILIACION_INCOMPATIBLE'));
      assert.equal((await db.query<any>('SELECT count(*)::int n FROM compra')).rows[0].n, before);
    });

    await t.test('compra manual conciliada respeta su capacidad restante', async () => {
      const payload = construirPayload(model, { id: 'S015-00000015' });
      const manual = (await db.query<any>(`INSERT INTO compra(codmod,codusu,colcom,cancom,estcom)
        VALUES (${model},1,'Negro',1,'Pendiente de factura') RETURNING codcom`)).rows[0].codcom;
      await db.exec(`INSERT INTO factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES (${manual},'Proveedor QA','CAPACITY-001','2026-10-20',1,1);
        INSERT INTO referenciacompra(codcom,codpro,tipref,valreforiginal,valrefnormalizado,codusuaut)
        VALUES (${manual},${provider},'PedidoCrosland','ORDER-S015-00000015-01','ORDER-S015-00000015-01',1);`);
      const result = await importar(db, payload);
      assert.equal(result.compras.length, 0);
      assert.ok(result.lineasRevision.some((line: any) => line.motivo === 'CONCILIACION_INCOMPATIBLE'));
    });

    await t.test('la RPC vuelve a resolver solo equivalencias activas en PostgreSQL', async () => {
      const payload = construirPayload(model, { id: 'S014-00000014' });
      await db.exec(`UPDATE equivalenciaproducto SET estequ=false WHERE codpro=${provider} AND codext='SYNTH-MOTO';`);
      const stale = await importar(db, payload);
      await db.exec(`UPDATE equivalenciaproducto SET estequ=true WHERE codpro=${provider} AND codext='SYNTH-MOTO';`);
      assert.ok(stale.lineasRevision.some((line: any) => line.motivo === 'CODIGO_SIN_EQUIVALENCIA'));
      assert.equal(stale.compras.length, 0);
      assert.equal((await db.query<any>(`SELECT count(*)::int n FROM modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0].n, 1);
    });

    await t.test('sin líneas importables queda Pendiente de revision', async () => {
      const none = await importar(db, construirPayload(model, { id: 'S011-00000011', allDesconocido: true }));
      assert.equal(none.estadoDocumento, 'Pendiente de revision');
      assert.equal(none.compras.length, 0);
      assert.equal(none.unidades.length, 0);
    });

    await t.test('autorización y aislamiento de tablas permanecen cerrados', async () => {
      const technical = (await db.query<any>(`SELECT u.nomusu,u.apepatusu,u.corusu,r.nomrol,u.uuidusu
        FROM usuario u JOIN rol r USING(codrol) WHERE u.corusu='integracion.facturas@epsa.internal'`)).rows[0];
      assert.deepEqual(technical, { nomusu: 'Integracion', apepatusu: 'Facturas', corusu: 'integracion.facturas@epsa.internal', nomrol: 'Administradora', uuidusu: '9a1d7d2e-2d30-4f5a-8b90-030000000001' });
      assert.equal((await db.query<any>(`SELECT u.uuidusu FROM usuario u JOIN auth.users a ON a.id=u.uuidusu
        WHERE lower(a.email)='integracion.facturas@epsa.internal'`)).rows[0].uuidusu, ACTOR_TECNICO_UUID);
      assert.doesNotMatch(hu030c, /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+auth\.users\b/i);
      assert.doesNotMatch(hu030c, /9a1d7d2e-2d30-4f5a-8b90-030000000001/i);
      for (const table of ['documentocompra','lineadocumentocompra','vehiculodocumento','documentocompracompra','referenciacompra','intentodocumento','compra','unidad']) {
        assert.equal((await db.query<any>(`SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass`, [`public.${table}`])).rows[0].relrowsecurity, true, `RLS ${table}`);
        for (const operation of ['SELECT','INSERT','UPDATE','DELETE']) {
          assert.equal((await db.query<any>('SELECT has_table_privilege($1,$2,$3) AS allowed', ['authenticated', `public.${table}`, operation])).rows[0].allowed, false, `authenticated ${operation} ${table}`);
        }
      }
      const funcs = (await db.query<any>(`SELECT to_regprocedure('public.hu001_consultar_inventario(bigint,bigint,text,text,bigint,bigint,integer,integer)') hu001,
        to_regprocedure('public.hu002_identificar_unidades(bigint,jsonb)') hu002,
        to_regprocedure('public.hu003_confirmar_recepcion(bigint,bigint)') hu003,
        to_regprocedure('public.hu034_registrar_compra(bigint,text,integer,uuid)') hu034`)).rows[0];
      assert.ok(funcs.hu001 && funcs.hu002 && funcs.hu003 && funcs.hu034);
      assert.equal((await db.query<any>(`SELECT has_function_privilege('anon','public.importar_documento_compra(jsonb)','EXECUTE') AS allowed`)).rows[0].allowed, false);
      assert.equal((await db.query<any>(`SELECT has_function_privilege('authenticated','public.importar_documento_compra(jsonb)','EXECUTE') AS allowed`)).rows[0].allowed, true);
      await db.query(`SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false)`);
      await assert.rejects(importar(db, construirPayload(model, { id: 'S012-00000012' })), (error: any) => error.code === '42501');
      await db.query(`SELECT set_config('request.jwt.claim.sub',$1,false)`, [ADMIN_UUID]);
    });

    await t.test('intentos admiten Procesando sin fin y exigen fecfin al finalizar', async () => {
      const actor = (await db.query<any>(`SELECT codusu FROM usuario WHERE corusu='integracion.facturas@epsa.internal'`)).rows[0].codusu;
      const codint = (await db.query<any>(`INSERT INTO intentodocumento(coddoc,tipactor,codusu,resint)
        VALUES ($1,'Automatico',$2,'Procesando') RETURNING codint`, [first.coddoc, actor])).rows[0].codint;
      await assert.rejects(db.query(`UPDATE intentodocumento SET resint='Exito' WHERE codint=$1`, [codint]), (error: any) => error.code === '23514');
      await db.query(`UPDATE intentodocumento SET resint='Exito',fecfin=now() WHERE codint=$1`, [codint]);
      assert.equal((await db.query<any>(`SELECT resint,fecfin IS NOT NULL AS terminado FROM intentodocumento WHERE codint=$1`, [codint])).rows[0].terminado, true);
    });
  } finally {
    await db.close();
  }
});

test('HU-030 Fase 2 falla claramente si el actor técnico no fue provisionado en Auth', async () => {
  await assert.rejects(crearContexto({ omitirActorTecnico: true }), (error: any) =>
    String(error.message).includes('ACTOR_TECNICO_AUTH_NO_PROVISIONADO'));
});
