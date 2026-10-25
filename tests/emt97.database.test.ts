import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

interface QueryResult<T> { rows: T[] }
interface SqlError { code?: string }

const fixture = readFileSync('tests/fixtures/esquema-base.sql', 'utf8');
const hu026 = readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8');
const hu010 = readFileSync('supabase/migrations/202610100002_hu010_sedes_publicas.sql', 'utf8');
const hu003 = readFileSync('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql', 'utf8');
const emt97 = readFileSync('supabase/migrations/202610220001_emt97_contacto_ubicacion.sql', 'utf8');

test('EMT-97 PostgreSQL: telubi, RLS, proyección pública y compatibilidad HU-003', async t => {
  const db = new PGlite();
  const uuids = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003'
  ];
  const porUsuario = async <T>(numero: number, sql: string, parametros: unknown[] = []): Promise<T[]> => {
    await db.exec(`RESET ROLE; SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${uuids[numero - 1]}',false)`);
    try { return (await db.query<T>(sql, parametros)).rows; }
    finally { await db.exec('RESET ROLE'); }
  };
  const comoAnon = async <T>(sql: string): Promise<T[]> => {
    await db.exec('RESET ROLE; SET ROLE anon');
    try { return (await db.query<T>(sql)).rows; }
    finally { await db.exec('RESET ROLE'); }
  };

  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(fixture);
    await db.exec(hu026);
    await db.exec(hu010);
    await db.exec(hu003);
    await db.exec(emt97);
    await db.exec(`INSERT INTO auth.users VALUES
        ('${uuids[0]}'),('${uuids[1]}'),('${uuids[2]}');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        SELECT id,row_number() OVER (ORDER BY id),'QA','EMT-97',id::text||'@test.local'
        FROM auth.users;`);

    await t.test('la columna es VARCHAR(40), nullable y acepta NULL', async () => {
      const { rows } = await db.query<{ data_type: string; is_nullable: string; max_chars: number }>(`
        SELECT data_type,is_nullable,character_maximum_length AS max_chars
        FROM information_schema.columns
        WHERE table_schema='public' AND table_name='ubicacion' AND column_name='telubi'`);
      assert.deepEqual(rows[0], { data_type: 'character varying', is_nullable: 'YES', max_chars: 40 });
      const insertado = await porUsuario<{ telubi: null }>(1,
        `INSERT INTO ubicacion(nomubi,tipubi,telubi) VALUES ('Contacto nulo QA','Almacen',NULL) RETURNING telubi`);
      assert.equal(insertado[0].telubi, null);
    });

    await t.test('normaliza vacío y espacios directos a NULL; recorta bordes y conserva formato', async () => {
      const vacios = await porUsuario<{ nomubi: string; telubi: string | null }>(1, `
        INSERT INTO ubicacion(nomubi,tipubi,telubi) VALUES
          ('Contacto vacío QA','Almacen',''),('Contacto espacios QA','Almacen','   '),
          ('Contacto formato QA','Almacen','  +51 999 999 999  '),
          ('Contacto fijo QA','Almacen','01 555 1234'),
          ('Contacto móvil QA','Almacen','999999999'),
          ('Contacto paréntesis QA','Almacen','(01) 555-1234')
        RETURNING nomubi,telubi`);
      assert.deepEqual(vacios, [
        { nomubi: 'Contacto vacío QA', telubi: null },
        { nomubi: 'Contacto espacios QA', telubi: null },
        { nomubi: 'Contacto formato QA', telubi: '+51 999 999 999' },
        { nomubi: 'Contacto fijo QA', telubi: '01 555 1234' },
        { nomubi: 'Contacto móvil QA', telubi: '999999999' },
        { nomubi: 'Contacto paréntesis QA', telubi: '(01) 555-1234' }
      ]);
      const persistido = await porUsuario<{ telubi: string }>(1,
        `SELECT telubi FROM ubicacion WHERE nomubi='Contacto formato QA'`);
      assert.equal(persistido[0].telubi, '+51 999 999 999');
    });

    await t.test('gerente y administradora conservan inserción y actualización directas con el CHECK', async () => {
      for (const [numero, nombre] of [[1, 'Contacto Gerente QA'], [2, 'Contacto Admin QA']] as const) {
        const insertado = await porUsuario<{ telubi: string }>(numero,
          `INSERT INTO ubicacion(nomubi,tipubi,telubi) VALUES ($1,'Proveedor','001234567') RETURNING telubi`, [nombre]);
        assert.equal(insertado[0].telubi, '001234567');
        await porUsuario(numero,
          `UPDATE ubicacion SET telubi='+51 999 999 999' WHERE nomubi=$1`, [nombre]);
        const consultado = await porUsuario<{ telubi: string }>(numero,
          `SELECT telubi FROM ubicacion WHERE nomubi=$1`, [nombre]);
        assert.equal(consultado[0].telubi, '+51 999 999 999');
      }
    });

    await t.test('el CHECK rechaza valores inválidos en escrituras directas authenticated', async () => {
      await porUsuario(1, `INSERT INTO ubicacion(nomubi,tipubi,telubi)
        VALUES ('Destino CHECK QA','Almacen','999999999')`);
      for (const valor of ['0', 'abc123', '999@999', '++51 999 999 999', '51+999999999', '<script>', 'tel:999999999']) {
        await assert.rejects(
          porUsuario(1, `UPDATE ubicacion SET telubi=$1 WHERE nomubi='Destino CHECK QA'`, [valor]),
          (error: unknown) => (error as SqlError).code === '23514'
        );
      }
      await assert.rejects(
        porUsuario(1, `UPDATE ubicacion SET telubi=$1 WHERE nomubi='Destino CHECK QA'`, ['1'.repeat(41)])
      );
    });

    await t.test('Vendedor consulta telubi pero RLS bloquea INSERT y UPDATE', async () => {
      const lectura = await porUsuario<{ telubi: string }>(3,
        `SELECT telubi FROM ubicacion WHERE nomubi='Contacto Gerente QA'`);
      assert.equal(lectura[0].telubi, '+51 999 999 999');
      await assert.rejects(
        porUsuario(3, `INSERT INTO ubicacion(nomubi,tipubi,telubi)
          VALUES ('Vendedor no puede crear QA','Almacen','999999999')`),
        (error: unknown) => (error as SqlError).code === '42501'
      );
      const actualizada = await porUsuario<{ telubi: string }>(3,
        `UPDATE ubicacion SET telubi='011234567' WHERE nomubi='Contacto Gerente QA' RETURNING telubi`);
      assert.deepEqual(actualizada, []);
      const persistido = await porUsuario<{ telubi: string }>(3,
        `SELECT telubi FROM ubicacion WHERE nomubi='Contacto Gerente QA'`);
      assert.equal(persistido[0].telubi, '+51 999 999 999');
    });

    await t.test('editar solo telubi conserva las otras columnas de ubicación', async () => {
      const antes = await db.query<{ nomubi: string; tipubi: string; dirubi: string; estubi: boolean }>(`
        SELECT nomubi,tipubi,dirubi,estubi FROM ubicacion WHERE nomubi='Contacto Gerente QA'`);
      await porUsuario(1, `UPDATE ubicacion SET telubi='(01) 555-1234' WHERE nomubi='Contacto Gerente QA'`);
      const despues = await db.query<{ nomubi: string; tipubi: string; dirubi: string; estubi: boolean }>(`
        SELECT nomubi,tipubi,dirubi,estubi FROM ubicacion WHERE nomubi='Contacto Gerente QA'`);
      assert.deepEqual(despues.rows, antes.rows);
    });

    await t.test('HU-010 sigue exponiendo exclusivamente sede.telsed y no telubi', async () => {
      const ubicacion = await db.query<{ codubi: number }>(`
        INSERT INTO ubicacion(nomubi,tipubi,telubi) VALUES ('Sede EMT-97 QA','Sede','001234567') RETURNING codubi`);
      await db.query(`INSERT INTO sede(codubi,telsed,horsed) VALUES ($1,'(01) 555-1234','Lunes a sábado')`, [ubicacion.rows[0].codubi]);
      const publicacion = await comoAnon<{ data: Array<Record<string, unknown>> }>(
        `SELECT public.hu010_sedes_publicas() AS data`);
      const sede = publicacion[0].data.find(fila => fila.nomsed === 'Sede EMT-97 QA');
      assert.deepEqual(sede, {
        codsed: '1', nomsed: 'Sede EMT-97 QA', dirsed: null,
        telsed: '(01) 555-1234', horsed: 'Lunes a sábado'
      });
      assert.equal(Object.hasOwn(sede ?? {}, 'telubi'), false);
      const telefonoSede = await db.query<{ telsed: string }>(
        `SELECT telsed FROM sede WHERE codubi=$1`, [ubicacion.rows[0].codubi]);
      assert.equal(telefonoSede.rows[0].telsed, '(01) 555-1234');
    });

    await t.test('la migración deja presente el índice de movimientos activos de HU-003', async () => {
      const { rows } = await db.query<{ indice: string | null }>(
        `SELECT pg_catalog.to_regclass('public.uq_movubicacion_unidad_activa')::text AS indice`);
      assert.equal(rows[0].indice, 'uq_movubicacion_unidad_activa');
    });

    await t.test('HU-003 inicia y confirma un movimiento sin interferencia de telubi', async () => {
      const origen = await db.query<{ codubi: string }>(`SELECT codubi::text FROM ubicacion WHERE nomubi='Comas'`);
      const destino = await db.query<{ codubi: string }>(`SELECT codubi::text FROM ubicacion WHERE nomubi='FIVESA'`);
      await db.exec(`INSERT INTO tipomotocar(nomtmo) VALUES ('Modelo EMT-97 QA');
        INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Moto EMT-97 QA','Descripción','Características');
        INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Azul',1);`);
      const unidad = await db.query<{ coduni: string }>(`
        INSERT INTO unidad(codcom,codmod,codubi,nummotuni,chauni)
        VALUES (1,1,$1,'MOTOR-EMT97-QA','CHASIS-EMT97-QA') RETURNING coduni::text`, [origen.rows[0].codubi]);
      const iniciado = await porUsuario<{ movimiento: Record<string, any> }>(1,
        `SELECT public.hu003_iniciar_movimiento($1::bigint,$2::bigint,$3::bigint,NULL) AS movimiento`,
        [unidad.rows[0].coduni, origen.rows[0].codubi, destino.rows[0].codubi]);
      const codmub = iniciado[0].movimiento.codmub;
      let ubicacionUnidad = await db.query<{ codubi: string }>(
        `SELECT codubi::text FROM unidad WHERE coduni=$1`, [unidad.rows[0].coduni]);
      assert.equal(ubicacionUnidad.rows[0].codubi, origen.rows[0].codubi);
      await porUsuario(1,
        `SELECT public.hu003_confirmar_recepcion($1::bigint,$2::bigint)`, [unidad.rows[0].coduni, codmub]);
      ubicacionUnidad = await db.query<{ codubi: string }>(
        `SELECT codubi::text FROM unidad WHERE coduni=$1`, [unidad.rows[0].coduni]);
      assert.equal(ubicacionUnidad.rows[0].codubi, destino.rows[0].codubi);
    });
  } finally {
    await db.close();
  }
});
