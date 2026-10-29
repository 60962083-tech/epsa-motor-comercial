import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';

import { importarFacturaXml, ErrorServicioImportacionFactura } from '../src/services/factura.importacion.service.js';
import type { ConfiguracionValidacionFactura } from '../src/types/factura.importacion.types.js';
import { VALIDACION_FACTURA_CROSLAND } from '../src/config/factura.importacion.config.js';

const fixture = readFileSync('tests/fixtures/factura-importacion/factura_valida.xml');
const config: ConfiguracionValidacionFactura = {
  ...VALIDACION_FACTURA_CROSLAND,
  rucEmisoresPermitidos: ['20123456789'],
  rucCompradorEsperado: '20987654321'
};

function supabaseMock(responses: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const db = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return responses.shift() ?? { data: null, error: new Error('unexpected rpc') };
    }
  } as unknown as SupabaseClient;
  return { db, calls };
}

test('servicio interno HU-030 obtiene equivalencias, clasifica, prepara checksum y propaga RPC', async () => {
  const result = {
    coddoc: '21', estadoDocumento: 'Importado', reintento: false, error: null,
    compras: [], unidades: [], lineasRevision: [],
    conteos: { lineas: 4, vehiculos: 2, importados: 2, revision: 0 }, advertencias: []
  };
  const { db, calls } = supabaseMock([
    { data: [
      { codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo', codmod: '42', activa: true },
      { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio', codmod: null, activa: true }
    ], error: null },
    { data: result, error: null }
  ]);

  assert.deepEqual(await importarFacturaXml(db, fixture, config), result);
  assert.deepEqual(calls.map(({ name }) => name), ['listar_equivalencias_importacion', 'importar_documento_compra']);
  assert.equal((calls[0]!.args as { p_ruc_emisor: string }).p_ruc_emisor, '20123456789');
  const payload = (calls[1]!.args as { p_payload: Record<string, any> }).p_payload;
  assert.match(payload.checksumXml, /^[a-f0-9]{64}$/);
  assert.equal(payload.lineas.filter((line: any) => line.estado === 'Candidato').length, 2);
  assert.equal(payload.lineas.filter((line: any) => line.clasificacion === 'Accesorio').length, 2);
  assert.equal(payload.gruposCalculados.length, 1);
  assert.equal(payload.gruposCalculados[0].cantidad, 2);
  assert.equal(payload.origen, 'XML_Interno');
  assert.ok(!JSON.stringify(payload).includes('20502913752'));
});

test('XML malformado y XML fiscalmente inválido no llaman RPC', async () => {
  const { db, calls } = supabaseMock([]);
  await assert.rejects(importarFacturaXml(db, Buffer.from('<Invoice>'), config), (error: unknown) =>
    error instanceof ErrorServicioImportacionFactura && error.codigo === 'XML_INVALIDO');
  const wrongRuc = readFileSync('tests/fixtures/factura-importacion/factura_ruc_comprador_incorrecto.xml');
  await assert.rejects(importarFacturaXml(db, wrongRuc, config), (error: unknown) =>
    error instanceof ErrorServicioImportacionFactura && error.codigo === 'VALIDACION_DOCUMENTAL_FALLIDA'
      && error.erroresValidacion.includes('RUC_COMPRADOR_NO_CORRESPONDE'));
  assert.equal(calls.length, 0);
});

test('fallos de Supabase se traducen a códigos controlados sin filtrar detalles', async () => {
  const equivalenceFailure = supabaseMock([{ data: null, error: { message: 'private details', details: 'secret' } }]);
  await assert.rejects(importarFacturaXml(equivalenceFailure.db, fixture, config), (error: unknown) =>
    error instanceof ErrorServicioImportacionFactura && error.codigo === 'ERROR_EQUIVALENCIAS'
      && !error.message.includes('private details'));

  const importFailure = supabaseMock([
    { data: [{ codigoExterno: 'SYNTH-MOTO', clasificacion: 'Vehiculo', codmod: '42', activa: true },
      { codigoExterno: 'SYNTH-ACC', clasificacion: 'Accesorio', codmod: null, activa: true }], error: null },
    { data: null, error: { message: 'private details', details: 'secret' } }
  ]);
  await assert.rejects(importarFacturaXml(importFailure.db, fixture, config), (error: unknown) =>
    error instanceof ErrorServicioImportacionFactura && error.codigo === 'ERROR_IMPORTACION_TRANSACCIONAL'
      && !error.message.includes('private details'));
});
