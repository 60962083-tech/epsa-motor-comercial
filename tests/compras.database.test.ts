import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const hu034 = readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql','utf8');
test('HU-034: transacción, reintentos, autor, permisos y consulta comercial', async t => {
  const db = new PGlite();
  const key = '10000000-0000-0000-0000-000000000001';
  const fail = async (sql: string, code: string) => assert.rejects(db.exec(sql), (e: any) => e.code === code);
  const registrar = async (k=key, modelo=1, color='Azul', cantidad=3) =>
    (await db.query<any>('SELECT public.hu034_registrar_compra($1,$2,$3,$4) AS r',[modelo,color,cantidad,k])).rows[0].r;
  const login = async (n: number) => db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false)`);
  let id: string;
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql','utf8'));
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu) SELECT id,row_number() OVER (ORDER BY id),'QA','Prueba',id::text||'@test.local' FROM auth.users;
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Modelo QA','Descripción','Características');
      INSERT INTO compra(codmod,codusu,colcom,cancom,obscom) VALUES (1,1,'Histórico',2,'Documento privado');
      GRANT ALL ON compra TO anon,authenticated;
      CREATE POLICY anterior ON compra FOR ALL TO PUBLIC USING (true) WITH CHECK (true);`);
    await db.exec(hu034);
    await t.test('migración reaplicable y compras previas conservadas', async () => {
      await db.exec(hu034);
      const { rows } = await db.query<any>('SELECT * FROM compra');
      assert.equal(rows.length,1); assert.equal(rows[0].obscom,'Documento privado'); assert.equal(rows[0].idempotencia,null);
    });
    await login(1);
    await t.test('crea compra con datos automáticos, sin unidades ni series ficticias', async () => {
      const r = await registrar(); id=r.compra.codcom;
      assert.equal(r.creada,true); assert.equal(r.compra.codusu,'1'); assert.equal(r.compra.estcom,'Pendiente de factura');
      assert.equal(r.compra.cantidad_pendiente,3); assert.match(r.compra.feccom,/^\d{4}-\d{2}-\d{2}$/); assert.ok(r.compra.horcom);
      await db.exec('RESET ROLE');
      assert.equal((await db.query<any>('SELECT count(*)::int AS n FROM unidad')).rows[0].n,0);
      await login(1);
    });
    await t.test('mismo intento devuelve ID original; datos diferentes generan conflicto', async () => {
      const r = await registrar(key,1,'  Azul  '); assert.equal(r.creada,false); assert.equal(r.compra.codcom,id);
      await assert.rejects(registrar(key,1,'Rojo'), (e:any)=>e.code==='PT409');
      await assert.rejects(registrar(key,1,'Azul',4), (e:any)=>e.code==='PT409');
      const nueva = await registrar('10000000-0000-0000-0000-000000000002');
      assert.equal(nueva.creada,true); assert.notEqual(nueva.compra.codcom,id);
    });
    await t.test('errores no crean compras y no consumen la clave de intento', async () => {
      const k='10000000-0000-0000-0000-000000000003';
      for (const [modelo,color,cantidad,code] of [[999,'Azul',1,'PT422'],[1,' ',1,'PT400'],[1,'Azul',0,'PT400'],[1,'Azul',-1,'PT400'],[1,'a'.repeat(51),1,'PT400']] as const)
        await assert.rejects(registrar(k,modelo,color,cantidad),(e:any)=>e.code===code);
      await fail(`SELECT hu034_registrar_compra(1,'Azul',1,NULL)`,'PT400');
      assert.equal((await registrar(k)).creada,true);
    });
    await t.test('administradora revisa pendientes y registra compra propia sin fusionar compras', async () => {
      await login(2);
      const lista=(await db.query<any>('SELECT hu034_listar_pendientes() AS r')).rows[0].r;
      assert.ok(lista.some((c:any)=>c.codcom===id));
      await assert.rejects(registrar(),(e:any)=>e.code==='PT409');
      const r=await registrar('10000000-0000-0000-0000-000000000004');
      assert.equal(r.compra.codusu,'2'); assert.notEqual(r.compra.codcom,id);
    });
    await t.test('vendedor solo recibe proyección comercial; no escritura ni acceso privado directo', async () => {
      await login(3);
      const r=(await db.query<any>('SELECT hu034_obtener_compra($1) AS r',[id])).rows[0].r;
      assert.deepEqual(Object.keys(r).sort(),['codcom','codmod','nommod','colcom','cancom','cantidad_pendiente','estcom','feccom','horcom'].sort());
      await assert.rejects(registrar('10000000-0000-0000-0000-000000000005'),(e:any)=>e.code==='42501');
      await fail('SELECT * FROM compra','42501');
      await fail(`INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Azul',1)`,'42501');
      await fail(`SELECT hu034_detalle_interno(1)`,'42501');
    });
    await t.test('ni gerente puede saltarse el registro automático mediante tabla directa', async () => {
      await login(1);
      await fail(`UPDATE compra SET codusu=2`,'42501');
      await fail(`INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,2,'Azul',1)`,'42501');
    });
    await t.test('consulta pendiente separada y continuidad HU-002 con el mismo ID', async () => {
      await db.exec('RESET ROLE');
      await db.query(`INSERT INTO unidad(codcom,codmod,nummotuni,chauni) VALUES ($1,1,'MOTOR-QA','CHASIS-QA')`,[id]);
      await login(1);
      assert.equal((await db.query<any>('SELECT hu034_obtener_compra($1) AS r',[id])).rows[0].r.cantidad_pendiente,2);
      await db.exec('RESET ROLE'); await db.query(`UPDATE compra SET estcom='Identificada' WHERE codcom=$1`,[id]);
      await login(1);
      const lista=(await db.query<any>('SELECT hu034_listar_pendientes() AS r')).rows[0].r;
      assert.ok(!lista.some((c:any)=>c.codcom===id));
      assert.equal((await db.query<any>('SELECT hu034_obtener_compra($1) AS r',[id])).rows[0].r.codcom,id);
      assert.equal((await registrar()).compra.codcom,id);
      assert.deepEqual((await db.query<any>('SELECT hu034_listar_pendientes(1,999) AS r')).rows[0].r,[]);
      await fail('SELECT hu034_obtener_compra(99999)','PT404');
      await fail('SELECT hu034_listar_pendientes(101,0)','PT400');
    });
    await t.test('anon, usuario inactivo y rol inactivo no acceden', async () => {
      await db.exec('RESET ROLE; SET ROLE anon'); await fail('SELECT hu034_listar_pendientes()','42501');
      await db.exec('RESET ROLE; UPDATE usuario SET estusu=false WHERE codusu=1'); await login(1);
      await fail('SELECT hu034_listar_pendientes()','42501');
      await db.exec('RESET ROLE; UPDATE usuario SET estusu=true WHERE codusu=1; UPDATE rol SET estrol=false WHERE codrol=1'); await login(1);
      await fail('SELECT hu034_obtener_compra(1)','42501');
    });
  } finally { await db.close(); }
});
