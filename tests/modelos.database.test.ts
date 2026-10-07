import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PGlite } from '@electric-sql/pglite';
import { crearApp } from '../src/app';
import type { ModeloPublico } from '../src/types/modelo.types';

test('HU-012: catálogo HTTP sobre PostgreSQL y conservación de modelos', async t => {
  const db = new PGlite();
  const migracion = readFileSync('supabase/migrations/202610070002_hu012_modelos_publicados.sql', 'utf8');
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8'));
    await db.exec(`INSERT INTO tipomotocar(nomtmo) VALUES ('Motocar');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod,estmod) VALUES
        (1,'Modelo visible','Descripción','Características','Publicado'),
        (1,'Borrador privado','Privado','Privado','Borrador'),
        (1,'Modelo oculto','Privado','Privado','No publicado'),
        (1,'Otro modelo visible','Descripción','Características','Publicado');
      INSERT INTO imagenmodelo(codmod,urlimo,ordimo,estimo) VALUES
        (1,'https://example.test/segunda.jpg',2,true),
        (1,'https://example.test/primera.jpg',1,true),
        (1,'https://example.test/inactiva.jpg',1,false),
        (2,'https://example.test/borrador.jpg',1,true),
        (3,'https://example.test/oculta.jpg',1,true),
        (4,'https://example.test/otro-modelo.jpg',1,true);
      INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
      INSERT INTO rol(nomrol) VALUES ('Gerente');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        VALUES ('00000000-0000-0000-0000-000000000001',1,'QA','Prueba','qa@example.test');
      INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Azul',1);`);
    await db.exec(migracion);
    await db.exec(migracion);
    const fabrica = () => ({ rpc: async (nombre: string, parametros?: unknown) => {
      assert.equal(nombre, 'hu012_modelos_publicados');
      assert.equal(parametros, undefined);
      const resultado = await db.query<ModeloPublico>('SELECT * FROM public.hu012_modelos_publicados()');
      return { data: resultado.rows, error: null };
    } }) as unknown as SupabaseClient;
    const server = crearApp(undefined, fabrica).listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', resolve));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/modelos`;
    try {
      await db.exec('SET ROLE anon');
      await t.test('Publicado aparece; Borrador y No publicado nunca aparecen; proyección e imágenes limitadas', async () => {
        const respuesta = await fetch(url);
        assert.equal(respuesta.status, 200);
        const { data } = await respuesta.json();
        assert.deepEqual(data, [
          { codmod: '1', nommod: 'Modelo visible', marmod: 'Bajaj', desmod: 'Descripción', carmod: 'Características',
            imagenes: [{ urlimo: 'https://example.test/primera.jpg', ordimo: 1 }, { urlimo: 'https://example.test/segunda.jpg', ordimo: 2 }] },
          { codmod: '4', nommod: 'Otro modelo visible', marmod: 'Bajaj', desmod: 'Descripción', carmod: 'Características',
            imagenes: [{ urlimo: 'https://example.test/otro-modelo.jpg', ordimo: 1 }] }
        ]);
      });
      await t.test('RPC directa tampoco admite cambiar estado; no concede lectura ni escritura de tablas', async () => {
        const permisos = await db.query(`SELECT
          has_table_privilege('anon', 'public.modelo', 'SELECT') AS modelo,
          has_any_column_privilege('anon', 'public.modelo', 'SELECT') AS columnas_modelo,
          has_table_privilege('anon', 'public.imagenmodelo', 'SELECT') AS imagenmodelo,
          has_any_column_privilege('anon', 'public.imagenmodelo', 'SELECT') AS columnas_imagenmodelo`);
        assert.deepEqual(permisos.rows, [{ modelo: false, columnas_modelo: false, imagenmodelo: false, columnas_imagenmodelo: false }]);
        await assert.rejects(db.query("SELECT * FROM public.hu012_modelos_publicados('Borrador')"), { code: '42883' });
        for (const sql of ['SELECT * FROM modelo', 'SELECT * FROM imagenmodelo',
          "SELECT codmod FROM modelo WHERE estmod IN ('Borrador', 'No publicado')",
          'SELECT urlimo FROM imagenmodelo', "UPDATE modelo SET estmod='Publicado'", 'DELETE FROM modelo']) {
          await assert.rejects(db.exec(sql), { code: '42501' });
        }
        await db.exec('RESET ROLE; SET ROLE authenticated');
        assert.equal((await db.query('SELECT * FROM public.hu012_modelos_publicados()')).rows.length, 2);
      });
      await t.test('configuración auditada: SELECT con RLS sin policies oculta las tablas y mantiene la RPC pública', async () => {
        // Solo configura la BD efímera de prueba; no cambia migraciones ni Supabase.
        await db.exec(`RESET ROLE;
          ALTER TABLE public.modelo ENABLE ROW LEVEL SECURITY;
          ALTER TABLE public.imagenmodelo ENABLE ROW LEVEL SECURITY;
          GRANT SELECT ON public.modelo, public.imagenmodelo TO anon;
          SET ROLE anon;`);
        for (const sql of ['SELECT * FROM public.modelo', 'SELECT * FROM public.imagenmodelo',
          "SELECT codmod FROM public.modelo WHERE estmod IN ('Borrador', 'No publicado')",
          'SELECT urlimo FROM public.imagenmodelo']) {
          assert.deepEqual((await db.query(sql)).rows, []);
        }
        const respuesta = await fetch(url);
        assert.equal(respuesta.status, 200);
        const { data } = await respuesta.json();
        assert.deepEqual(data.map((modelo: ModeloPublico) => modelo.codmod), ['1', '4']);
        assert.deepEqual(data[0].imagenes, [
          { urlimo: 'https://example.test/primera.jpg', ordimo: 1 },
          { urlimo: 'https://example.test/segunda.jpg', ordimo: 2 }
        ]);
        await db.exec('RESET ROLE; SET ROLE authenticated');
        assert.deepEqual((await db.query<ModeloPublico>('SELECT * FROM public.hu012_modelos_publicados()')).rows.map(modelo => modelo.codmod), ['1', '4']);
      });
      await t.test('despublicar retira la ficha en la siguiente consulta sin eliminar modelo, imágenes ni compra histórica', async () => {
        await db.exec("RESET ROLE; UPDATE modelo SET estmod='No publicado' WHERE codmod=1; SET ROLE anon");
        const { data } = await (await fetch(url)).json();
        assert.deepEqual(data.map((modelo: ModeloPublico) => modelo.codmod), ['4']);
        await db.exec('RESET ROLE');
        assert.equal((await db.query('SELECT * FROM modelo WHERE codmod=1')).rows.length, 1);
        assert.equal((await db.query('SELECT * FROM imagenmodelo WHERE codmod=1')).rows.length, 3);
        assert.equal((await db.query('SELECT * FROM compra WHERE codmod=1')).rows.length, 1);
        await db.exec("UPDATE modelo SET estmod='No publicado'; SET ROLE anon");
        assert.deepEqual(await (await fetch(url)).json(), { ok: true, data: [] });
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  } finally { await db.close(); }
});
