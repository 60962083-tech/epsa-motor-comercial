import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { InventarioResultado } from '../src/types/inventario.types';

interface Valor<T> { r: T }
interface ErrorSQL { code?: string }
interface DatosBase { comas: string; proveedor: string; destino: string; modeloNoPublicado: string }

const fixture = readFileSync('tests/fixtures/esquema-base.sql', 'utf8');
const hu026 = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
const hu034 = readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8');
const hu002 = readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8');
const hu007 = readFileSync('supabase/migrations/202610070001_hu007_permisos_rol.sql', 'utf8');
const hu003 = readFileSync('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql', 'utf8');
const hu001 = readFileSync('supabase/migrations/202610210001_hu001_consulta_inventario.sql', 'utf8');

test('HU-001 PostgreSQL: proyección segura, filtros, cantidades, HU-003 y permisos', async t => {
  const db = new PGlite();
  let usuario = 1;
  const login = async (n = usuario) => {
    usuario = n;
    await db.exec(`RESET ROLE; SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000000${n}',false)`);
  };
  const administrativo = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.exec('RESET ROLE');
    try { return await fn(); } finally { await login(usuario); }
  };
  const escalar = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
    (await db.query<Valor<T>>(sql, params)).rows[0].r;
  const consultar = (filtros: Partial<{
    codubi: string | null; codmod: string | null; estado: string | null; color: string | null;
    codtte: string | null; codepr: string | null; limite: number; offset: number;
  }> = {}) => escalar<InventarioResultado>(
    'SELECT public.hu001_consultar_inventario($1,$2,$3,$4,$5,$6,$7,$8) r', [
      filtros.codubi ?? null, filtros.codmod ?? null, filtros.estado ?? null,
      filtros.color ?? null, filtros.codtte ?? null, filtros.codepr ?? null,
      filtros.limite ?? 50, filtros.offset ?? 0
    ]
  );
  const error = (codigo: string) => (e: unknown) => (e as ErrorSQL).code === codigo;

  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(fixture);
    await db.exec(`INSERT INTO public.ubicacion(nomubi,tipubi) VALUES
      ('Comas QA','Sede'),('Proveedor QA','Proveedor'),('FIVESA QA','Proveedor'),('Almacen QA','Almacen')`);
    await db.exec(hu026);
    await db.exec(hu034);
    await db.exec(hu002);
    await db.exec(hu007);
    await db.exec(hu003);
    await db.exec(`INSERT INTO auth.users VALUES
        ('00000000-0000-0000-0000-000000000001'),
        ('00000000-0000-0000-0000-000000000002'),
        ('00000000-0000-0000-0000-000000000003');
      INSERT INTO public.rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO public.usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        SELECT id, row_number() OVER (ORDER BY id),
          CASE row_number() OVER (ORDER BY id) WHEN 1 THEN 'Gerente' WHEN 2 THEN 'Administradora' ELSE 'Vendedor' END,
          'QA', id::text || '@test.local' FROM auth.users;
      INSERT INTO public.tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO public.modelo(codtmo,nommod,desmod,carmod,estmod) VALUES
        (1,'Modelo publicado QA','Descripción','Características','Publicado'),
        (1,'Modelo interno QA','Descripción','Características','Borrador');
      INSERT INTO public.tipotecho(nomtte) VALUES ('Lona QA');
      INSERT INTO public.estadopreparacion(nomepr) VALUES ('Lista QA');
      INSERT INTO public.tipodocumento(nomtdo) VALUES ('DNI');`);
    await db.exec(hu001);

    const base = await administrativo(async () => {
      const ubicaciones = (await db.query<{ codubi: string; nomubi: string }>(
        `SELECT codubi::text, nomubi FROM public.ubicacion WHERE nomubi IN ('Comas QA','Proveedor QA','FIVESA QA')`
      )).rows;
      const ids = Object.fromEntries(ubicaciones.map(row => [row.nomubi, row.codubi]));
      const codmod = (await db.query<{ codmod: string }>("SELECT codmod::text FROM public.modelo WHERE nommod='Modelo interno QA'")).rows[0].codmod;
      const codtte = (await db.query<{ codtte: string }>("SELECT codtte::text FROM public.tipotecho WHERE nomtte='Lona QA'")).rows[0].codtte;
      const codepr = (await db.query<{ codepr: string }>("SELECT codepr::text FROM public.estadopreparacion WHERE nomepr='Lista QA'")).rows[0].codepr;
      const compra1 = (await db.query<{ codcom: string }>(
        `INSERT INTO public.compra(codmod,codusu,colcom,cancom) VALUES ($1,1,'Azul',2) RETURNING codcom::text`, [codmod]
      )).rows[0].codcom;
      const compra2 = (await db.query<{ codcom: string }>(
        `INSERT INTO public.compra(codmod,codusu,colcom,cancom) VALUES (1,2,'Azul',1) RETURNING codcom::text`
      )).rows[0].codcom;
      const compra4 = (await db.query<{ codcom: string }>(
        `INSERT INTO public.compra(codmod,codusu,colcom,cancom) VALUES ($1,2,'Rojo',1) RETURNING codcom::text`, [codmod]
      )).rows[0].codcom;
      const compra5 = (await db.query<{ codcom: string }>(
        `INSERT INTO public.compra(codmod,codusu,colcom,cancom) VALUES (1,2,'Negro',4) RETURNING codcom::text`
      )).rows[0].codcom;
      await db.query(`INSERT INTO public.compra(codmod,codusu,colcom,cancom) VALUES ($1,1,'Negro',2)`, [codmod]);
      await db.query(`INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES ($1,'Factura privada QA','F-PRIVADA','2026-10-20',2,1)`, [compra1]);
      await db.query(`INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES ($1,'Factura privada QA','F-PRIVADA-2','2026-10-20',1,2)`, [compra4]);
      await db.query(`INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES ($1,'Factura privada QA','F-PRIVADA-3','2026-10-20',1,2)`, [compra2]);
      await db.query(`INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
        VALUES ($1,'Factura discrepante QA','F-DISCREPANTE','2026-10-20',3,2)`, [compra5]);
      const unidad1 = (await db.query<{ coduni: string }>(
        `INSERT INTO public.unidad(codcom,codmod,codubi,codtte,codepr,nummotuni,chauni,coluni,estcomuni)
         VALUES ($1,$2,$3,$4,$5,'MOTOR-PRIVADO','CHASIS-PRIVADO','Azul','Disponible') RETURNING coduni::text`,
        [compra1, codmod, ids['Proveedor QA'], codtte, codepr]
      )).rows[0].coduni;
      const unidad2 = (await db.query<{ coduni: string }>(
        `INSERT INTO public.unidad(codcom,codmod,nummotuni,chauni,coluni,estcomuni)
         VALUES ($1,$2,'MOTOR-2','CHASIS-2','Rojo','Separada') RETURNING coduni::text`, [compra4, codmod]
      )).rows[0].coduni;
      const unidad3 = (await db.query<{ coduni: string }>(
        `INSERT INTO public.unidad(codcom,codmod,codubi,nummotuni,chauni,coluni,estcomuni)
         VALUES ($1,1,$2,'MOTOR-3','CHASIS-3','Azul','Vendida') RETURNING coduni::text`,
        [compra2, ids['Comas QA']]
      )).rows[0].coduni;
      await db.exec(`INSERT INTO public.cliente(codtdo,numdoccli,nomcli,telcli,corcli,dircli)
        VALUES (1,'DOCUMENTO-PRIVADO','Cliente privado QA','999999999','privado@test.local','Dirección privada QA');
        INSERT INTO public.separacion(coduni,codcli,codusu,metpagsep,monadesep,refsep)
          VALUES (${unidad1},1,1,'Transferencia',150,'REFERENCIA-PAGO-PRIVADA');
        INSERT INTO public.venta(coduni,codcli,codusu,modcomven,obsven)
          VALUES (${unidad2},1,2,'Contado','Observación privada de venta');`);
      return { comas: ids['Comas QA'], proveedor: ids['Proveedor QA'], destino: ids['FIVESA QA'],
        modeloNoPublicado: codmod, codtte, codepr, unidad1, unidad2, unidad3 };
    });
    await login(1);

    await t.test('devuelve cada unidad una sola vez y modela unidad.coluni, incluido modelo no publicado', async () => {
      const r = await consultar();
      assert.equal(r.items.length, 3);
      assert.equal(r.total, 3);
      assert.equal(new Set(r.items.map(u => u.coduni)).size, 3);
      const unidad1 = r.items.find(u => u.coduni === base.unidad1)!;
      assert.deepEqual(unidad1.modelo, { codmod: base.modeloNoPublicado, nommod: 'Modelo interno QA' });
      assert.equal(unidad1.color, 'Azul');
      assert.equal(unidad1.ubicacionConfirmada?.codubi, base.proveedor);
      assert.equal(unidad1.ubicacionConfirmada?.tipubi, 'Proveedor');
    });

    await t.test('proyecta techo/preparación configurados y NULL sin inventar etiquetas', async () => {
      const r = await consultar();
      const configurada = r.items.find(u => u.coduni === base.unidad1)!;
      const vacia = r.items.find(u => u.coduni === base.unidad2)!;
      assert.deepEqual(configurada.techo, { codtte: base.codtte, nomtte: 'Lona QA' });
      assert.deepEqual(configurada.preparacion, { codepr: base.codepr, nomepr: 'Lista QA' });
      assert.equal(vacia.techo, null); assert.equal(vacia.preparacion, null);
      assert.equal(vacia.ubicacionConfirmada, null); assert.equal(vacia.movimientoActivo, null);
    });

    await t.test('separación y venta no duplican ni alteran la situación comercial almacenada', async () => {
      const r = await consultar();
      assert.equal(r.items.find(u => u.coduni === base.unidad1)?.situacionComercial, 'Disponible');
      assert.equal(r.items.find(u => u.coduni === base.unidad2)?.situacionComercial, 'Separada');
      assert.equal(r.items.find(u => u.coduni === base.unidad3)?.situacionComercial, 'Vendida');
      assert.equal(await administrativo(() => escalar<string>(
        'SELECT estcomuni r FROM public.unidad WHERE coduni=$1', [base.unidad2]
      )), 'Separada');
      assert.equal(r.items.length, 3);
    });

    await t.test('resumen cuenta solo compras facturadas e identificables según HU-002', async () => {
      const r = await consultar({ color: 'Rojo' });
      assert.equal(r.total, 1);
      assert.deepEqual(r.resumen, { unidadesIdentificadas: 3, cantidadPendienteIdentificacion: 1 });
    });

    await t.test('filtros simples y combinados usan los campos reales; ubicación solo es la confirmada', async () => {
      assert.equal((await consultar({ codubi: base.proveedor })).items.length, 1);
      assert.equal((await consultar({ codmod: base.modeloNoPublicado })).items.length, 2);
      assert.equal((await consultar({ estado: 'Vendida' })).items.length, 1);
      assert.equal((await consultar({ color: 'Azul' })).items.length, 2);
      assert.equal((await consultar({ codtte: base.codtte })).items.length, 1);
      assert.equal((await consultar({ codepr: base.codepr })).items.length, 1);
      assert.equal((await consultar({ codubi: base.comas, codmod: base.modeloNoPublicado, color: 'Azul' })).items.length, 0);
      assert.deepEqual((await consultar({ codmod: '999' })).items, []);
      const pagina = await consultar({ limite: 1, offset: 1 });
      assert.equal(pagina.items.length, 1); assert.equal(pagina.total, 3);
    });

    await t.test('movimiento HU-003 conserva origen confirmado y expone destino aparte hasta recepción', async () => {
      const salida = await escalar<{ codmub: string; estado: string }>(
        'SELECT public.hu003_iniciar_movimiento($1,$2,$3,NULL) r', [base.unidad1, base.proveedor, base.destino]
      );
      assert.equal(salida.estado, 'En transito');
      const durante = (await consultar({ codubi: base.proveedor })).items.find(u => u.coduni === base.unidad1)!;
      assert.equal(durante.ubicacionConfirmada?.codubi, base.proveedor);
      assert.deepEqual(durante.movimientoActivo, {
        codmub: salida.codmub,
        estado: 'En transito',
        destino: { codubi: base.destino, nomubi: 'FIVESA QA' }
      });
      assert.equal((await consultar({ codubi: base.destino })).items.length, 0);

      await escalar('SELECT public.hu003_confirmar_recepcion($1,$2) r', [base.unidad1, salida.codmub]);
      const recibida = (await consultar({ codubi: base.destino })).items.find(u => u.coduni === base.unidad1)!;
      assert.equal(recibida.ubicacionConfirmada?.codubi, base.destino);
      assert.equal(recibida.movimientoActivo, null);
    });

    await t.test('autorización en RPC permite los tres roles activos y bloquea anon y acceso directo', async () => {
      for (const n of [1, 2, 3]) {
        await login(n);
        assert.equal((await consultar()).items.length, 3);
      }
      assert.equal(await administrativo(() => escalar<boolean>(
        "SELECT has_function_privilege('authenticated','public.hu001_consultar_inventario(bigint,bigint,text,text,bigint,bigint,integer,integer)','EXECUTE') r"
      )), true);
      assert.equal(await administrativo(() => escalar<boolean>(
        "SELECT has_function_privilege('anon','public.hu001_consultar_inventario(bigint,bigint,text,text,bigint,bigint,integer,integer)','EXECUTE') r"
      )), false);
      assert.equal(await administrativo(() => escalar<boolean>(
        "SELECT has_table_privilege('authenticated','public.unidad','SELECT') r"
      )), false);
      assert.equal(await administrativo(() => escalar<boolean>(
        "SELECT has_table_privilege('authenticated','public.unidad','INSERT,UPDATE,DELETE') r"
      )), false);
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(
        db.exec('SELECT public.hu001_consultar_inventario()'), error('42501')
      );
    });

    await t.test('HU-003 limita a un movimiento activo y el JOIN de HU-001 conserva una sola fila', async () => {
      const indice = await administrativo(() => escalar<boolean>(
        "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_indexes WHERE schemaname='public' AND indexname='uq_movubicacion_unidad_activa') r"
      ));
      assert.equal(indice, true);
      await login(1);
      assert.equal((await consultar()).items.length, 3);
      assert.equal(new Set((await consultar()).items.map(u => u.coduni)).size, 3);
    });

    await t.test('la proyección no expone series, compra, factura, cliente ni campos internos', async () => {
      await login(1);
      const serializado = JSON.stringify(await consultar());
      for (const dato of ['MOTOR-PRIVADO', 'CHASIS-PRIVADO', 'Factura privada QA', 'DOCUMENTO-PRIVADO',
        'REFERENCIA-PAGO-PRIVADA', 'Observación privada de venta', 'codcom', 'codcli', 'nummotuni',
        'chauni', 'obsuni', 'factura', 'cliente', 'telcli', 'corcli', 'dircli'])
        assert.equal(serializado.includes(dato), false, dato);
      const llaves = Object.keys((await consultar()).items[0]).sort();
      assert.deepEqual(llaves, ['coduni', 'color', 'modelo', 'movimientoActivo', 'preparacion',
        'situacionComercial', 'techo', 'ubicacionConfirmada'].sort());
    });

    await t.test('validación defensiva de parámetros de la RPC', async () => {
      await assert.rejects(consultar({ codubi: '0' }), error('PT400'));
      await assert.rejects(consultar({ limite: 101 }), error('PT400'));
      await assert.rejects(escalar('SELECT public.hu001_consultar_inventario(NULL,NULL,NULL,NULL,NULL,NULL,NULL,0)'), error('PT400'));
    });
  } finally {
    await db.close();
  }
});
