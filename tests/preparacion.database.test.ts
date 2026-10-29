import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

interface SqlResult<T> { r: T }
interface SqlError { code?: string }
interface Preparacion {
  coduni: string;
  armado: string;
  techo: {
    estado: string;
    codtte: string | null;
    configuracion: string | null;
    requiereInstalacion: boolean | null;
  };
  version: string;
  preparacionCompleta: boolean;
  condicionesFaltantes: string[];
  ultimaActualizacion: string;
  actualizadoPor: { codusu: string; nombre: string } | null;
}
interface EventoPreparacion {
  codhprep: string;
  etapa: string;
  estadoAnterior: string;
  estadoNuevo: string;
  fecha: string;
  observacion: string | null;
  fuente: string;
  proveedor: { codpro: string; nombre: string } | null;
  autor: { codusu: string; nombre: string };
}
interface ConsultaPreparacion { actual: Preparacion; historial: EventoPreparacion[] }

const ADMIN_UUID = '00000000-0000-0000-0000-000000000001';
const ADMINISTRADORA_UUID = '00000000-0000-0000-0000-000000000002';
const VENDEDOR_UUID = '00000000-0000-0000-0000-000000000003';
const MIGRACION = 'supabase/migrations/202610280003_hu033_preparacion_unidad.sql';
const migracionHu033 = readFileSync(MIGRACION, 'utf8');

test('HU-033 PostgreSQL: inicialización, preparación derivada, permisos, auditoría e idempotencia', async t => {
  const db = new PGlite();
  let usuario = 1;
  const login = async (n = usuario) => {
    usuario = n;
    const uuid = [ADMIN_UUID, ADMINISTRADORA_UUID, VENDEDOR_UUID][n - 1]!;
    await db.exec(`RESET ROLE; SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub','${uuid}',false)`);
  };
  const propietario = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.exec('RESET ROLE');
    try { return await fn(); } finally { await login(usuario); }
  };
  const escalar = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
    (await db.query<SqlResult<T>>(sql, params)).rows[0]!.r;
  const error = (codigo: string) => (e: unknown) => (e as SqlError).code === codigo;
  const consultar = (coduni: string) => escalar<ConsultaPreparacion>(
    'SELECT public.hu033_consultar_preparacion_unidad($1) r', [coduni]);
  const actualizar = (
    coduni: string,
    etapa: 'Armado' | 'Techo',
    estado: string,
    version: number,
    observacion: string | null = null,
    fuente: 'Interno' | 'Aviso proveedor' = 'Interno',
    idempotencia = randomUUID()
  ) => escalar<Preparacion>(
    'SELECT public.hu033_actualizar_preparacion_unidad($1,$2,$3,$4,$5,$6,$7) r',
    [coduni, etapa, estado, version, observacion, fuente, idempotencia]
  );

  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(readFileSync('tests/fixtures/esquema-base.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610030001_hu026_ubicaciones.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610040001_hu034_compra_pendiente.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610060001_hu002_identificacion_unidades.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610070001_hu007_permisos_rol.sql', 'utf8'));
    await db.exec(readFileSync('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql', 'utf8'));
    await db.exec(`INSERT INTO auth.users VALUES ('${ADMIN_UUID}'),('${ADMINISTRADORA_UUID}'),('${VENDEDOR_UUID}');
      INSERT INTO rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        VALUES ('${ADMIN_UUID}',1,'Gerente','QA','gerente-hu033@test.local'),
               ('${ADMINISTRADORA_UUID}',2,'Administradora','QA','admin-hu033@test.local'),
               ('${VENDEDOR_UUID}',3,'Vendedor','QA','vendedor-hu033@test.local');
      INSERT INTO tipomotocar(nomtmo) VALUES ('QA HU-033');
      INSERT INTO modelo(codtmo,nommod,desmod,carmod) VALUES (1,'Modelo QA HU-033','Descripción','Características');`);
    await db.exec(readFileSync('supabase/migrations/202610080001_hu004_configuracion_techo.sql', 'utf8'));

    const compra = (await db.query<{ codcom: string }>(
      `INSERT INTO compra(codmod,codusu,colcom,cancom) VALUES (1,1,'Azul',6) RETURNING codcom::text codcom`
    )).rows[0]!;
    await login(1);
    await escalar('SELECT public.hu002_registrar_factura($1,$2,$3,$4,$5) r',
      [compra.codcom, 'Proveedor QA HU-033', 'FACT-HU033-01', '2026-10-28', 6]);
    const loteInicial = Array.from({ length: 5 }, (_, index) => ({
      nummotuni: `HU033-MOTOR-${index + 1}`,
      chauni: `HU033-CHASIS-${index + 1}`,
      codmod: '1',
      coluni: 'Azul'
    }));
    await escalar('SELECT public.hu002_identificar_unidades($1,$2::jsonb) r',
      [compra.codcom, JSON.stringify(loteInicial)]);
    const ids = await propietario(async () => (await db.query<{ coduni: string; nummotuni: string }>(
      'SELECT coduni::text coduni,nummotuni FROM public.unidad ORDER BY coduni'
    )).rows);
    const unidadSinTecho = ids[0]!.coduni;
    const unidadSinConfiguracion = ids[1]!.coduni;
    const unidadTechoRequerido = ids[2]!.coduni;
    const unidadIdempotencia = ids[3]!.coduni;
    const unidadConcurrente = ids[4]!.coduni;

    const tipos = await propietario(async () => (await db.query<{ codtte: string; nomtte: string }>(
      `SELECT codtte::text codtte,nomtte FROM public.tipotecho
       WHERE nomtte IN ('Sin techo','Lona','Techo clásico de fibra','Techo de fibra deportiva')`
    )).rows);
    const tipo = Object.fromEntries(tipos.map(row => [row.nomtte, row.codtte]));
    const ubicacion = await propietario(async () => (await db.query<{ codubi: string }>(
      `SELECT codubi::text codubi FROM public.ubicacion WHERE nomubi='Ventanilla'`
    )).rows[0]!.codubi);
    await propietario(async () => {
      await db.query('UPDATE public.unidad SET codtte=$1 WHERE coduni=$2', [tipo['Sin techo'], unidadSinTecho]);
      await db.query('UPDATE public.unidad SET codtte=$1,codubi=$2 WHERE coduni=$3',
        [tipo['Techo clásico de fibra'], ubicacion, unidadTechoRequerido]);
      return undefined;
    });

    // Existing units are backfilled, while the sixth unit is created after the
    // migration through the actual HU-002 RPC to exercise the central trigger.
    await propietario(async () => { await db.exec(migracionHu033); return undefined; });
    const nuevaHu002 = {
      nummotuni: 'HU033-MOTOR-6', chauni: 'HU033-CHASIS-6', codmod: '1', coluni: 'Azul'
    };
    await escalar('SELECT public.hu002_identificar_unidades($1,$2::jsonb) r',
      [compra.codcom, JSON.stringify([nuevaHu002])]);
    const unidadNuevaHu002 = await propietario(async () =>
      (await db.query<{ coduni: string }>("SELECT coduni::text coduni FROM public.unidad WHERE nummotuni='HU033-MOTOR-6'")).rows[0]!.coduni
    );

    await t.test('backfill conservador: unidades existentes quedan pendientes y Sin techo queda No requiere', async () => {
      const sinTecho = (await consultar(unidadSinTecho)).actual;
      const sinConfig = (await consultar(unidadSinConfiguracion)).actual;
      const conTecho = (await consultar(unidadTechoRequerido)).actual;
      assert.equal(sinTecho.armado, 'Pendiente');
      assert.equal(sinTecho.techo.estado, 'No requiere');
      assert.equal(sinConfig.armado, 'Pendiente');
      assert.equal(sinConfig.techo.estado, 'Pendiente');
      assert.equal(sinConfig.techo.configuracion, null);
      assert.equal(conTecho.techo.estado, 'Pendiente');
      assert.equal(conTecho.techo.requiereInstalacion, true);
      assert.equal((await consultar(unidadNuevaHu002)).actual.armado, 'Pendiente');
      assert.equal((await consultar(unidadNuevaHu002)).actual.techo.estado, 'Pendiente');
      const atributos = await propietario(async () => (await db.query<{ nomtte: string; reqinsttte: boolean }>(
        `SELECT nomtte,reqinsttte FROM public.tipotecho
         WHERE nomtte IN ('Sin techo','Lona','Techo clásico de fibra','Techo de fibra deportiva') ORDER BY nomtte`
      )).rows);
      assert.deepEqual(atributos, [
        { nomtte: 'Lona', reqinsttte: true },
        { nomtte: 'Sin techo', reqinsttte: false },
        { nomtte: 'Techo clásico de fibra', reqinsttte: true },
        { nomtte: 'Techo de fibra deportiva', reqinsttte: true }
      ]);
    });

    await t.test('solo Gerente y Administradora actualizan; Vendedor consulta y recibe 42501 al escribir', async () => {
      await login(1);
      const gerencia = await actualizar(unidadSinTecho, 'Armado', 'Terminado', 1);
      assert.equal(gerencia.armado, 'Terminado');
      await login(2);
      const administracion = await actualizar(unidadTechoRequerido, 'Techo', 'En proceso', 1);
      assert.equal(administracion.techo.estado, 'En proceso');
      await login(3);
      assert.equal((await consultar(unidadTechoRequerido)).actual.techo.estado, 'En proceso');
      await assert.rejects(actualizar(unidadTechoRequerido, 'Techo', 'Instalado', 2), error('42501'));
      await assert.rejects(db.query('SELECT * FROM public.preparacionunidad'), error('42501'));
    });

    await t.test('el armado queda auditado con estado anterior/nuevo, autor y fecha asignados por PostgreSQL', async () => {
      const lectura = await consultar(unidadSinTecho);
      const evento = lectura.historial.at(-1)!;
      const usuario = await propietario(async () => (await db.query<{ codusu: string }>(
        "SELECT codusu::text codusu FROM public.usuario WHERE uuidusu=$1::uuid", [ADMIN_UUID]
      )).rows[0]!.codusu);
      assert.equal(evento.etapa, 'Armado');
      assert.equal(evento.estadoAnterior, 'Pendiente');
      assert.equal(evento.estadoNuevo, 'Terminado');
      assert.equal(evento.autor.codusu, usuario);
      assert.ok(Date.parse(evento.fecha) > 0);
      assert.ok(Date.parse(lectura.actual.ultimaActualizacion) > 0);
    });

    await t.test('techo avanza Pendiente → En proceso → Instalado y rechaza retroceso silencioso', async () => {
      await login(1);
      const enProceso = (await consultar(unidadTechoRequerido)).actual;
      assert.equal(enProceso.techo.estado, 'En proceso');
      const armado = await actualizar(unidadTechoRequerido, 'Armado', 'Terminado', Number(enProceso.version));
      assert.equal(armado.preparacionCompleta, false);
      assert.ok(armado.condicionesFaltantes.includes('Instalación de techo pendiente'));
      const instalado = await actualizar(unidadTechoRequerido, 'Techo', 'Instalado', Number(armado.version));
      assert.equal(instalado.techo.estado, 'Instalado');
      assert.equal(instalado.preparacionCompleta, true);
      await assert.rejects(
        actualizar(unidadTechoRequerido, 'Techo', 'En proceso', Number(instalado.version)),
        error('PT400')
      );
      const corregido = await actualizar(unidadTechoRequerido, 'Techo', 'En proceso', Number(instalado.version), 'Se detectó una instalación incompleta');
      assert.equal(corregido.techo.estado, 'En proceso');
      assert.equal((await consultar(unidadTechoRequerido)).historial.at(-1)?.observacion, 'Se detectó una instalación incompleta');
    });

    await t.test('falta de configuración impide completar; estado Sin techo permite completar al terminar armado', async () => {
      await login(1);
      const sinConfig = await actualizar(unidadSinConfiguracion, 'Armado', 'Terminado', 1);
      assert.equal(sinConfig.preparacionCompleta, false);
      assert.ok(sinConfig.condicionesFaltantes.includes('Configuración de techo pendiente'));
      assert.ok(!sinConfig.condicionesFaltantes.includes('Instalación de techo pendiente'));
      const terminada = (await consultar(unidadSinTecho)).actual;
      assert.equal(terminada.preparacionCompleta, true);
      assert.deepEqual(terminada.condicionesFaltantes, []);
      assert.equal(terminada.techo.estado, 'No requiere');
    });

    await t.test('idempotencia repite la respuesta sin duplicar evento/versión y rechaza reutilizar clave para otra operación', async () => {
      await login(1);
      const key = randomUUID();
      const primera = await actualizar(unidadIdempotencia, 'Armado', 'Terminado', 1, null, 'Interno', key);
      const historialInicial = (await consultar(unidadIdempotencia)).historial.length;
      const reintento = await actualizar(unidadIdempotencia, 'Armado', 'Terminado', 1, null, 'Interno', key);
      assert.equal(reintento.version, primera.version);
      assert.equal((await consultar(unidadIdempotencia)).historial.length, historialInicial);
      await assert.rejects(
        actualizar(unidadIdempotencia, 'Armado', 'Pendiente', 1, 'Corrección', 'Interno', key),
        error('PT409')
      );
      await assert.rejects(
        actualizar(unidadIdempotencia, 'Armado', 'Pendiente', 1, 'Corrección antigua'),
        error('PT409')
      );
    });

    await t.test('dos escrituras con la misma versión no sobrescriben el avance que confirma primero', async () => {
      await login(1);
      const actual = (await consultar(unidadConcurrente)).actual;
      const resultados = await Promise.allSettled([
        actualizar(unidadConcurrente, 'Armado', 'Terminado', Number(actual.version), null, 'Interno', randomUUID()),
        actualizar(unidadConcurrente, 'Armado', 'Terminado', Number(actual.version), null, 'Interno', randomUUID())
      ]);
      assert.equal(resultados.filter(resultado => resultado.status === 'fulfilled').length, 1);
      const rechazados = resultados.filter((resultado): resultado is PromiseRejectedResult => resultado.status === 'rejected');
      assert.equal(rechazados.length, 1);
      assert.equal((rechazados[0]!.reason as SqlError).code, 'PT409');
      const final = (await consultar(unidadConcurrente)).actual;
      assert.equal(final.armado, 'Terminado');
      assert.equal(final.version, '2');
      assert.equal((await consultar(unidadConcurrente)).historial.length, 1);
    });

    await t.test('HU-004 reinicia solo techo al cambiar configuración, conserva historial y registra fuente', async () => {
      await login(1);
      let antes = (await consultar(unidadTechoRequerido)).actual;
      if (antes.techo.estado !== 'Instalado') {
        await actualizar(unidadTechoRequerido, 'Techo', 'Instalado', Number(antes.version));
      }
      const completamenteInstalada = (await consultar(unidadTechoRequerido)).actual;
      const proveedor = await propietario(async () => (await db.query<{ codpro: string }>(
        "SELECT codpro::text codpro FROM public.proveedor WHERE nompro='FIVESA'"
      )).rows[0]!.codpro);
      const contarHistorial = async () => propietario(async () =>
        (await db.query<{ n: number }>('SELECT count(*)::int n FROM public.historialpreparacionunidad WHERE coduni=$1', [unidadTechoRequerido])).rows[0]!.n
      );
      const historialAntes = await contarHistorial();
      await escalar(
        'SELECT public.hu004_actualizar_configuracion_techo($1,$2,$3,$4) r',
        [unidadTechoRequerido, tipo['Techo de fibra deportiva'], proveedor, null]
      );
      let trasCambio = (await consultar(unidadTechoRequerido)).actual;
      assert.equal(trasCambio.armado, completamenteInstalada.armado);
      assert.equal(trasCambio.techo.estado, 'Pendiente');
      assert.equal(Number(trasCambio.version), Number(completamenteInstalada.version) + 1);
      const eventoConfig = (await consultar(unidadTechoRequerido)).historial.at(-1)!;
      assert.equal(eventoConfig.fuente, 'Configuración techo');
      assert.equal(eventoConfig.estadoAnterior, 'Instalado');
      assert.equal(eventoConfig.estadoNuevo, 'Pendiente');
      assert.equal(eventoConfig.proveedor?.codpro, proveedor);

      await login(2);
      trasCambio = await actualizar(unidadTechoRequerido, 'Techo', 'Instalado', Number(trasCambio.version), null, 'Aviso proveedor');
      assert.equal(trasCambio.techo.estado, 'Instalado');
      const eventoProveedor = (await consultar(unidadTechoRequerido)).historial.at(-1)!;
      assert.equal(eventoProveedor.fuente, 'Aviso proveedor');
      assert.equal(eventoProveedor.proveedor?.codpro, proveedor);
      assert.ok(eventoProveedor.autor.codusu);

      const countAntesSinCambio = await contarHistorial();
      const versionAntesSinCambio = trasCambio.version;
      await escalar('SELECT public.hu004_actualizar_configuracion_techo($1,$2,$3,$4) r',
        [unidadTechoRequerido, tipo['Techo de fibra deportiva'], proveedor, null]);
      assert.equal((await consultar(unidadTechoRequerido)).actual.version, versionAntesSinCambio);
      assert.equal(await contarHistorial(), countAntesSinCambio);

      await escalar('SELECT public.hu004_actualizar_configuracion_techo($1,$2,NULL,NULL) r',
        [unidadTechoRequerido, tipo.Lona]);
      assert.equal((await consultar(unidadTechoRequerido)).actual.techo.estado, 'Pendiente');
      await escalar('SELECT public.hu004_actualizar_configuracion_techo($1,$2,NULL,NULL) r',
        [unidadTechoRequerido, tipo['Sin techo']]);
      const final = (await consultar(unidadTechoRequerido)).actual;
      assert.equal(final.techo.estado, 'No requiere');
      assert.equal(final.techo.requiereInstalacion, false);
      assert.equal(final.armado, completamenteInstalada.armado);
      assert.ok((await contarHistorial()) > historialAntes);
    });

    await t.test('preparación y aviso de proveedor no alteran ubicación, situación comercial ni movimientos', async () => {
      await login(1);
      const proveedor = await propietario(async () => (await db.query<{ codpro: string }>(
        "SELECT codpro::text codpro FROM public.proveedor WHERE nompro='FIVESA'"
      )).rows[0]!.codpro);
      await escalar('SELECT public.hu004_actualizar_configuracion_techo($1,$2,$3,NULL) r',
        [unidadTechoRequerido, tipo['Techo de fibra deportiva'], proveedor]);
      const datosAntes = await propietario(async () => (await db.query<{
        codubi: string | null; estcomuni: string; movimientos: number; ventas: number; separaciones: number;
      }>(`SELECT u.codubi::text codubi,u.estcomuni,
        (SELECT count(*)::int FROM public.movimientoubicacion m WHERE m.coduni=u.coduni) movimientos,
        (SELECT count(*)::int FROM public.venta v WHERE v.coduni=u.coduni) ventas,
        (SELECT count(*)::int FROM public.separacion s WHERE s.coduni=u.coduni) separaciones
        FROM public.unidad u WHERE u.coduni=$1`, [unidadTechoRequerido])).rows[0]!);
      assert.ok(datosAntes.codubi);
      const estado = (await consultar(unidadTechoRequerido)).actual;
      await login(2);
      if (estado.techo.estado !== 'Instalado') {
        await actualizar(unidadTechoRequerido, 'Techo', 'Instalado', Number(estado.version), null, 'Aviso proveedor');
      }
      const datosDespues = await propietario(async () => (await db.query<{
        codubi: string | null; estcomuni: string; movimientos: number; ventas: number; separaciones: number;
      }>(`SELECT u.codubi::text codubi,u.estcomuni,
        (SELECT count(*)::int FROM public.movimientoubicacion m WHERE m.coduni=u.coduni) movimientos,
        (SELECT count(*)::int FROM public.venta v WHERE v.coduni=u.coduni) ventas,
        (SELECT count(*)::int FROM public.separacion s WHERE s.coduni=u.coduni) separaciones
        FROM public.unidad u WHERE u.coduni=$1`, [unidadTechoRequerido])).rows[0]!);
      assert.deepEqual(datosDespues, datosAntes);
    });

    await t.test('historial no admite actualización/eliminación y reejecutar migración conserva estado e historial', async () => {
      await login(1);
      const antes = await consultar(unidadTechoRequerido);
      const versionAntes = antes.actual.version;
      const eventosAntes = antes.historial.length;
      const eventId = antes.historial[0]!.codhprep;
      await assert.rejects(
        propietario(async () => db.query('UPDATE public.historialpreparacionunidad SET obspreparacion=NULL WHERE codhprep=$1', [eventId])),
        error('42501')
      );
      await assert.rejects(
        propietario(async () => db.query('DELETE FROM public.historialpreparacionunidad WHERE codhprep=$1', [eventId])),
        error('42501')
      );
      await propietario(async () => { await db.exec(migracionHu033); return undefined; });
      const despues = await consultar(unidadTechoRequerido);
      assert.equal(despues.actual.version, versionAntes);
      assert.equal(despues.historial.length, eventosAntes);
      assert.equal((await consultar(unidadSinTecho)).actual.techo.estado, 'No requiere');
    });
  } finally {
    await db.close();
  }
});
