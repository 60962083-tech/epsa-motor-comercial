import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { ConfiguracionTecho, ProveedorTechoCatalogo, TipoTechoCatalogo } from '../src/types/techo.types';

interface ResultadoSQL<T> { r: T }
interface ErrorSQL { code: string }
interface UnidadPreservada { codtte: string | null; codpro: string | null; codepr: string | null; codubi: string | null; estcomuni: string; codcom: string; codmod: string; nummotuni: string; chauni: string }
const archivoMigracion = 'supabase/migrations/202610080001_hu004_configuracion_techo.sql';
const migracion = readFileSync(archivoMigracion, 'utf8');

test('HU-004 PostgreSQL: configuración, catálogos, permisos e idempotencia', async t => {
  const db = new PGlite();
  let usuario = 1;
  const error = (codigo: string) => (e: unknown) => (e as ErrorSQL).code === codigo;
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
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610070001_hu007_permisos_rol.sql', 'utf8'));
    await db.exec(`INSERT INTO auth.users VALUES
      ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002'),('00000000-0000-0000-0000-000000000003');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        SELECT id,row_number() OVER (ORDER BY id),'QA','Prueba',id::text||'@test.local' FROM auth.users;
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Modelo QA','Descripción','Características');
      INSERT INTO ubicacion(nomubi,tipubi) VALUES ('QA','Sede');
      INSERT INTO estadopreparacion(nomepr) VALUES ('Preparación QA');`);
    await db.exec(migracion);
    const cantidadTipos = await escalar<number>("SELECT count(*)::int r FROM public.tipotecho WHERE nomtte IN ('Sin techo','Lona','Techo clásico de fibra','Techo de fibra deportiva')");
    const cantidadProveedores = await escalar<number>("SELECT count(*)::int r FROM public.proveedor WHERE nompro IN ('FIVESA','JAVICAR','FIBRAT')");
    assert.equal(cantidadTipos, 4);
    assert.equal(cantidadProveedores, 3);

    await db.exec("INSERT INTO public.tipotecho(nomtte,reqprotte,esttte) VALUES ('Tipo inactivo QA',false,false)");
    const tipoInactivo = (await db.query<{ codtte: string }>("SELECT codtte::text FROM public.tipotecho WHERE nomtte='Tipo inactivo QA'")).rows[0].codtte;
    await db.exec("INSERT INTO public.proveedor(nompro) VALUES ('OTRO QA')");
    const proveedorNoPermitido = (await db.query<{ codpro: string }>("SELECT codpro::text FROM public.proveedor WHERE nompro='OTRO QA'")).rows[0].codpro;
    await db.exec(migracion);
    assert.equal(await escalar<number>("SELECT count(*)::int r FROM public.tipotecho WHERE nomtte='Sin techo'"), 1);
    assert.equal(await escalar<number>("SELECT count(*)::int r FROM public.proveedor WHERE nompro='FIVESA'"), 1);
    assert.equal(await escalar<boolean>("SELECT esttte r FROM public.tipotecho WHERE nomtte='Tipo inactivo QA'"), false);

    await login(1);
    const compra = await escalar<{ compra: { codcom: string } }>(
      'SELECT public.hu034_registrar_compra(1,$1,1,$2) r', ['Azul', randomUUID()]);
    const codcom = compra.compra.codcom;
    await escalar('SELECT public.hu002_registrar_factura($1,$2,$3,$4,$5) r', [codcom, 'QA', `F-${codcom}`, '2026-10-01', 1]);
    await escalar('SELECT public.hu002_identificar_unidades($1,$2::jsonb) r', [codcom,
      JSON.stringify([{ nummotuni: 'M-TECHO-1', chauni: 'C-TECHO-1', codmod: '1', coluni: 'Azul' }])]);
    await db.exec('RESET ROLE');
    await db.exec(`UPDATE public.unidad SET codubi=1, codepr=1, estcomuni='Separada' WHERE codcom=${codcom}`);
    const coduni = await escalar<string>('SELECT coduni::text r FROM public.unidad WHERE codcom=$1', [codcom]);
    await login(1);

    await t.test('catálogos activos contienen solo los proveedores permitidos y conservan BIGINT como texto', async () => {
      const tipos = await escalar<TipoTechoCatalogo[]>('SELECT public.hu004_listar_tipos_techo() r');
      assert.deepEqual(tipos.filter(tipo => ['Sin techo','Lona','Techo clásico de fibra','Techo de fibra deportiva'].includes(tipo.nomtte))
        .map(tipo => [tipo.nomtte, tipo.reqprotte]), [
          ['Lona', false], ['Sin techo', false], ['Techo clásico de fibra', false], ['Techo de fibra deportiva', true]
        ]);
      assert.ok(tipos.every(tipo => typeof tipo.codtte === 'string'));
      const proveedores = await escalar<ProveedorTechoCatalogo[]>('SELECT public.hu004_listar_proveedores_techo() r');
      assert.deepEqual(proveedores.map(proveedor => proveedor.nompro), ['FIBRAT', 'FIVESA', 'JAVICAR']);
      assert.ok(proveedores.every(proveedor => typeof proveedor.codpro === 'string'));
      assert.ok(!tipos.some(tipo => tipo.nomtte === 'Tipo inactivo QA'));
    });

    await t.test('Gerente, Administradora y Vendedor consultan; consulta no expone columnas ajenas', async () => {
      for (const n of [1, 2, 3]) {
        await login(n);
        const config = await escalar<ConfiguracionTecho>('SELECT public.hu004_obtener_configuracion_techo($1) r', [coduni]);
        assert.deepEqual(config, { coduni, tipoTecho: null, proveedor: null, detalle: null });
      }
      await login(1);
      await assert.rejects(escalar('SELECT public.hu004_obtener_configuracion_techo(99999) r'), error('PT404'));
    });

    const codigos = async () => {
      const tipos = await escalar<TipoTechoCatalogo[]>('SELECT public.hu004_listar_tipos_techo() r');
      const proveedores = await escalar<ProveedorTechoCatalogo[]>('SELECT public.hu004_listar_proveedores_techo() r');
      return {
        tipo: (nombre: string) => tipos.find(fila => fila.nomtte === nombre)!.codtte,
        proveedor: (nombre: string) => proveedores.find(fila => fila.nompro === nombre)!.codpro
      };
    };
    const cod = await codigos();
    const actualizar = (tipo: string, proveedor: string | null = null, detalle: string | null = null) =>
      escalar<ConfiguracionTecho>('SELECT public.hu004_actualizar_configuracion_techo($1,$2,$3,$4) r',
        [coduni, tipo, proveedor, detalle]);

    await t.test('Gerente configura Sin techo, Administradora Lona y clásica sin proveedor', async () => {
      await login(1);
      let resultado = await actualizar(cod.tipo('Sin techo'));
      assert.equal(resultado.tipoTecho?.nombre, 'Sin techo');
      assert.equal(resultado.proveedor, null); assert.equal(resultado.detalle, null);
      await login(2);
      resultado = await actualizar(cod.tipo('Lona'));
      assert.equal(resultado.tipoTecho?.nombre, 'Lona'); assert.equal(resultado.proveedor, null);
      await login(1);
      resultado = await actualizar(cod.tipo('Techo clásico de fibra'));
      assert.equal(resultado.tipoTecho?.nombre, 'Techo clásico de fibra');
      assert.equal(resultado.proveedor, null); assert.equal(resultado.detalle, null);
    });

    await t.test('fibra deportiva acepta FIVESA, JAVICAR, FIBRAT y detalle opcional', async () => {
      for (const [n, nombre] of [[2, 'FIVESA'], [1, 'JAVICAR'], [2, 'FIBRAT']] as const) {
        await login(n);
        const config = await actualizar(cod.tipo('Techo de fibra deportiva'), cod.proveedor(nombre), nombre === 'FIVESA' ? 'Cámara de retroceso' : null);
        assert.equal(config.tipoTecho?.nombre, 'Techo de fibra deportiva');
        assert.equal(config.proveedor?.nombre, nombre);
        assert.equal(config.detalle, nombre === 'FIVESA' ? 'Cámara de retroceso' : null);
      }
    });

    await t.test('reglas de tipo y proveedor se validan en PostgreSQL sin cambios parciales', async () => {
      await login(1);
      await assert.rejects(actualizar(cod.tipo('Techo de fibra deportiva')), error('PT421'));
      await assert.rejects(actualizar(cod.tipo('Techo de fibra deportiva'), '99999'), error('PT422'));
      await assert.rejects(actualizar(cod.tipo('Techo de fibra deportiva'), proveedorNoPermitido), error('PT422'));
      await administrativo("UPDATE public.proveedor SET estpro=false WHERE nompro='FIBRAT'");
      await assert.rejects(actualizar(cod.tipo('Techo de fibra deportiva'), cod.proveedor('FIBRAT')), error('PT422'));
      await administrativo("UPDATE public.proveedor SET estpro=true WHERE nompro='FIBRAT'");
      await assert.rejects(actualizar(cod.tipo('Sin techo'), cod.proveedor('FIVESA')), error('PT400'));
      await assert.rejects(actualizar(cod.tipo('Sin techo'), null, 'Detalle no permitido'), error('PT400'));
      await assert.rejects(actualizar('99999'), error('PT420'));
       await assert.rejects(actualizar(tipoInactivo), error('PT420'));
      const estado = await escalar<ConfiguracionTecho>('SELECT public.hu004_obtener_configuracion_techo($1) r', [coduni]);
      assert.equal(estado.tipoTecho?.nombre, 'Techo de fibra deportiva');
      assert.equal(estado.proveedor?.nombre, 'FIBRAT');
    });

    await t.test('Vendedor no actualiza y sin identidad se deniega en PostgreSQL', async () => {
      await login(3);
      await assert.rejects(actualizar(cod.tipo('Sin techo')), error('42501'));
      await db.exec("RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','',false)");
      await assert.rejects(db.query('SELECT public.hu004_listar_tipos_techo()'), error('42501'));
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(db.query('SELECT public.hu004_listar_proveedores_techo()'), error('42501'));
    });

    await t.test('actualización solo cambia techo y mantiene proveedor nulo donde corresponde, codepr, codubi y estado', async () => {
      await db.exec('RESET ROLE; SET ROLE authenticated; SELECT set_config(\'request.jwt.claim.sub\',\'00000000-0000-0000-0000-000000000001\',false)');
      await actualizar(cod.tipo('Techo clásico de fibra'));
      await assert.rejects(db.exec("UPDATE public.unidad SET codtte=1 WHERE coduni=1"), error('42501'));
      await db.exec('RESET ROLE');
      const final = (await db.query<UnidadPreservada>(`SELECT codtte::text,codpro::text,codepr::text,codubi::text,estcomuni,codcom::text,codmod::text,nummotuni,chauni
        FROM public.unidad WHERE coduni=$1`, [coduni])).rows[0];
      assert.equal(final.codpro, null); assert.equal(final.estcomuni, 'Separada');
      assert.equal(final.codepr, '1'); assert.equal(final.codubi, '1');
      assert.equal(final.codcom, codcom); assert.equal(final.codmod, '1');
      assert.equal(final.nummotuni, 'M-TECHO-1'); assert.equal(final.chauni, 'C-TECHO-1');
    });

    await t.test('migración se reaplica sin duplicar catálogos y HU-026/HU-002/HU-007 siguen disponibles', async () => {
      await db.exec('RESET ROLE');
      await db.exec(migracion);
      assert.equal(await escalar<number>("SELECT count(*)::int r FROM public.tipotecho WHERE nomtte IN ('Sin techo','Lona','Techo clásico de fibra','Techo de fibra deportiva')"), 4);
      assert.equal(await escalar<number>("SELECT count(*)::int r FROM public.proveedor WHERE nompro IN ('FIVESA','JAVICAR','FIBRAT')"), 3);
      await login(1);
      await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
        SELECT public.hu026_rol_actual(); SELECT public.hu007_usuario_actual();
        SELECT to_regprocedure('public.hu002_identificar_unidades(bigint,jsonb)')`);
    });
  } finally { await db.close(); }
});
