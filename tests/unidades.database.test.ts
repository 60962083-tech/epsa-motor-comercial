import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { FacturaCompraResultado, IdentificacionCompraResultado, UnidadIdentificacionInput } from '../src/types/unidad.types';

interface ResultadoSQL<T> { r: T }
interface Conteo { n: number }
interface AltaCompra { compra: { codcom: string }; creada: boolean }
interface ErrorSQL { code: string; detail?: string }
interface EstadoOperativo { codubi: number | null; codtte: number | null; codpro: number | null; codepr: number | null; estcomuni: string }

const migracion = readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8');
test('HU-002 PostgreSQL: identificación transaccional, factura y compatibilidad', async t => {
  const db = new PGlite();
  let usuario = 1;
  const login = async (n: number) => {
    usuario = n;
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false)`);
  };
  async function administrativo(sql: string) {
    await db.exec('RESET ROLE');
    try { return await db.exec(sql); } finally { await login(usuario); }
  }
  async function escalar<T>(sql: string, params: unknown[] = []): Promise<T> {
    return (await db.query<ResultadoSQL<T>>(sql, params)).rows[0].r;
  }
  const error = (codigo: string) => (e: unknown) => (e as ErrorSQL).code === codigo;
  const unidad = (s: string): UnidadIdentificacionInput => ({ nummotuni: `M-${s}`, chauni: `C-${s}`, codmod: '1', coluni: 'Azul' });
  const crear = async (n = 4) => (await escalar<AltaCompra>(
    'SELECT hu034_registrar_compra(1,$1,$2,$3) r', ['Azul', n, randomUUID()])).compra.codcom;
  const factura = (id: string, n = 4, numero = `F-${id}`) => escalar<FacturaCompraResultado>(
    "SELECT hu002_registrar_factura($1,'Crossland QA',$2,'2026-10-01',$3) r", [id, numero, n]);
  const identificar = (id: string, unidades: UnidadIdentificacionInput[]) => escalar<IdentificacionCompraResultado>(
    'SELECT hu002_identificar_unidades($1,$2::jsonb) r', [id, JSON.stringify(unidades)]);
  const consultar = (id: string) => escalar<IdentificacionCompraResultado>('SELECT hu002_consultar_unidades($1) r', [id]);
  let principal = '';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8'));
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu) SELECT id,row_number() OVER (ORDER BY id),'QA','Prueba',id::text||'@test.local' FROM auth.users;
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Modelo QA','Descripción','Características'),(1,'Otro modelo','Descripción','Características');
      GRANT ALL ON unidad TO authenticated; CREATE POLICY antigua ON unidad FOR ALL TO authenticated USING (true) WITH CHECK (true);`);
    // Simular una instalación que todavía expone la firma antigua y verificar su retirada.
    await db.exec(`CREATE FUNCTION public.hu002_identificar_unidades(bigint,integer,jsonb)
      RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb $$`);
    await db.exec(migracion);
    await db.exec(migracion);
    assert.equal(await escalar<string | null>("SELECT to_regprocedure('public.hu002_identificar_unidades(bigint,integer,jsonb)')::text r"), null);
    assert.ok(await escalar<string | null>("SELECT to_regprocedure('public.hu002_identificar_unidades(bigint,jsonb)')::text r"));
    await login(1);
    principal = await crear();

    await t.test('requiere factura, compra válida y conserva cero unidades', async () => {
      await assert.rejects(identificar('99999', [unidad('A')]), error('PT404'));
      await assert.rejects(identificar(principal, [unidad('A')]), error('PT410'));
      assert.equal((await consultar(principal)).cantidad_identificada, 0);
    });
    await t.test('factura recibida cambia estado sin crear motos ni afirmar un archivo', async () => {
      const r = await factura(principal);
      assert.equal(r.estcom, 'Pendiente de identificación'); assert.equal(r.factura.archivo_adjuntado, false);
      assert.equal((await factura(principal)).factura.codfac, r.factura.codfac);
      await assert.rejects(factura(principal, 4, 'OTRA'), error('PT413'));
      const c = await consultar(principal); assert.equal(c.unidades.length, 0); assert.equal(c.cantidad_pendiente, 4);
    });
    await t.test('gerente identifica lote parcial; HU034 continúa mostrándolo pendiente', async () => {
      const r = await identificar(principal, [unidad('A'), unidad('B')]);
      assert.equal(r.cantidad_identificada, 2); assert.equal(r.cantidad_pendiente, 2);
      assert.equal(r.estcom, 'Pendiente de identificación'); assert.ok(r.unidades.every(u => u.codcom === principal));
      const pendientes = await escalar<IdentificacionCompraResultado[]>('SELECT hu034_listar_pendientes() r');
      assert.ok(pendientes.some(c => c.codcom === principal));
    });
    await t.test('duplicados devuelven ficha segura sin sobrescribir; incluye otra compra', async () => {
      const otra = await crear(); await factura(otra);
      for (const u of [{ ...unidad('X'), nummotuni: ' m-a ' }, { ...unidad('Y'), chauni: 'c-a' }]) {
        await assert.rejects(identificar(otra, [u]), e => {
          assert.equal((e as ErrorSQL).code, 'PT409');
          const d = JSON.parse((e as ErrorSQL).detail ?? '{}');
          assert.equal(d.unidad.codcom, principal); assert.equal(d.unidad.nummotuni, 'M-A');
          assert.equal(d.unidad.obsuni, undefined); return true;
        });
      }
      assert.equal((await consultar(otra)).unidades.length, 0);
      assert.equal((await consultar(principal)).cantidad_identificada, 2);
    });
    await t.test('modelo, color y cantidades discrepantes no crean nada', async () => {
      for (const u of [{ ...unidad('D'), codmod: '2' }, { ...unidad('D'), coluni: 'Rojo' }])
        await assert.rejects(identificar(principal, [u]), error('PT411'));
      await assert.rejects(identificar(principal, [unidad('D'), unidad('E'), unidad('F')]), error('PT412'));
      assert.equal((await consultar(principal)).cantidad_identificada, 2);
      const discrepante = await crear();
      assert.equal((await factura(discrepante, 5)).requiere_revision, true);
      assert.equal((await consultar(discrepante)).estcom, 'Pendiente de identificación');
      await assert.rejects(identificar(discrepante, [unidad('Z')]), error('PT411'));
      // Ni siquiera enviando la cantidad correcta de la compra dentro del lote se puede eludir la discrepancia almacenada.
      await assert.rejects(escalar('SELECT hu002_identificar_unidades($1,$2::jsonb) r',
        [discrepante, JSON.stringify([{ ...unidad('Z'), cantidad_factura: 4 }])]), error('PT411'));
      assert.equal((await consultar(discrepante)).cantidad_identificada, 0);
      assert.equal((await consultar(discrepante)).factura?.cantidad_motos, 5);
    });
    await t.test('lote mixto válido/duplicado o repetido se revierte completo', async () => {
      await assert.rejects(identificar(principal, [unidad('NUEVA'), unidad('A')]), error('PT409'));
      await assert.rejects(identificar(principal, [unidad('R'), unidad('R')]), error('PT409'));
      assert.ok(!(await consultar(principal)).unidades.some(u => u.nummotuni === 'M-NUEVA'));
    });
    await t.test('fallo durante la segunda inserción revierte también la primera y el estado', async () => {
      const id = await crear(2); await factura(id, 2);
      await administrativo(`CREATE FUNCTION public.hu002_test_fallo() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.nummotuni='M-FALLO2' THEN RAISE EXCEPTION 'Error intermedio de prueba'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER zz_test_fallo BEFORE INSERT ON unidad FOR EACH ROW EXECUTE FUNCTION hu002_test_fallo();`);
      try { await assert.rejects(identificar(id, [unidad('FALLO1'), unidad('FALLO2')]), error('P0001')); }
      finally { await administrativo('DROP TRIGGER zz_test_fallo ON unidad; DROP FUNCTION hu002_test_fallo()'); }
      const r = await consultar(id); assert.equal(r.unidades.length, 0); assert.equal(r.estcom, 'Pendiente de identificación');
    });
    await t.test('continúa administradora sin modificar datos operativos ni compromiso existentes', async () => {
      const antes = (await consultar(principal)).unidades;
      const id = antes[0].coduni;
      await administrativo(`INSERT INTO tipotecho(nomtte) VALUES ('Lona'); INSERT INTO proveedor(nompro) VALUES ('QA');
        INSERT INTO estadopreparacion(nomepr) VALUES ('Pendiente');
        INSERT INTO tipodocumento(nomtdo) VALUES ('QA');
        INSERT INTO cliente(codtdo,numdoccli,nomcli) VALUES (1,'QA-1','Cliente QA');
        INSERT INTO separacion(coduni,codcli,codusu,metpagsep,monadesep) VALUES (${id},1,1,'QA',10);
        UPDATE unidad SET codubi=(SELECT codubi FROM ubicacion WHERE nomubi='Comas'),codtte=1,codpro=1,codepr=1,estcomuni='Separada' WHERE coduni=${id};`);
      await login(2);
      const r = await identificar(principal, [unidad('C'), unidad('D')]);
      assert.equal(r.cantidad_pendiente, 0); assert.equal(r.estcom, 'Identificada');
      assert.deepEqual(r.unidades.slice(0, 2), antes);
      await db.exec('RESET ROLE');
      const operativo = (await db.query<EstadoOperativo>('SELECT codubi,codtte,codpro,codepr,estcomuni FROM unidad WHERE coduni=$1', [id])).rows[0];
      assert.equal(operativo.estcomuni, 'Separada'); assert.ok(operativo.codubi); assert.equal(operativo.codepr, 1);
      assert.equal((await db.query<Conteo>('SELECT count(*)::int n FROM separacion WHERE coduni=$1', [id])).rows[0].n, 1);
      const nuevas = (await db.query<EstadoOperativo>("SELECT codubi,codtte,codpro,codepr,estcomuni FROM unidad WHERE nummotuni IN ('M-C','M-D')")).rows;
      assert.ok(nuevas.every(u => u.codubi === null && u.codtte === null && u.codpro === null && u.codepr === null && u.estcomuni === 'No disponible'));
      await login(2);
      const pendientes = await escalar<IdentificacionCompraResultado[]>('SELECT hu034_listar_pendientes() r');
      assert.ok(!pendientes.some(c => c.codcom === principal));
    });
    await t.test('guardas PostgreSQL impiden exceso, cambios de compra y series aun fuera del RPC', async () => {
      await db.exec('RESET ROLE');
      try {
        await assert.rejects(db.exec(`INSERT INTO unidad(codcom,codmod,coluni,nummotuni,chauni) VALUES (${principal},1,'Azul','M-EXCESO','C-EXCESO')`), error('PT412'));
        await assert.rejects(db.exec(`UPDATE compra SET cancom=1 WHERE codcom=${principal}`), error('PT412'));
        await assert.rejects(db.exec(`UPDATE unidad SET codcom=999 WHERE nummotuni='M-A'`), error('PT411'));
        await assert.rejects(db.exec(`UPDATE unidad SET nummotuni='m-a' WHERE nummotuni='M-B'`), error('PT409'));
      } finally { await login(2); }
    });
    await t.test('solicitudes competidoras conservan capacidad y series en el ejecutor serializado PGlite', async () => {
      const id = await crear(1); await factura(id, 1);
      const respuestas = await Promise.allSettled([
        identificar(id, [unidad('COMPITE-1')]), identificar(id, [unidad('COMPITE-2')])
      ]);
      assert.equal(respuestas.filter(r => r.status === 'fulfilled').length, 1);
      assert.ok(respuestas.some(r => r.status === 'rejected' && (r.reason as ErrorSQL).code === 'PT412'));
      assert.equal((await consultar(id)).cantidad_identificada, 1);
      const a = await crear(1), b = await crear(1); await factura(a, 1); await factura(b, 1);
      const duplicados = await Promise.allSettled([
        identificar(a, [unidad('SERIE-COMPARTIDA')]), identificar(b, [unidad('SERIE-COMPARTIDA')])
      ]);
      assert.equal(duplicados.filter(r => r.status === 'fulfilled').length, 1);
      assert.ok(duplicados.some(r => r.status === 'rejected' && (r.reason as ErrorSQL).code === 'PT409'));
    });
    await t.test('los locks de compra y series permanecen hasta finalizar la transacción', async () => {
      const id = await crear(1); await factura(id, 1);
      await db.exec('BEGIN');
      try {
        await identificar(id, [unidad('LOCKS')]);
        assert.ok(await escalar<boolean>("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='advisory' AND granted) r"));
        assert.ok(await escalar<boolean>("SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=pg_backend_pid() AND relation='public.compra'::regclass AND mode='RowShareLock' AND granted) r"));
      } finally { await db.exec('ROLLBACK'); }
      assert.equal((await consultar(id)).cantidad_identificada, 0);
    });
    await t.test('reaplicar conserva factura, fichas y estados; HU026 sigue disponible', async () => {
      const antes = await consultar(principal);
      await administrativo(migracion);
      assert.deepEqual(await consultar(principal), antes);
      await db.exec("SELECT hu026_rol_actual(); SELECT * FROM ubicacion");
    });
    await t.test('vendedor, anon, usuario/rol inactivo y escritura directa rechazados', async () => {
      await login(3);
      await assert.rejects(consultar(principal), error('42501')); await assert.rejects(factura(principal), error('42501'));
      await assert.rejects(identificar(principal, [unidad('DENEGADO')]), error('42501'));
      const comercial = await escalar<Record<string, unknown>>('SELECT hu034_obtener_compra($1) r', [principal]);
      assert.equal(comercial.factura, undefined); assert.equal(comercial.codusu, undefined);
      await login(1);
      await assert.rejects(db.exec('SELECT * FROM factura_compra'), error('42501'));
      await assert.rejects(db.exec("INSERT INTO unidad(codcom,codmod,nummotuni,chauni) VALUES (1,1,'X','Y')"), error('42501'));
      await administrativo('UPDATE usuario SET estusu=false WHERE codusu=1');
      await assert.rejects(consultar(principal), error('42501'));
      await administrativo('UPDATE usuario SET estusu=true WHERE codusu=1; UPDATE rol SET estrol=false WHERE codrol=1');
      await assert.rejects(consultar(principal), error('42501'));
      await db.exec('RESET ROLE; SET ROLE anon'); await assert.rejects(consultar(principal), error('42501'));
    });
  } finally { await db.close(); }
});
