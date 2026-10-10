import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';

const filas = [{
  codsed: '1', nomsed: 'Sede QA', dirsed: null, telsed: null, horsed: null,
  codubi: '17', tipubi: 'Almacen', estubi: false, estsed: false, dato_interno: 'privado'
}];

async function entorno(
  verificar: (base: string, llamadas: unknown[][]) => Promise<void>,
  resultado: { data: unknown; error: unknown } = { data: filas, error: null }
) {
  const llamadas: unknown[][] = [];
  const fabricaPublica = (...args: unknown[]) => {
    assert.deepEqual(args, []);
    return { rpc: async (...parametros: unknown[]) => {
      llamadas.push(parametros);
      return resultado;
    } } as unknown as SupabaseClient;
  };
  const server = crearApp(undefined, fabricaPublica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    await verificar(`http://127.0.0.1:${(server.address() as { port: number }).port}`, llamadas);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('HU-010: GET público funciona sin Bearer y devuelve solo la proyección pública', async () => entorno(async (base, llamadas) => {
  const respuesta = await fetch(`${base}/api/sedes`);
  assert.equal(respuesta.status, 200);
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await respuesta.json(), { ok: true, data: [{
    codsed: '1', nomsed: 'Sede QA', dirsed: null, telsed: null, horsed: null
  }] });
  assert.deepEqual(llamadas, [['hu010_sedes_publicas']]);
}));

test('HU-010: ignora credenciales y no admite filtros para ampliar datos públicos', async () => entorno(async (base, llamadas) => {
  for (const headers of [{ Authorization: 'Bearer token-no-valido' }, { Authorization: 'Bearer token', 'x-role': 'Gerente' }]) {
    const respuesta = await fetch(`${base}/api/sedes`, { headers });
    assert.equal(respuesta.status, 200);
  }
  const filtrada = await fetch(`${base}/api/sedes?estubi=false`);
  assert.equal(filtrada.status, 400);
  assert.deepEqual(llamadas, [['hu010_sedes_publicas'], ['hu010_sedes_publicas']]);
}));

test('HU-010: RPC vacía devuelve exactamente data []', async () => entorno(async (base, llamadas) => {
  const respuesta = await fetch(`${base}/api/sedes`);
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { ok: true, data: [] });
  assert.deepEqual(llamadas, [['hu010_sedes_publicas']]);
}, { data: [], error: null }));

test('HU-010: error de Supabase responde de forma genérica sin detalles internos', async () => entorno(async base => {
  const respuesta = await fetch(`${base}/api/sedes`);
  assert.equal(respuesta.status, 500);
  assert.deepEqual(await respuesta.json(), { ok: false, message: 'Error al consultar las sedes' });
}, { data: null, error: {
  message: 'mensaje SQL privado', details: 'detalle privado', hint: 'pista privada', stack: 'stack privado'
} }));

test('HU-010: modelos públicos siguen disponibles y ubicaciones continúa privada', async () => entorno(async (base, llamadas) => {
  const modelos = await fetch(`${base}/api/modelos`);
  assert.equal(modelos.status, 200);
  assert.deepEqual(await modelos.json(), { ok: true, data: [{ codmod: '1', nommod: 'Modelo QA' }] });

  const sedes = await fetch(`${base}/api/sedes`);
  assert.equal(sedes.status, 200);
  assert.deepEqual(llamadas, [['hu012_modelos_publicados'], ['hu010_sedes_publicas']]);

  const ubicaciones = await fetch(`${base}/api/ubicaciones`);
  assert.equal(ubicaciones.status, 401);
}, { data: [{ codmod: '1', nommod: 'Modelo QA' }], error: null }));
