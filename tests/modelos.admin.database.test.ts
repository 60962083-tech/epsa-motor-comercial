import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const idGerente = '00000000-0000-0000-0000-000000000001';
const idAdministradora = '00000000-0000-0000-0000-000000000002';
const idVendedor = '00000000-0000-0000-0000-000000000003';

test('HU-012: migración administrativa, colores, precio, permisos y catálogo público', async () => {
  const db = new PGlite();
  const migracion = readFileSync('supabase/migrations/202610100003_hu012_admin_modelos.sql', 'utf8');
  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610070002_hu012_modelos_publicados.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610080002_hu009_ficha_modelo.sql', 'utf8'));
    await db.exec(`INSERT INTO tipomotocar(nomtmo) VALUES ('Triciclo');
      INSERT INTO auth.users(id) VALUES ('${idGerente}'),('${idAdministradora}'),('${idVendedor}');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu) VALUES
        ('${idGerente}',1,'Gerente','QA','gerente@example.test'),
        ('${idAdministradora}',2,'Admin','QA','admin@example.test'),
        ('${idVendedor}',3,'Vendedor','QA','vendedor@example.test');`);
    await db.exec(migracion);
    await db.exec(migracion);

    const conRol = async <T>(uuid: string, sql: string, params: unknown[] = []) => {
      await db.exec('RESET ROLE; SET ROLE authenticated');
      await db.query('SELECT set_config(\'request.jwt.claim.sub\',$1,false)', [uuid]);
      try { return await db.query<T>(sql, params); }
      finally { await db.exec('RESET ROLE'); }
    };
    const crear = async (uuid: string, nombre: string, estado: string, precio: number | null, colores: string[]) => {
      const resultado = await conRol<{ data: Record<string, unknown> }>(uuid,
        `SELECT public.hu012_crear_modelo($1::bigint,'Torito ' || $5::text,'Bajaj','Descripción','Características',$2,$3,$4) AS data`,
        [1, precio, colores, estado, nombre]);
      return resultado.rows[0].data;
    };

    const borrador = await crear(idGerente, '1', 'Borrador', null, [' Rojo ', 'Azul   Marino', 'rojo', ' azul marino ']);
    const noPublicado = await crear(idGerente, '2', 'No publicado', null, []);
    const sinPrecioNiColores = await crear(idAdministradora, '3', 'Borrador', null, []);
    assert.equal(borrador.premod, null);
    assert.deepEqual(borrador.colores, ['Azul Marino', 'Rojo']);
    assert.equal(noPublicado.estmod, 'No publicado');
    assert.deepEqual(sinPrecioNiColores.colores, []);
    await assert.rejects(conRol(idGerente,
      `SELECT public.hu012_crear_modelo($1::bigint,$2,'Bajaj','Descripción','Características',NULL,$3::text[],'Borrador')`,
      [1, 'Creación debe revertirse', ['   ']]), { code: 'PT400' });
    assert.equal((await db.query('SELECT count(*)::int AS total FROM modelo WHERE nommod=$1', ['Creación debe revertirse'])).rows[0].total, 0);
    const estadosAdminInicial = await conRol<{ modelos: Array<Record<string, unknown>> }>(idGerente,
      'SELECT public.hu012_modelos_admin() AS modelos');
    assert.deepEqual(estadosAdminInicial.rows[0].modelos.map(item => item.estmod).sort(), ['Borrador', 'Borrador', 'No publicado']);
    await assert.rejects(conRol(idGerente,
      `SELECT public.hu012_crear_modelo($1::bigint,'Publicado sin foto','Bajaj','Descripción','Características',NULL,ARRAY[]::text[],'Publicado')`,
      [1]), { code: 'PT422' });
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_cambiar_estado_modelo($1::bigint,$2)', [borrador.codmod, 'Publicado']), { code: 'PT422' });
    assert.equal((await db.query('SELECT estmod FROM modelo WHERE codmod=$1', [borrador.codmod])).rows[0].estmod, 'Borrador');

    const permisosRls = await db.query<{ rls: boolean; select_modelo: boolean; select_imagen: boolean; select_color: boolean; insert_imagen: boolean; update_imagen: boolean; delete_imagen: boolean }>(`
      SELECT c.relrowsecurity AS rls,
        has_table_privilege('authenticated','public.modelo','SELECT') AS select_modelo,
        has_table_privilege('authenticated','public.imagenmodelo','SELECT') AS select_imagen,
        has_table_privilege('authenticated','public.imagenmodelo','INSERT') AS insert_imagen,
        has_table_privilege('authenticated','public.imagenmodelo','UPDATE') AS update_imagen,
        has_table_privilege('authenticated','public.imagenmodelo','DELETE') AS delete_imagen,
        has_table_privilege('authenticated','public.colormodelo','SELECT') AS select_color
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='colormodelo'`);
    assert.deepEqual(permisosRls.rows, [{ rls: true, select_modelo: false, select_imagen: false,
      insert_imagen: false, update_imagen: false, delete_imagen: false, select_color: false }]);

    const imagenPrincipal = await conRol<{ imagen: Record<string, unknown> }>(idGerente,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3) AS imagen', [borrador.codmod, ' /images/modelos/1/principal.png ', 1]);
    const imagenSecundaria = await conRol<{ imagen: Record<string, unknown> }>(idAdministradora,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3) AS imagen', [borrador.codmod, 'https://imagenes.example.test/segunda.png', 2]);
    const imagenSinPrecio = await conRol<{ imagen: Record<string, unknown> }>(idAdministradora,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3) AS imagen', [sinPrecioNiColores.codmod, '/images/modelos/3/principal.png', 1]);
    assert.deepEqual(imagenPrincipal.rows[0].imagen, {
      codimo: '1', codmod: borrador.codmod, urlimo: '/images/modelos/1/principal.png', ordimo: 1, estimo: true
    });
    assert.deepEqual(imagenSecundaria.rows[0].imagen, {
      codimo: '2', codmod: borrador.codmod, urlimo: 'https://imagenes.example.test/segunda.png', ordimo: 2, estimo: true
    });
    assert.equal(imagenSinPrecio.rows[0].imagen.urlimo, '/images/modelos/3/principal.png');
    await conRol(idAdministradora, 'SELECT public.hu012_cambiar_estado_modelo($1,$2)', [sinPrecioNiColores.codmod, 'Publicado']);
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3)', [borrador.codmod, 'data:image/png;base64,AAAA', 3]), { code: 'PT400' });
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3)', [999, '/images/modelos/999/x.png', 1]), { code: 'PT404' });
    await assert.rejects(conRol(idVendedor,
      'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3)', [borrador.codmod, '/images/modelos/1/x.png', 3]), { code: '42501' });

    const imagenActualizada = await conRol<{ imagen: Record<string, unknown> }>(idGerente,
      'SELECT public.hu012_actualizar_imagen_modelo($1,$2,$3,$4) AS imagen',
      [borrador.codmod, imagenSecundaria.rows[0].imagen.codimo, '/images/modelos/1/secundaria.png', 3]);
    assert.equal(imagenActualizada.rows[0].imagen.urlimo, '/images/modelos/1/secundaria.png');
    assert.equal(imagenActualizada.rows[0].imagen.ordimo, 3);
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_actualizar_imagen_modelo($1,$2,$3,$4)',
      [sinPrecioNiColores.codmod, imagenPrincipal.rows[0].imagen.codimo, '/images/modelos/1/incorrecta.png', 1]), { code: 'PT404' });
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_cambiar_estado_imagen_modelo($1,$2,$3)',
      [borrador.codmod, imagenPrincipal.rows[0].imagen.codimo, null]), { code: 'PT400' });

    await db.exec(`INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (${borrador.codmod},1,'Verde',1);
      INSERT INTO unidad(codcom,codmod,nummotuni,chauni,coluni) VALUES (1,${borrador.codmod},'motor-hu012','chasis-hu012','Verde');`);
    const actualizados = await conRol<{ data: Record<string, unknown> }>(idGerente,
      `SELECT public.hu012_actualizar_modelo($1,$2::jsonb) AS data`,
      [borrador.codmod, JSON.stringify({ premod: 14500, colores: ['Negro', ' Blanco ', 'negro'] })]);
    assert.equal(Number(actualizados.rows[0].data.premod), 14500);
    assert.deepEqual(actualizados.rows[0].data.colores, ['Blanco', 'Negro']);
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_actualizar_modelo($1::bigint,$2::jsonb)',
      [borrador.codmod, JSON.stringify({ nommod: 'Edición debe revertirse', colores: [''] })]), { code: 'PT400' });
    assert.equal((await db.query('SELECT nommod FROM modelo WHERE codmod=$1', [borrador.codmod])).rows[0].nommod, 'Torito 1');
    const coloresHistoricos = await db.query<{ nomcmo: string; estcmo: boolean }>(
      'SELECT nomcmo,estcmo FROM colormodelo WHERE codmod=$1 ORDER BY nomcmo', [borrador.codmod]);
    assert.deepEqual(coloresHistoricos.rows, [
      { nomcmo: 'Azul Marino', estcmo: false }, { nomcmo: 'Blanco', estcmo: true },
      { nomcmo: 'Negro', estcmo: true }, { nomcmo: 'Rojo', estcmo: false }
    ]);
    assert.equal((await db.query<{ coluni: string }>('SELECT coluni FROM unidad WHERE nummotuni=$1', ['motor-hu012'])).rows[0].coluni, 'Verde');
    await assert.rejects(db.query('INSERT INTO colormodelo(codmod,nomcmo) VALUES ($1,$2)', [borrador.codmod, '  negro  ']), { code: '23505' });
    await assert.rejects(db.query('UPDATE modelo SET premod=-1 WHERE codmod=$1', [borrador.codmod]), { code: '23514' });

    await assert.rejects(conRol(idVendedor,
      'SELECT public.hu012_modelos_admin()'), { code: '42501' });
    for (const sql of ['SELECT * FROM public.modelo', 'SELECT * FROM public.imagenmodelo', 'SELECT * FROM public.colormodelo']) {
      await db.exec('SET ROLE authenticated');
      try { await assert.rejects(db.query(sql), { code: '42501' }); }
      finally { await db.exec('RESET ROLE'); }
    }

    await conRol(idGerente, 'SELECT public.hu012_cambiar_estado_modelo($1,$2)', [borrador.codmod, 'Publicado']);
    await conRol(idAdministradora, 'SELECT public.hu012_cambiar_estado_imagen_modelo($1,$2,$3)',
      [borrador.codmod, imagenPrincipal.rows[0].imagen.codimo, false]);
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_cambiar_estado_imagen_modelo($1,$2,$3)',
      [borrador.codmod, imagenActualizada.rows[0].imagen.codimo, false]), { code: 'PT422' });
    const listaAdmin = await conRol<{ modelos: Array<Record<string, unknown>> }>(idAdministradora,
      'SELECT public.hu012_modelos_admin() AS modelos');
    assert.equal(listaAdmin.rows[0].modelos.length, 3);
    assert.deepEqual(listaAdmin.rows[0].modelos.map(item => item.estmod).sort(), ['No publicado', 'Publicado', 'Publicado']);
    const modeloAdmin = listaAdmin.rows[0].modelos.find(item => item.codmod === borrador.codmod);
    assert.deepEqual(modeloAdmin.imagenes.map((item: Record<string, unknown>) => item.estimo).sort(), [false, true]);
    assert.ok(modeloAdmin.imagenes.every((item: Record<string, unknown>) => typeof item.codimo === 'string'));

    await db.exec('SET ROLE anon');
    try {
      const catalogo = await db.query<Record<string, unknown>>('SELECT * FROM public.hu012_modelos_publicados()');
      assert.deepEqual(catalogo.rows.map(item => item.codmod), [borrador.codmod, sinPrecioNiColores.codmod]);
      const publicadoConColores = catalogo.rows.find(item => item.codmod === borrador.codmod);
      assert.equal(Number(publicadoConColores?.premod), 14500);
      assert.deepEqual(publicadoConColores?.colores, ['Blanco', 'Negro']);
      const sinDatosOpcionales = catalogo.rows.find(item => item.codmod === sinPrecioNiColores.codmod);
      assert.equal(sinDatosOpcionales?.premod, null);
      assert.deepEqual(sinDatosOpcionales?.colores, []);
      const ficha = await db.query<{ ficha: Record<string, unknown> | null }>(
        'SELECT public.hu009_modelo_publicado_por_id($1) AS ficha', [sinPrecioNiColores.codmod]);
      assert.equal(ficha.rows[0].ficha?.premod, null);
      assert.deepEqual(ficha.rows[0].ficha?.colores, []);
      const fichaNoPublicada = await db.query<{ ficha: Record<string, unknown> | null }>(
        'SELECT public.hu009_modelo_publicado_por_id($1) AS ficha', [noPublicado.codmod]);
      assert.equal(fichaNoPublicada.rows[0].ficha, null);
      await assert.rejects(db.query('SELECT public.hu012_modelos_admin()'), { code: '42501' });
    } finally { await db.exec('RESET ROLE'); }

    await conRol(idGerente, 'SELECT public.hu012_agregar_imagen_modelo($1,$2,$3)',
      [noPublicado.codmod, '/images/modelos/2/principal.png', 1]);
    await conRol(idAdministradora, 'SELECT public.hu012_cambiar_estado_modelo($1,$2)', [noPublicado.codmod, 'Publicado']);
    const publicados = await db.query<Record<string, unknown>>('SELECT * FROM public.hu012_modelos_publicados()');
    assert.deepEqual(publicados.rows.map(item => item.codmod), [borrador.codmod, noPublicado.codmod, sinPrecioNiColores.codmod]);
    assert.deepEqual(publicados.rows.find(item => item.codmod === noPublicado.codmod)?.colores, []);

    await db.exec(`INSERT INTO modelo(codtmo,nommod,marmod,desmod,carmod,estmod)
      VALUES (1,'Publicado inconsistente','Bajaj','Datos requeridos','Datos requeridos','Publicado');`);
    const inconsistente = (await db.query<{ codmod: string }>("SELECT codmod::text FROM modelo WHERE nommod='Publicado inconsistente'")).rows[0].codmod;
    const catalogoSinInconsistente = await db.query<Record<string, unknown>>('SELECT * FROM public.hu012_modelos_publicados()');
    assert.equal(catalogoSinInconsistente.rows.some(item => item.codmod === inconsistente), false);
    const fichaInconsistente = await db.query<{ ficha: Record<string, unknown> | null }>(
      'SELECT public.hu009_modelo_publicado_por_id($1) AS ficha', [inconsistente]);
    assert.equal(fichaInconsistente.rows[0].ficha, null);

    await db.exec(`INSERT INTO modelo(codtmo,nommod,marmod,desmod,carmod,estmod)
      VALUES (1,'Ficha incompleta','Bajaj','','Datos requeridos','Borrador');
      INSERT INTO imagenmodelo(codmod,urlimo,ordimo,estimo)
      SELECT codmod,'/images/modelos/incompleto.png',1,true FROM modelo WHERE nommod='Ficha incompleta';`);
    const incompleto = (await db.query<{ codmod: string }>("SELECT codmod::text FROM modelo WHERE nommod='Ficha incompleta'")).rows[0].codmod;
    await assert.rejects(conRol(idGerente,
      'SELECT public.hu012_cambiar_estado_modelo($1::bigint,$2)', [incompleto, 'Publicado']), { code: 'PT422' });
    assert.equal((await db.query('SELECT estmod FROM modelo WHERE codmod=$1', [incompleto])).rows[0].estmod, 'Borrador');

    const grants = await db.query<{ catalogoAnon: boolean; fichaAnon: boolean; adminAuth: boolean; adminAnon: boolean; imagenAuth: boolean; imagenAnon: boolean; updateAuth: boolean; updateAnon: boolean; estadoAuth: boolean; estadoAnon: boolean }>(`
      SELECT has_function_privilege('anon','public.hu012_modelos_publicados()','EXECUTE') AS "catalogoAnon",
        has_function_privilege('anon','public.hu009_modelo_publicado_por_id(bigint)','EXECUTE') AS "fichaAnon",
        has_function_privilege('authenticated','public.hu012_modelos_admin()','EXECUTE') AS "adminAuth",
        has_function_privilege('anon','public.hu012_modelos_admin()','EXECUTE') AS "adminAnon",
        has_function_privilege('authenticated','public.hu012_agregar_imagen_modelo(bigint,text,integer)','EXECUTE') AS "imagenAuth",
        has_function_privilege('anon','public.hu012_agregar_imagen_modelo(bigint,text,integer)','EXECUTE') AS "imagenAnon",
        has_function_privilege('authenticated','public.hu012_actualizar_imagen_modelo(bigint,bigint,text,integer)','EXECUTE') AS "updateAuth",
        has_function_privilege('anon','public.hu012_actualizar_imagen_modelo(bigint,bigint,text,integer)','EXECUTE') AS "updateAnon",
        has_function_privilege('authenticated','public.hu012_cambiar_estado_imagen_modelo(bigint,bigint,boolean)','EXECUTE') AS "estadoAuth",
        has_function_privilege('anon','public.hu012_cambiar_estado_imagen_modelo(bigint,bigint,boolean)','EXECUTE') AS "estadoAnon"`);
    assert.deepEqual(grants.rows, [{ catalogoAnon: true, fichaAnon: true, adminAuth: true, adminAnon: false,
      imagenAuth: true, imagenAnon: false, updateAuth: true, updateAnon: false, estadoAuth: true, estadoAnon: false }]);
  } finally { await db.close(); }
});
