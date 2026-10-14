import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const esquema = readFileSync('tests/fixtures/esquema-base.sql', 'utf8');
const hu026 = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
const hu010 = readFileSync('supabase/migrations/202610100002_hu010_sedes_publicas.sql', 'utf8');
const nuevaMigracion = readFileSync('supabase/migrations/202610130001_hu026_sedes_canal_whatsapp.sql', 'utf8');

interface ErrorSQL { code: string }
interface Resultado<T> { r: T }

test('HU-026/HU-010: escritura atómica de ubicaciones/sedes y actualización protegida de canal WhatsApp', async t => {
  const db = new PGlite();
  const gerente = '00000000-0000-0000-0000-000000000001';
  const admin = '00000000-0000-0000-0000-000000000002';
  const vendedor = '00000000-0000-0000-0000-000000000003';
  const codigo = (expected: string) => (error: unknown) => (error as ErrorSQL).code === expected;
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(esquema);
    await db.exec(hu026);
    await db.exec(hu010);
    await db.exec(nuevaMigracion);
    // Reaplicar la migración confirma que sus RPC son reemplazables y los grants se mantienen.
    await db.exec(nuevaMigracion);
    await db.exec(`INSERT INTO auth.users VALUES ('${gerente}'),('${admin}'),('${vendedor}');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        SELECT id,row_number() OVER (ORDER BY id),'QA','Prueba',id::text||'@test.local' FROM auth.users;`);

    const login = async (uuid: string) => db.exec(`RESET ROLE; SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${uuid}',false)`);
    const asAdmin = async <T>(uuid: string, sql: string, args: unknown[] = []) => {
      await login(uuid);
      try { return (await db.query<Resultado<T>>(sql, args)).rows[0].r; }
      finally { await db.exec('RESET ROLE'); }
    };
    const rootQuery = async <T>(sql: string, args: unknown[] = []) => {
      await db.exec('RESET ROLE');
      return (await db.query<T>(sql, args)).rows;
    };
    const crear = (uuid: string, nombre: string, tipo: string, telefono: string | null = null, horario: string | null = null) =>
      asAdmin<Record<string, unknown>>(uuid,
        'SELECT public.hu026_crear_ubicacion($1,$2,$3,$4,$5) r', [nombre, tipo, null, telefono, horario]);
    const editar = (uuid: string, id: string, nombre: string, tipo: string, telefono: string | null, horario: string | null, cambiaTel: boolean, cambiaHorario: boolean) =>
      asAdmin<Record<string, unknown>>(uuid,
        'SELECT public.hu026_actualizar_ubicacion($1,$2,$3,$4,$5,$6,$7,$8) r',
        [id, nombre, tipo, null, telefono, horario, cambiaTel, cambiaHorario]);
    const cambiarEstado = (uuid: string, id: string, estado: boolean) =>
      asAdmin<Record<string, unknown>>(uuid, 'SELECT public.hu026_cambiar_estado_ubicacion($1,$2) r', [id, estado]);

    await t.test('crear ubicación no Sede no crea fila en sede', async () => {
      const lugar = await crear(gerente, 'Almacén RPC QA', 'Almacen');
      assert.equal(lugar.tipubi, 'Almacen');
      assert.equal((await rootQuery<{ n: number }>('SELECT count(*)::int n FROM sede WHERE codubi=$1', [lugar.codubi]))[0].n, 0);
    });

    let idSede = '';
    await t.test('crear Sede guarda teléfono/horario en sede y responde con ambos', async () => {
      const lugar = await crear(admin, 'Sede RPC QA', 'Sede', '999000001', 'Lunes a sábado');
      idSede = String(lugar.codubi);
      assert.equal(lugar.telsed, '999000001');
      assert.equal(lugar.horsed, 'Lunes a sábado');
      const filas = await rootQuery<{ telsed: string; horsed: string }>('SELECT telsed,horsed FROM sede WHERE codubi=$1', [idSede]);
      assert.deepEqual(filas[0], { telsed: '999000001', horsed: 'Lunes a sábado' });
      const columnas = await rootQuery<{ existe: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ubicacion' AND column_name IN ('telsed','horsed')
      ) existe`);
      assert.equal(columnas[0].existe, false);
    });

    await t.test('un fallo al insertar sede revierte también la ubicación', async () => {
      await rootQuery(`CREATE FUNCTION public.hu026_test_falla_sede() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.telsed = 'FALLO' THEN RAISE EXCEPTION USING ERRCODE='PT498'; END IF; RETURN NEW; END $$`);
      await rootQuery('CREATE TRIGGER hu026_test_falla_sede BEFORE INSERT ON public.sede FOR EACH ROW EXECUTE FUNCTION public.hu026_test_falla_sede()');
      try {
        await assert.rejects(crear(gerente, 'Ubicación que revierte QA', 'Sede', 'FALLO'), codigo('PT498'));
        assert.equal((await rootQuery<{ n: number }>("SELECT count(*)::int n FROM ubicacion WHERE nomubi='Ubicación que revierte QA'"))[0].n, 0);
      } finally {
        await rootQuery('DROP TRIGGER hu026_test_falla_sede ON public.sede');
        await rootQuery('DROP FUNCTION public.hu026_test_falla_sede()');
      }
    });

    await t.test('convertir otra ubicación a Sede crea sede y actualizar campos respeta omitidos', async () => {
      const lugar = await crear(gerente, 'Conversión RPC QA', 'Proveedor');
      const convertida = await editar(admin, String(lugar.codubi), 'Conversión RPC QA', 'Sede', null, 'Horario nuevo', false, true);
      assert.equal(convertida.horsed, 'Horario nuevo');
      assert.equal(convertida.telsed, null);
      const actualizada = await editar(gerente, idSede, 'Sede RPC QA', 'Sede', '999000002', null, true, true);
      assert.equal(actualizada.telsed, '999000002');
      assert.equal(actualizada.horsed, null);
    });

    await t.test('Sede a otro tipo conserva datos y desactiva historial; reactivación sincroniza sede', async () => {
      const proveedor = await editar(admin, idSede, 'Sede RPC QA', 'Proveedor', null, null, false, false);
      assert.equal(proveedor.tipubi, 'Proveedor');
      const estadoHistorico = await rootQuery<{ estsed: boolean; telsed: string }>('SELECT estsed,telsed FROM sede WHERE codubi=$1', [idSede]);
      assert.deepEqual(estadoHistorico[0], { estsed: false, telsed: '999000002' });

      await editar(admin, idSede, 'Sede RPC QA', 'Sede', null, null, false, false);
      await cambiarEstado(gerente, idSede, false);
      let estados = await rootQuery<{ estubi: boolean; estsed: boolean }>(
        'SELECT u.estubi,s.estsed FROM ubicacion u JOIN sede s USING(codubi) WHERE u.codubi=$1', [idSede]);
      assert.deepEqual(estados[0], { estubi: false, estsed: false });
      await cambiarEstado(admin, idSede, true);
      estados = await rootQuery<{ estubi: boolean; estsed: boolean }>(
        'SELECT u.estubi,s.estsed FROM ubicacion u JOIN sede s USING(codubi) WHERE u.codubi=$1', [idSede]);
      assert.deepEqual(estados[0], { estubi: true, estsed: true });
    });

    await t.test('preserva la restricción HU-026 que bloquea desactivación con unidades', async () => {
      await rootQuery('INSERT INTO tipomotocar(nomtmo) VALUES (\'Modelo ubicaciones QA\')');
      await rootQuery("INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Unidad sede QA','Descripción','Características')");
      await rootQuery("INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Rojo',1)");
      await rootQuery("INSERT INTO unidad(codcom,codmod,codubi,nummotuni,chauni) VALUES (1,1,$1,'MOTOR-SEDE-QA','CHASIS-SEDE-QA')", [idSede]);
      await assert.rejects(cambiarEstado(gerente, idSede, false), codigo('PT409'));
      const estado = await rootQuery<{ estubi: boolean; estsed: boolean }>(
        'SELECT u.estubi,s.estsed FROM ubicacion u JOIN sede s USING(codubi) WHERE u.codubi=$1', [idSede]);
      assert.deepEqual(estado[0], { estubi: true, estsed: true });
    });

    await t.test('actualiza solo un canal existente, normaliza teléfono y protege permisos/grants', async () => {
      await rootQuery(`INSERT INTO canalwhatsapp(nomcwa,numcwa,enlcwa) VALUES
        ('Canal migración QA','51907000001','https://wa.me/51907000001'),
        ('Canal duplicado QA','51907000002','https://wa.me/51907000002')`);
      const actual = await asAdmin<Record<string, unknown>>(gerente,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ numcwa: '+51 (907) 000-003' })]);
      assert.equal(actual.numcwa, '51907000003');
      assert.equal(actual.enlcwa, 'https://wa.me/51907000003');

      const parActualizado = await asAdmin<Record<string, unknown>>(gerente,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ numcwa: '+51 (907) 000-004', enlcwa: 'https://wa.me/51907000004' })]);
      assert.equal(parActualizado.numcwa, '51907000004');
      assert.equal(parActualizado.enlcwa, 'https://wa.me/51907000004');

      await assert.rejects(asAdmin(admin,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ numcwa: '51907000005', enlcwa: 'https://wa.me/51907000004' })]), codigo('PT400'));
      const trasRechazo = (await rootQuery<{ numcwa: string; enlcwa: string }>(
        'SELECT numcwa,enlcwa FROM canalwhatsapp WHERE codcwa=$1', [1]))[0];
      assert.deepEqual(trasRechazo, { numcwa: '51907000004', enlcwa: 'https://wa.me/51907000004' });

      const soloNombre = await asAdmin<Record<string, unknown>>(gerente,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ nomcwa: 'Atención comercial' })]);
      assert.equal(soloNombre.nomcwa, 'Atención comercial');
      assert.equal(soloNombre.numcwa, '51907000004');
      assert.equal(soloNombre.enlcwa, 'https://wa.me/51907000004');

      await assert.rejects(asAdmin(admin,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ numcwa: '51907000002' })]), codigo('23505'));
      await assert.rejects(asAdmin(vendedor,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [1, JSON.stringify({ estcwa: false })]), codigo('42501'));
      await assert.rejects(asAdmin(gerente,
        'SELECT public.hu013_actualizar_canal_whatsapp($1,$2::jsonb) r',
        [999, JSON.stringify({ estcwa: false })]), codigo('PT404'));
      const permisos = await rootQuery<{ anon: boolean; auth: boolean }>(`SELECT
        has_function_privilege('anon','public.hu013_actualizar_canal_whatsapp(bigint,jsonb)','EXECUTE') anon,
        has_function_privilege('authenticated','public.hu013_actualizar_canal_whatsapp(bigint,jsonb)','EXECUTE') auth`);
      assert.deepEqual(permisos[0], { anon: false, auth: true });
    });

    await t.test('anon no puede usar RPC administrativa ni leer sede directamente; HU-010 sigue pública', async () => {
      await db.exec('RESET ROLE; SET ROLE anon');
      try {
        await db.query('SELECT public.hu010_sedes_publicas()');
        await assert.rejects(db.query('SELECT * FROM public.sede'), codigo('42501'));
        await assert.rejects(db.query("SELECT public.hu026_listar_ubicaciones(NULL::boolean)"), codigo('42501'));
        await assert.rejects(db.query("SELECT public.hu013_actualizar_canal_whatsapp(1,'{\"estcwa\":false}'::jsonb)"), codigo('42501'));
      } finally { await db.exec('RESET ROLE'); }
      await db.exec('SET ROLE authenticated');
      try {
        await assert.rejects(db.query('SELECT * FROM public.sede'), codigo('42501'));
        // HU-026 conserva su lectura autenticada de ubicacion.
        await db.query('SELECT codubi FROM public.ubicacion LIMIT 1');
      } finally { await db.exec('RESET ROLE'); }
    });
  } finally {
    await db.close();
  }
});
