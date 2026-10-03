import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
test('HU-026: migración, catálogo, restricciones, historial y permisos en PostgreSQL local', async t => {
  const db = new PGlite();
  const fail = async (sql: string, code: string) => assert.rejects(db.exec(sql), (e: any) => e.code === code);
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Crossland Ancon','Almacen');
      GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
      ALTER TABLE ubicacion ENABLE ROW LEVEL SECURITY;
      CREATE POLICY ubicacion_insert_anon ON ubicacion FOR INSERT TO anon WITH CHECK (true);
      CREATE POLICY ubicacion_select_anon ON ubicacion FOR SELECT TO anon USING (true);
      CREATE POLICY ubicacion_update_anon ON ubicacion FOR UPDATE TO anon USING (true) WITH CHECK (true);`);
    await db.exec(migration);
    await t.test('se puede reaplicar sin duplicar; catálogo correcto y direcciones desconocidas', async () => {
      await db.exec(migration);
      const { rows } = await db.query<{ nomubi: string; dirubi: null }>('SELECT nomubi,dirubi FROM ubicacion');
      assert.equal(rows.length, 7);
      assert.deepEqual(rows.map(r => r.nomubi).sort(), ['Ventanilla','Comas','Puente Piedra','Crossland Ancón','FIVESA','JAVICAR','FIBRAT'].sort());
      assert.ok(rows.every(r => r.dirubi === null));
      assert.equal((await db.query<any>(`SELECT codubi FROM ubicacion WHERE nomubi='Crossland Ancón'`)).rows[0].codubi, 1);
    });
    await t.test('rechaza duplicados normalizados en INSERT y UPDATE; rechaza espacios vacíos', async () => {
      await fail(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('  COMAS  ','Sede')`, '23505');
      await fail(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Puente   Piedra','Sede')`, '23505');
      await fail(`UPDATE ubicacion SET nomubi=' comas ' WHERE nomubi='FIBRAT'`, '23505');
      await fail(`INSERT INTO ubicacion(nomubi,tipubi) VALUES (E' \t ','Sede')`, '23514');
    });
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
      SELECT id, row_number() OVER (ORDER BY id), 'Prueba', 'QA', id::text || '@test.local' FROM auth.users;
      INSERT INTO tipomotocar(nomtmo) VALUES ('Prueba');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Prueba','Prueba','Prueba');
      INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Azul',1);
      INSERT INTO unidad(codcom,codmod,nummotuni,chauni,codubi) VALUES (1,1,'QA-MOTOR','QA-CHASIS',(SELECT codubi FROM ubicacion WHERE nomubi='Comas'));`);
    await t.test('bloquea unidades asignadas y permite desactivar tras liberarlas', async () => {
      await fail(`UPDATE ubicacion SET estubi=false WHERE nomubi='Comas'`, 'PT409');
      await db.exec(`UPDATE unidad SET codubi=NULL; UPDATE ubicacion SET estubi=false WHERE nomubi='Comas';`);
      await fail(`UPDATE unidad SET codubi=(SELECT codubi FROM ubicacion WHERE nomubi='Comas')`, 'PT422');
      await db.exec(`UPDATE ubicacion SET estubi=true WHERE nomubi='Comas'`);
    });
    await t.test('protege ambos extremos de traslados activos y conserva finalizados/cancelados', async () => {
      await db.exec(`INSERT INTO movimientoubicacion(coduni,codubiori,codubides,codusu,estmub)
        VALUES (1,(SELECT codubi FROM ubicacion WHERE nomubi='Comas'),(SELECT codubi FROM ubicacion WHERE nomubi='FIVESA'),1,'Pendiente')`);
      for (const nombre of ['Comas','FIVESA']) await fail(`UPDATE ubicacion SET estubi=false WHERE nomubi='${nombre}'`, 'PT409');
      await db.exec(`UPDATE movimientoubicacion SET estmub='En transito'`);
      await fail(`UPDATE ubicacion SET estubi=false WHERE nomubi='FIVESA'`, 'PT409');
      await db.exec(`UPDATE movimientoubicacion SET estmub='Finalizado'; UPDATE ubicacion SET estubi=false WHERE nomubi IN ('Comas','FIVESA');`);
      assert.equal((await db.query<any>('SELECT count(*)::int AS total FROM movimientoubicacion')).rows[0].total, 1);
      await fail(`UPDATE movimientoubicacion SET estmub='Pendiente'`, 'PT422');
      await db.exec(`UPDATE ubicacion SET estubi=true WHERE nomubi IN ('Comas','FIVESA'); UPDATE movimientoubicacion SET estmub='Pendiente'; UPDATE movimientoubicacion SET estmub='Cancelado'; UPDATE ubicacion SET estubi=false WHERE nomubi='FIVESA';`);
      await fail(`INSERT INTO movimientoubicacion(coduni,codubiori,codubides,codusu) SELECT 1,codubiori,codubides,1 FROM movimientoubicacion`, 'PT422');
    });
    await t.test('RLS permite gerente/administradora y rechaza escritura vendedor y anon', async () => {
      for (const n of [1,2]) {
        await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false)`);
        await db.exec(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('QA ${n}','Sede'); UPDATE ubicacion SET estubi=false WHERE nomubi='QA ${n}';`);
        await fail(`UPDATE usuario SET codrol=1`, '42501');
        await db.exec('RESET ROLE');
      }
      await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',false)`);
      assert.ok((await db.query('SELECT * FROM ubicacion')).rows.length > 0);
      await fail(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('No autorizado','Sede')`, '42501');
      assert.equal((await db.query(`UPDATE ubicacion SET estubi=false WHERE nomubi='Comas' RETURNING *`)).rows.length, 0);
      await fail(`DELETE FROM ubicacion`, '42501');
      await db.exec('RESET ROLE; SET ROLE anon');
      await fail('SELECT * FROM ubicacion', '42501');
      await fail(`INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Anónimo','Sede')`, '42501');
      await db.exec('RESET ROLE');
    });
    await t.test('usuario y rol inactivos pierden acceso', async () => {
      await db.exec(`UPDATE usuario SET estusu=false WHERE codusu=1; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false)`);
      assert.equal((await db.query('SELECT * FROM ubicacion')).rows.length, 0);
      await db.exec(`RESET ROLE; UPDATE usuario SET estusu=true WHERE codusu=1; UPDATE rol SET estrol=false WHERE codrol=1; SET ROLE authenticated`);
      assert.equal((await db.query('SELECT * FROM ubicacion')).rows.length, 0);
      await db.exec('RESET ROLE');
    });
  } finally { await db.close(); }
});
