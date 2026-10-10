import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migracion = readFileSync('supabase/migrations/202610100002_hu010_sedes_publicas.sql', 'utf8');

test('HU-010 PostgreSQL: RPC proyecta sedes activas relacionadas sin exponer tablas', async t => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
      CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT null::uuid $$;
      GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    // Simula permisos amplios previos y verifica que la migración los cierre sin
    // quitar la lectura autenticada de ubicacion que HU-026 ya requiere.
    await db.exec(`GRANT SELECT ON public.sede, public.ubicacion TO anon, authenticated;`);
    await db.exec(migracion);
    await t.test('ordena, une y devuelve solo las cinco columnas públicas; permite NULL', async () => {
      await db.exec(`INSERT INTO ubicacion(nomubi,tipubi,dirubi) VALUES
        ('Sede QA Z','Sede',NULL),('Sede QA A','Sede',NULL),('Almacén QA','Almacen',NULL),('Sede inactiva QA','Sede',NULL);
        INSERT INTO sede(codubi,telsed,horsed,estsed)
          SELECT codubi,NULL,NULL,true FROM ubicacion WHERE nomubi IN ('Sede QA Z','Sede QA A') ORDER BY nomubi;
        INSERT INTO sede(codubi,telsed,horsed,estsed)
          SELECT codubi,NULL,NULL,false FROM ubicacion WHERE nomubi='Sede inactiva QA';
        INSERT INTO ubicacion(nomubi,tipubi,dirubi,estubi) VALUES ('Ubicación inactiva QA','Sede',NULL,false);
        INSERT INTO sede(codubi,telsed,horsed,estsed)
          SELECT codubi,NULL,NULL,true FROM ubicacion WHERE nomubi='Ubicación inactiva QA';
        INSERT INTO sede(codubi,telsed,horsed,estsed)
          SELECT codubi,NULL,NULL,true FROM ubicacion WHERE nomubi='Almacén QA';`);
      const { rows } = await db.query<any>('SELECT public.hu010_sedes_publicas() AS data');
      assert.deepEqual(rows[0].data, [
        { codsed: '1', nomsed: 'Sede QA A', dirsed: null, telsed: null, horsed: null },
        { codsed: '2', nomsed: 'Sede QA Z', dirsed: null, telsed: null, horsed: null }
      ]);
      assert.deepEqual(Object.keys(rows[0].data[0]).sort(), ['codsed','dirsed','horsed','nomsed','telsed']);
    });
    await t.test('sin sedes relacionadas activas retorna arreglo vacío', async () => {
      await db.exec(`DELETE FROM sede;
        INSERT INTO sede(codubi,estsed) SELECT codubi,false FROM ubicacion WHERE nomubi='Sede QA A';`);
      const { rows } = await db.query<any>('SELECT public.hu010_sedes_publicas() AS data');
      assert.deepEqual(rows[0].data, []);
    });
    await t.test('anon y authenticated pueden ejecutar la RPC, sin SELECT directo', async () => {
      for (const rol of ['anon','authenticated']) {
        await db.exec(`RESET ROLE; SET ROLE ${rol}`);
        await db.query('SELECT public.hu010_sedes_publicas()');
        await assert.rejects(db.query('SELECT * FROM public.sede'), (error: any) => error.code === '42501');
        if (rol === 'anon') await assert.rejects(db.query('SELECT * FROM public.ubicacion'), (error: any) => error.code === '42501');
        else await db.query('SELECT * FROM public.ubicacion'); // Mantiene el acceso privado de HU-026.
      }
      await db.exec('RESET ROLE');
    });
  } finally {
    await db.close();
  }
});
