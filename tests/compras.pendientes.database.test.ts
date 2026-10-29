import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

interface ErrorSQL { code: string; message?: string }
interface CompraPendiente {
  codcom: string;
  origen: 'Automatico' | 'Manual' | 'No determinado';
  cantidad_comprada: number;
  cantidad_identificada: number;
  cantidad_pendiente_identificacion: number;
  estadoIdentificacion: string;
  bloqueadaPorDiscrepancia: boolean;
  estadoRecepcion: string;
  recepcion: {
    enCrossland: number;
    enTransito: number;
    recibidasEnEpsa: number;
    sinUbicacion: number;
    movimientoPendiente: number;
    otraUbicacion: number;
  };
  documentos: Array<{
    coddoc: string;
    numeroDocumento: string | null;
    tipoVinculo: 'Automatico' | 'Conciliado';
    estadoDocumento: string;
    codigoIncidencia: string | null;
    motivoIncidencia: string | null;
    advertencias: string[];
  }>;
  situaciones: string[];
}
interface ResultadoConsulta {
  compras: CompraPendiente[];
  documentos_sin_compra: Array<{ coddoc: string; numero: string; motivo: string; codigoIncidencia: string }>;
  conteo: Record<string, number>;
  total: number;
  limite: number;
  offset: number;
}

const leer = (path: string) => readFileSync(path, 'utf8');
const base = leer('tests/fixtures/esquema-base.sql');
const hu026 = leer('supabase/migrations/202610030001_hu026_ubicaciones.sql');
const hu034 = leer('supabase/migrations/202610040001_hu034_compra_pendiente.sql');
const hu007 = leer('supabase/migrations/202610070001_hu007_permisos_rol.sql');
const hu002 = leer('supabase/migrations/202610060001_hu002_identificacion_unidades.sql');
const hu003 = leer('supabase/migrations/202610190001_hu003_movimientos_ubicacion.sql');
const hu030Modelo = leer('supabase/migrations/202610240001_hu030_modelo_documental.sql');
const hu030Ajustes = leer('supabase/migrations/202610240002_hu030_ajustes_modelo_documental.sql');
const migracion = leer('supabase/migrations/202610280002_hu023_consulta_compras_pendientes.sql');

test('HU-023 PostgreSQL: consulta consolidada, recepción, documentos y autorización', async t => {
  const db = new PGlite();
  let usuarioActivo = 1;
  const UUIDS = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003'
  ];
  const login = async (usuario = usuarioActivo) => {
    usuarioActivo = usuario;
    await db.exec(`RESET ROLE; SET ROLE authenticated;
      SELECT set_config('request.jwt.claim.sub','${UUIDS[usuario - 1]}',false)`);
  };
  const administrativo = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.exec('RESET ROLE');
    try { return await fn(); } finally { await login(usuarioActivo); }
  };
  const consulta = async (origen: string | null = null, limite = 200, offset = 0) => (
    await db.query<{ r: ResultadoConsulta }>(
      'SELECT public.hu023_consultar_compras_pendientes($1,$2,$3) AS r', [origen, limite, offset]
    )
  ).rows[0]!.r;
  const crearCompra = async (cantidad: number, manual = true, color = 'Azul') => administrativo(async () => (
    await db.query<{ codcom: string }>(
      `INSERT INTO public.compra(codmod,codusu,colcom,cancom,estcom,idempotencia)
       VALUES ($1,1,$2,$3,'Pendiente de factura',$4) RETURNING codcom::text`,
      [modelId, color, cantidad, manual ? randomUUID() : null]
    )
  ).rows[0]!.codcom);
  const crearFactura = async (codcom: string, cantidad: number, numero = `F-${codcom}`) => administrativo(async () => {
    await db.query(
      `INSERT INTO public.factura_compra(codcom,emisor,numero,fecha_emision,cantidad_motos,codusu)
       VALUES ($1,'Proveedor sintético',$2,'2026-10-28',$3,1)`, [codcom, numero, cantidad]
    );
  });
  const crearUnidad = async (codcom: string, etiqueta: string, codubi: string | null) => administrativo(async () => {
    await db.query(
      `INSERT INTO public.unidad(codcom,codmod,codubi,nummotuni,chauni,coluni)
       SELECT c.codcom,$2,$3,$4,$5,c.colcom FROM public.compra c WHERE c.codcom=$1`,
      [codcom, modelId, codubi, `M-${etiqueta}`, `C-${etiqueta}`]
    );
  });
  const crearDocumento = async (
    estado: string,
    options: { codcom?: string; tipoVinculo?: 'Automatico' | 'Conciliado'; codigo?: string; motivo?: string } = {}
  ) => administrativo(async () => {
    const iddoc = `HU023-QA-${randomUUID()}`;
    const inserted = await db.query<{ coddoc: string }>(
      `INSERT INTO public.documentocompra(iddoc,estdoc,coderrdoc,motdoc,advertencias)
       VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING coddoc::text`,
      [iddoc, estado, options.codigo ?? null, options.motivo ?? null, JSON.stringify(['ADVERTENCIA_QA', 'correo-real@privado.test'])]
    );
    const coddoc = inserted.rows[0]!.coddoc;
    if (options.codcom) {
      await db.query(
        `INSERT INTO public.documentocompracompra(coddoc,codcom,tipvinculo,codusucon)
         VALUES ($1,$2,$3,1)`, [coddoc, options.codcom, options.tipoVinculo ?? 'Conciliado']
      );
    }
    return coddoc;
  });
  const unidadesYRecepcion = async (codcom: string) => (await consulta()).compras.find(c => c.codcom === codcom)!;
  let modelId = '';
  let crosslandId = '';
  let sedeActivaId = '';
  let compraManualSinFactura = '';
  let compraManualParcial = '';
  let compraAutomatica = '';
  let compraConIncidencia = '';
  let conteoComprasAntesDocumentoHuerfano = 0;
  let documentoSinCompra = '';

  try {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
        SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA public,auth TO anon,authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
    await db.exec(base);
    await db.exec(hu026);
    await db.exec(hu034);
    await db.exec(hu007);
    await db.exec(hu002);
    await db.exec(hu003);
    await db.exec(`INSERT INTO auth.users(id) VALUES ('${UUIDS[0]}'),('${UUIDS[1]}'),('${UUIDS[2]}');
      INSERT INTO public.rol(nomrol) VALUES ('Gerente'),('Administradora'),('Vendedor');
      INSERT INTO public.usuario(uuidusu,codrol,nomusu,apepatusu,corusu)
        SELECT id,row_number() OVER (ORDER BY id),'QA','HU023',id::text||'@qa.invalid' FROM auth.users;
      INSERT INTO public.tipomotocar(nomtmo) VALUES ('QA');
      INSERT INTO public.modelo(codtmo,nommod,marmod,desmod,carmod,estmod)
        VALUES (1,'Torito 250 4V GLP','Bajaj','Modelo sintético','Ficha sintética','Publicado');`);
    await db.exec(hu030Modelo);
    await db.exec(hu030Ajustes);
    await db.exec(migracion);
    await db.exec(migracion);

    modelId = (await db.query<{ codmod: string }>(`SELECT codmod::text FROM public.modelo WHERE nommod='Torito 250 4V GLP'`)).rows[0]!.codmod;
    crosslandId = (await db.query<{ codubi: string }>(
      `SELECT codubi::text FROM public.ubicacionclave WHERE claubi='ALMACEN_CROSLAND_ANCON' AND estucl`
    )).rows[0]!.codubi;
    sedeActivaId = (await db.query<{ codubi: string }>(
      `SELECT codubi::text FROM public.ubicacion WHERE nomubi='Ventanilla'`
    )).rows[0]!.codubi;
    await db.exec(`INSERT INTO public.sede(codubi,estsed) VALUES (${sedeActivaId},true);`);

    compraManualSinFactura = await crearCompra(5, true, 'Rojo');
    compraManualParcial = await crearCompra(5, true, 'Verde');
    await crearFactura(compraManualParcial, 5);
    await crearUnidad(compraManualParcial, 'PARCIAL-1', null);
    await crearUnidad(compraManualParcial, 'PARCIAL-2', null);
    const documentoCantidadNoUnidades = await crearDocumento('Importado', { codcom: compraManualParcial, tipoVinculo: 'Conciliado' });
    await administrativo(async () => {
      await db.query(
        `INSERT INTO public.lineadocumentocompra(coddoc,numlinea,canlin,claext,estlin)
         VALUES ($1,'1',5,'Vehiculo','Procesada')`, [documentoCantidadNoUnidades]
      );
    });

    compraAutomatica = await crearCompra(2, false, 'Azul');
    await crearFactura(compraAutomatica, 2, `AUTO-${compraAutomatica}`);
    await crearUnidad(compraAutomatica, 'AUTO-1', crosslandId);
    await crearUnidad(compraAutomatica, 'AUTO-2', crosslandId);
    await crearDocumento('Importado', { codcom: compraAutomatica, tipoVinculo: 'Automatico' });

    compraConIncidencia = await crearCompra(1, true, 'Negro');
    await crearFactura(compraConIncidencia, 1);
    await crearUnidad(compraConIncidencia, 'INCIDENCIA-1', crosslandId);
    const documentoIncidente = await crearDocumento('Pendiente de revision', {
      codcom: compraConIncidencia,
      tipoVinculo: 'Conciliado',
      codigo: 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO',
      motivo: 'dato sensible debe permanecer oculto correo privado@ejemplo.test'
    });
    await administrativo(async () => {
      await db.query(
        `INSERT INTO public.lineadocumentocompra(coddoc,numlinea,claext,estlin,motlin)
         VALUES ($1,'1','Desconocido','Revision','CODIGO_SIN_EQUIVALENCIA')`, [documentoIncidente]
      );
      await db.query(
        `INSERT INTO public.movimientoubicacion(coduni,codubiori,codubides,codusu,estmub)
         SELECT u.coduni,$2,$3,1,'En transito' FROM public.unidad u
         WHERE u.codcom=$1 AND u.nummotuni='M-INCIDENCIA-1'`, [compraConIncidencia, crosslandId, sedeActivaId]
      );
    });

    const compraRecibida = await crearCompra(2, true, 'Amarillo');
    await crearFactura(compraRecibida, 2);
    await crearUnidad(compraRecibida, 'RECIBIDA', sedeActivaId);
    await crearUnidad(compraRecibida, 'RECIBIDA-PENDIENTE', crosslandId);
    const compraSinUbicacion = await crearCompra(1, true, 'Blanco');
    await crearFactura(compraSinUbicacion, 1);
    await crearUnidad(compraSinUbicacion, 'SIN-UBICACION', null);

    conteoComprasAntesDocumentoHuerfano = await administrativo(async () =>
      (await db.query<{ n: number }>('SELECT count(*)::integer AS n FROM public.compra')).rows[0]!.n
    );
    documentoSinCompra = await crearDocumento('Error', {
      codigo: 'ERROR_TECNICO_IMPORTACION',
      motivo: 'contenido potencialmente sensible no se devuelve'
    });
    await login(1);

    await t.test('compra manual 5/0 usa cancom y conserva el origen de HU-034', async () => {
      const r = (await consulta('Manual')).compras.find(c => c.codcom === compraManualSinFactura)!;
      assert.equal(r.origen, 'Manual');
      assert.equal(r.cantidad_comprada, 5);
      assert.equal(r.cantidad_identificada, 0);
      assert.equal(r.cantidad_pendiente_identificacion, 5);
      assert.equal(r.estadoIdentificacion, 'Pendiente de factura');
      assert.ok(r.situaciones.includes('Pendiente de factura'));
    });

    await t.test('compra manual 5/2 no cuenta líneas/documentos como unidades', async () => {
      const r = (await consulta('Manual')).compras.find(c => c.codcom === compraManualParcial)!;
      assert.equal(r.cantidad_comprada, 5);
      assert.equal(r.cantidad_identificada, 2);
      assert.equal(r.cantidad_pendiente_identificacion, 3);
      assert.equal(r.documentos.length, 1);
      assert.equal(r.estadoIdentificacion, 'Pendiente de identificación');
    });

    await t.test('compra automática HU-030 se reconoce por vínculo y sus unidades están en Crosland', async () => {
      const r = (await consulta('Automatico')).compras.find(c => c.codcom === compraAutomatica)!;
      assert.equal(r.origen, 'Automatico');
      assert.equal(r.recepcion.enCrossland, 2);
      assert.equal(r.recepcion.recibidasEnEpsa, 0);
      assert.equal(r.documentos[0]!.tipoVinculo, 'Automatico');
    });

    await t.test('movimiento En transito prevalece sobre codubi Crossland', async () => {
      const r = (await consulta()).compras.find(c => c.codcom === compraConIncidencia)!;
      assert.equal(r.recepcion.enTransito, 1);
      assert.equal(r.recepcion.enCrossland, 0);
      assert.equal(r.recepcion.recibidasEnEpsa, 0);
      assert.equal(r.estadoRecepcion, 'En tránsito');
    });

    await t.test('una ubicación asociada a una sede activa cuenta como recibida en EPSA', async () => {
      const r = await unidadesYRecepcion(compraRecibida);
      assert.equal(r.recepcion.recibidasEnEpsa, 1);
      assert.equal(r.recepcion.enCrossland, 1);
      assert.equal(r.estadoRecepcion, 'Recepción mixta');
    });

    await t.test('unidad con codubi NULL queda sin ubicación confirmada', async () => {
      const r = await unidadesYRecepcion(compraSinUbicacion);
      assert.equal(r.recepcion.sinUbicacion, 1);
      assert.equal(r.recepcion.recibidasEnEpsa, 0);
    });

    await t.test('documento en revisión se proyecta como incidencia y no altera cantidades', async () => {
      const r = (await consulta()).compras.find(c => c.codcom === compraConIncidencia)!;
      assert.equal(r.cantidad_identificada, 1);
      assert.equal(r.cantidad_pendiente_identificacion, 0);
      assert.ok(r.situaciones.includes('Incidencia documental'));
      assert.equal(r.documentos[0]!.estadoDocumento, 'Pendiente de revision');
      assert.equal(r.documentos[0]!.codigoIncidencia, 'DOCUMENTO_MISMA_IDENTIDAD_CONTENIDO_DISTINTO');
      assert.deepEqual(r.documentos[0]!.advertencias, ['ADVERTENCIA_QA']);
      assert.ok(!JSON.stringify(r.documentos).includes('privado@ejemplo.test'));
    });

    await t.test('documento con error y sin vínculo queda separado y no crea compra', async () => {
      const r = await consulta();
      assert.ok(r.documentos_sin_compra.some(d => d.coddoc === documentoSinCompra));
      const nCompras = await administrativo(async () =>
        (await db.query<{ n: number }>('SELECT count(*)::integer AS n FROM public.compra')).rows[0]!.n
      );
      assert.equal(nCompras, conteoComprasAntesDocumentoHuerfano);
      assert.equal(r.documentos_sin_compra.find(d => d.coddoc === documentoSinCompra)!.motivo,
        'La importación del documento falló y requiere revisión.');
      assert.ok(!JSON.stringify(r.documentos_sin_compra).includes('contenido potencialmente sensible'));
    });

    await t.test('Gerente y Administradora pueden consultar; Vendedor recibe 42501', async () => {
      await consulta();
      await login(2);
      await consulta();
      await login(3);
      await assert.rejects(consulta(), (error: unknown) => (error as ErrorSQL).code === '42501');
      await db.exec('RESET ROLE');
    });

    await t.test('página sin coincidencias devuelve colecciones vacías y contrato estable', async () => {
      await login(1);
      const r = await consulta('No determinado');
      assert.deepEqual(r.compras, []);
      assert.equal(r.total, 0);
      assert.ok(Array.isArray(r.documentos_sin_compra));
      assert.deepEqual(Object.keys(r.conteo).sort(), [
        'Incidencia documental', 'Pendiente de factura', 'Pendiente de identificación', 'Pendiente de recepción'
      ].sort());
    });
  } finally {
    await db.close();
  }
});
