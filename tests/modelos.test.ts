import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import type { FabricaClientePublico } from '../src/types/modelo.types';

async function entorno(fabrica: FabricaClientePublico, verificar: (url: string) => Promise<void>) {
  const server = crearApp(undefined, fabrica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    await verificar(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/modelos`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('HU-012: catálogo público sin sesión; no propaga token, body ni filtros a la RPC', async () => {
  const llamadas: unknown[][] = [];
  const fabrica = (...args: unknown[]) => {
    assert.deepEqual(args, []);
    return { rpc: async (...parametros: unknown[]) => {
      llamadas.push(parametros);
      return { data: [], error: null };
    } } as unknown as SupabaseClient;
  };
  await entorno(fabrica, async url => {
    for (const headers of [{}, { Authorization: 'Bearer token-invalido', 'x-role': 'Gerente' }]) {
      const respuesta = await fetch(url, { headers });
      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await respuesta.json(), { ok: true, data: [] });
    }
    assert.deepEqual(llamadas, [['hu012_modelos_publicados'], ['hu012_modelos_publicados']]);
    for (const query of ['estmod=Borrador', 'estmod=No%20publicado', 'estado=Publicado',
      'select=*', 'or=(estmod.eq.Borrador)', 'estmod=Publicado&estmod=Borrador', 'estmod[in]=Borrador']) {
      const respuesta = await fetch(`${url}?${query}`);
      assert.equal(respuesta.status, 400);
      assert.equal('data' in await respuesta.json(), false);
    }
    assert.equal(llamadas.length, 2);
    assert.equal((await fetch(url, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${url}/1`, { method: 'DELETE' })).status, 404);
    assert.equal((await fetch(url.replace('/modelos', '/compras'))).status, 401);
    assert.equal((await fetch(url.replace('/modelos', '/ubicaciones'))).status, 401);
  });
});

test('HU-012: errores de consulta no exponen detalles internos', async () => {
  await entorno(() => ({ rpc: async () => ({ data: null, error: { message: 'detalle SQL privado' } }) }) as unknown as SupabaseClient,
    async url => {
      const respuesta = await fetch(url);
      assert.equal(respuesta.status, 500);
      assert.deepEqual(await respuesta.json(), { ok: false, message: 'Error al consultar el catálogo de modelos' });
    });
});
