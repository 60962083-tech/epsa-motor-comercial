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
  const migracionHu009 = readFileSync('supabase/migrations/202610080002_hu009_ficha_modelo.sql', 'utf8');
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
    const rlsAntesHu009 = await db.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('modelo','imagenmodelo') ORDER BY c.relname`);
    const politicasAntesHu009 = await db.query(`SELECT tablename,policyname FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('modelo','imagenmodelo') ORDER BY tablename,policyname`);
    const grantsAntesHu009 = await db.query(`SELECT
      has_table_privilege('anon','public.modelo','SELECT') AS anon_modelo,
      has_table_privilege('authenticated','public.modelo','SELECT') AS authenticated_modelo,
      has_table_privilege('anon','public.imagenmodelo','SELECT') AS anon_imagenmodelo,
      has_table_privilege('authenticated','public.imagenmodelo','SELECT') AS authenticated_imagenmodelo`);
    await db.exec(migracionHu009);
    await db.exec(migracionHu009);
    const rlsDespuesHu009 = await db.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname IN ('modelo','imagenmodelo') ORDER BY c.relname`);
    const politicasDespuesHu009 = await db.query(`SELECT tablename,policyname FROM pg_policies
      WHERE schemaname='public' AND tablename IN ('modelo','imagenmodelo') ORDER BY tablename,policyname`);
    const grantsDespuesHu009 = await db.query(`SELECT
      has_table_privilege('anon','public.modelo','SELECT') AS anon_modelo,
      has_table_privilege('authenticated','public.modelo','SELECT') AS authenticated_modelo,
      has_table_privilege('anon','public.imagenmodelo','SELECT') AS anon_imagenmodelo,
      has_table_privilege('authenticated','public.imagenmodelo','SELECT') AS authenticated_imagenmodelo`);
    assert.deepEqual(rlsDespuesHu009.rows, rlsAntesHu009.rows);
    assert.deepEqual(politicasDespuesHu009.rows, politicasAntesHu009.rows);
    assert.deepEqual(grantsDespuesHu009.rows, grantsAntesHu009.rows);
    const fabrica = () => ({
      rpc: async (nombre: string, parametros?: unknown) => {
        if (nombre === 'hu012_modelos_publicados') {
          assert.equal(parametros, undefined);
          const resultado = await db.query<ModeloPublico>('SELECT * FROM public.hu012_modelos_publicados()');
          return { data: resultado.rows, error: null };
        }
        assert.equal(nombre, 'hu009_modelo_publicado_por_id');
        const codmod = (parametros as { p_codmod: string }).p_codmod;
        const resultado = await db.query<{ ficha: ModeloPublico | null }>(
          'SELECT public.hu009_modelo_publicado_por_id($1) AS ficha', [codmod]);
        return { data: resultado.rows[0].ficha, error: null };
      }
    }) as unknown as SupabaseClient;
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
          {
            codmod: '1', nommod: 'Modelo visible', marmod: 'Bajaj', desmod: 'Descripción', carmod: 'Características',
            imagenes: [{ urlimo: 'https://example.test/primera.jpg', ordimo: 1 }, { urlimo: 'https://example.test/segunda.jpg', ordimo: 2 }]
          },
          {
            codmod: '4', nommod: 'Otro modelo visible', marmod: 'Bajaj', desmod: 'Descripción', carmod: 'Características',
            imagenes: [{ urlimo: 'https://example.test/otro-modelo.jpg', ordimo: 1 }]
          }
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

      await db.exec(`RESET ROLE;
        INSERT INTO modelo(codtmo,nommod,desmod,carmod,estmod) VALUES
          (1,'HU009 Publicado','Ficha pública','Datos comerciales','Publicado'),
          (1,'HU009 Sin imágenes','Ficha pública','Datos comerciales','Publicado'),
          (1,'HU009 Borrador','No debe revelarse','Privado','Borrador'),
          (1,'HU009 No publicado','No debe revelarse','Privado','No publicado');
        INSERT INTO imagenmodelo(codmod,urlimo,ordimo,estimo) VALUES
          (5,'https://example.test/foto-2.jpg',2,true),
          (5,'https://example.test/foto-inactiva.jpg',1,false),
          (5,'https://example.test/foto-1a.jpg',1,true),
          (5,'https://example.test/foto-1b.jpg',1,true);
        INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (5,1,'Azul',1);
        SET ROLE anon;`);
      await t.test('HU-009 RPC devuelve solo publicado, campos aprobados e imágenes activas ordenadas', async () => {
        const { rows } = await db.query<{ ficha: ModeloPublico | null }>(
          'SELECT public.hu009_modelo_publicado_por_id(5) AS ficha'
        );

        assert.deepEqual(rows[0].ficha, {
          codmod: '5',
          nommod: 'HU009 Publicado',
          marmod: 'Bajaj',
          desmod: 'Ficha pública',
          carmod: 'Datos comerciales',
          imagenes: [
            { urlimo: 'https://example.test/foto-1a.jpg', ordimo: 1 },
            { urlimo: 'https://example.test/foto-1b.jpg', ordimo: 1 },
            { urlimo: 'https://example.test/foto-2.jpg', ordimo: 2 }
          ]
        });

        const consultarFicha = async (id: number): Promise<ModeloPublico | null> => {
          const resultado = await db.query<{ ficha: ModeloPublico | null }>(
            'SELECT public.hu009_modelo_publicado_por_id($1) AS ficha',
            [id]
          );

          return resultado.rows[0].ficha;
        };

        assert.equal(await consultarFicha(7), null);
        assert.equal(await consultarFicha(8), null);
        assert.equal(await consultarFicha(999), null);
        assert.equal(await consultarFicha(0), null);

        await assert.rejects(
          db.query("SELECT public.hu009_modelo_publicado_por_id(7,'Publicado')"),
          { code: '42883' }
        );

        const definicion = await db.query<{ sql: string }>(
          `SELECT pg_get_functiondef(
      'public.hu009_modelo_publicado_por_id(bigint)'::regprocedure
    ) AS sql`
        );

        assert.doesNotMatch(
          definicion.rows[0].sql,
          /\bunidad\b|\bcompra\b|\bcliente\b|\bprecio\b/i
        );
      });
      await t.test('HU-009 anon y authenticated ejecutan RPC; PUBLIC no recibe permiso', async () => {
        const permisos = await db.query<{
          anon: boolean;
          authenticated: boolean;
          public: boolean;
        }>(`
    SELECT
      has_function_privilege(
        'anon',
        'public.hu009_modelo_publicado_por_id(bigint)',
        'EXECUTE'
      ) AS anon,
      has_function_privilege(
        'authenticated',
        'public.hu009_modelo_publicado_por_id(bigint)',
        'EXECUTE'
      ) AS authenticated,
      EXISTS (
        SELECT 1
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        CROSS JOIN LATERAL aclexplode(p.proacl) acl
        WHERE n.nspname = 'public'
          AND p.proname = 'hu009_modelo_publicado_por_id'
          AND acl.grantee = 0
          AND acl.privilege_type = 'EXECUTE'
      ) AS public
  `);

        assert.deepEqual(permisos.rows, [
          {
            anon: true,
            authenticated: true,
            public: false
          }
        ]);

        const fichaAnon = await db.query<{ ficha: ModeloPublico | null }>(
          'SELECT public.hu009_modelo_publicado_por_id(5) AS ficha'
        );

        assert.equal(fichaAnon.rows[0].ficha?.codmod, '5');

        await db.exec('RESET ROLE; SET ROLE authenticated');

        const fichaAuthenticated = await db.query<{
          ficha: ModeloPublico | null;
        }>(
          'SELECT public.hu009_modelo_publicado_por_id(5) AS ficha'
        );

        assert.equal(
          fichaAuthenticated.rows[0].ficha?.codmod,
          '5'
        );
      });
      await t.test('HU-009 endpoint público valida ID, oculta estado y permite ficha publicada sin imágenes', async () => {
        await db.exec('RESET ROLE; SET ROLE anon');
        const ficha = await fetch(`${url}/5`);
        assert.equal(ficha.status, 200);
        assert.equal(ficha.headers.get('cache-control'), 'no-store');
        const respuesta = await ficha.json();
        assert.deepEqual(respuesta.data.imagenes, [
          { urlimo: 'https://example.test/foto-1a.jpg', ordimo: 1 },
          { urlimo: 'https://example.test/foto-1b.jpg', ordimo: 1 },
          { urlimo: 'https://example.test/foto-2.jpg', ordimo: 2 }
        ]);
        assert.deepEqual(Object.keys(respuesta.data).sort(), ['carmod', 'codmod', 'desmod', 'imagenes', 'marmod', 'nommod']);
        const sinImagenes = await fetch(`${url}/6`);
        assert.equal(sinImagenes.status, 200);
        assert.deepEqual((await sinImagenes.json()).data.imagenes, []);
        for (const id of ['7', '8', '999']) {
          const respuestaPrivada = await fetch(`${url}/${id}`);
          assert.equal(respuestaPrivada.status, 404);
          assert.deepEqual(await respuestaPrivada.json(), { ok: false, message: 'Modelo no disponible' });
        }
        for (const id of ['0', '-1', '1.2', 'abc']) assert.equal((await fetch(`${url}/${id}`)).status, 400);
        assert.equal((await fetch(`${url}/5?estmod=Borrador`)).status, 400);
      });
      await t.test('HU-009 despublicado desaparece sin borrar referencias y GET de HU-012 conserva el contrato', async () => {
        await db.exec("RESET ROLE; UPDATE modelo SET estmod='No publicado' WHERE codmod=5; SET ROLE anon");
        assert.deepEqual(await (await fetch(`${url}/5`)).json(), { ok: false, message: 'Modelo no disponible' });
        await db.exec('RESET ROLE');
        const modeloExistente = await db.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM modelo WHERE codmod=5'
        );

        const imagenesExistentes = await db.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM imagenmodelo WHERE codmod=5'
        );

        const comprasExistentes = await db.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM compra WHERE codmod=5'
        );

        assert.equal(modeloExistente.rows[0].count, 1);
        assert.equal(imagenesExistentes.rows[0].count, 4);
        assert.equal(comprasExistentes.rows[0].count, 1);
        await db.exec('SET ROLE anon');
        const catalogo = await (await fetch(url)).json();
        assert.deepEqual(catalogo.data, [{
          codmod: '6', nommod: 'HU009 Sin imágenes', marmod: 'Bajaj', desmod: 'Ficha pública', carmod: 'Datos comerciales', imagenes: []
        }]);
      });
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  } finally { await db.close(); }
});
