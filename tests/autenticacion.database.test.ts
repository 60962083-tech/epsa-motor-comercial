import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { UsuarioAutenticado } from '../src/types/autenticacion.types';

interface Resultado<T> { valor: T }
interface AltaCompra { creada: boolean; compra: { codusu: string; codcom: string } }
interface ErrorPostgres { code: string }
const migracion = readFileSync('supabase/migrations/202610070001_hu007_permisos_rol.sql', 'utf8');

test('HU007 PostgreSQL: identidad propia y permisos sin dependencia de HU002', async t => {
  const db = new PGlite();
  const consulta = async <T>(sql: string, parametros: unknown[] = []) => (await db.query<Resultado<T>>(sql, parametros)).rows[0].valor;
  const login = async (n: number) => db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false)`);
  const perfil = () => consulta<UsuarioAutenticado | null>('SELECT hu007_usuario_actual() AS valor');
  const denegado = (e: unknown) => (e as ErrorPostgres).code === '42501';
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8'));
    await db.exec(`INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003'),('00000000-0000-0000-0000-000000000004');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
      SELECT id,row_number() OVER (ORDER BY id),'QA','Prueba',id::text||'@test.local' FROM auth.users WHERE id<>'00000000-0000-0000-0000-000000000004';
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'QA','Descripción','Características');`);
    const original = await consulta<string>("SELECT pg_get_functiondef('hu026_rol_actual()'::regprocedure) valor");
    await db.exec(migracion);
    await db.exec(migracion);

    await t.test('migración reaplicable mantiene hu026_rol_actual y restringe ejecución', async () => {
      assert.equal(await consulta<string>("SELECT pg_get_functiondef('hu026_rol_actual()'::regprocedure) valor"), original);
      assert.equal(await consulta<boolean>("SELECT has_function_privilege('anon','hu007_usuario_actual()','EXECUTE') valor"), false);
      assert.equal(await consulta<boolean>("SELECT has_function_privilege('authenticated','hu007_usuario_actual()','EXECUTE') valor"), true);
    });
    await t.test('devuelve solo codusu, UUID y rol del usuario actual', async () => {
      for (const [n, rol] of [[1, 'Gerente'], [2, 'Administradora'], [3, 'Vendedor']] as const) {
        await login(n);
        assert.deepEqual(await perfil(), { codusu: String(n), uuidusu: `00000000-0000-0000-0000-00000000000${n}`, rol });
      }
      await assert.rejects(db.exec("SELECT hu007_usuario_actual('00000000-0000-0000-0000-000000000001')"), e => (e as ErrorPostgres).code === '42883');
    });
    await t.test('cuenta Auth sin usuario de negocio y sesión sin UUID no obtienen permisos', async () => {
      await login(4); assert.equal(await perfil(), null);
      await db.exec("SELECT set_config('request.jwt.claim.sub','',false)");
      assert.equal(await perfil(), null);
    });
    await t.test('usuario, rol inactivo y rol fuera de HU007 quedan excluidos', async () => {
      await db.exec('RESET ROLE; UPDATE usuario SET estusu=false WHERE codusu=1');
      await login(1); assert.equal(await perfil(), null);
      await db.exec('RESET ROLE; UPDATE usuario SET estusu=true WHERE codusu=1; UPDATE rol SET estrol=false WHERE codrol=1');
      await login(1); assert.equal(await perfil(), null);
      await db.exec("RESET ROLE; UPDATE rol SET estrol=true,nomrol='Rol no autorizado de prueba' WHERE codrol=1");
      await login(1); assert.equal(await perfil(), null);
      await db.exec("RESET ROLE; UPDATE rol SET nomrol='Gerente' WHERE codrol=1");
    });
    await t.test('HU034 atribuye compras al autor autenticado, incluso con metadata falsa', async () => {
      for (const n of [1, 2]) {
        await login(n);
        await db.exec(`SELECT set_config('request.jwt.claims','{"user_metadata":{"codusu":99,"rol":"Vendedor"}}',false)`);
        const r = await consulta<AltaCompra>("SELECT hu034_registrar_compra(1,'Azul',1,$1) valor", [randomUUID()]);
        assert.equal(r.compra.codusu, String(n));
      }
    });
    await t.test('RLS HU026 y RPC HU034 mantienen gestión y rechazan vendedor', async () => {
      for (const n of [1, 2]) {
        await login(n);
        await db.query("INSERT INTO ubicacion(nomubi,tipubi) VALUES ($1,'Sede')", [`QA-${n}`]);
      }
      await login(3);
      await db.exec(`SELECT set_config('request.jwt.claims','{"user_metadata":{"codusu":1,"rol":"Gerente"}}',false)`);
      assert.equal((await perfil())?.rol, 'Vendedor');
      assert.ok((await db.query('SELECT codubi FROM ubicacion')).rows.length > 0);
      assert.ok((await consulta<unknown[]>('SELECT hu034_listar_pendientes() valor')).length > 0);
      await assert.rejects(db.exec("INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Prohibido','Sede')"), denegado);
      await assert.rejects(db.query("SELECT hu034_registrar_compra(1,'Azul',1,$1)", [randomUUID()]), denegado);
      await assert.rejects(db.exec('UPDATE usuario SET codrol=1 WHERE codusu=3'), denegado);
    });
    await t.test('desactivación posterior al login bloquea la operación en la propia BD', async () => {
      await login(1); assert.ok(await perfil());
      await db.exec('RESET ROLE; UPDATE usuario SET estusu=false WHERE codusu=1');
      await login(1);
      await assert.rejects(db.query("SELECT hu034_registrar_compra(1,'Azul',1,$1)", [randomUUID()]), denegado);
      await assert.rejects(db.exec("INSERT INTO ubicacion(nomubi,tipubi) VALUES ('Inactivo','Sede')"), denegado);
    });
    await t.test('anon no puede consultar la identidad', async () => {
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(perfil(), denegado);
    });
  } finally { await db.close(); }
});
