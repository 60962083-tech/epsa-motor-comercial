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

test('HU-012: catálogo público sin sesión; incluye precio y colores sin propagar filtros a la RPC', async () => {
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
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(`${url}/admin`)).status, 401);
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

test('HU-009: ficha pública usa la RPC por ID sin sesión y devuelve solo modelo e imágenes activas', async () => {
  const llamadas: unknown[][] = [];
  const fabrica = (...args: unknown[]) => {
    assert.deepEqual(args, []);
    return { rpc: async (nombre: string, parametros?: unknown) => {
      llamadas.push([nombre, parametros]);
      return { data: {
        codmod: '1', nommod: 'Modelo prueba 1', marmod: 'Bajaj',
        desmod: 'Modelo registrado para pruebas', carmod: 'Configuración estándar',
        premod: null, colores: [],
        imagenes: [{ urlimo: 'https://example.test/foto-1.jpg', ordimo: 1 }]
      }, error: null };
    } } as unknown as SupabaseClient;
  };
  await entorno(fabrica, async base => {
    const respuesta = await fetch(`${base}/1`);
    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await respuesta.json(), { ok: true, data: {
      codmod: '1', nommod: 'Modelo prueba 1', marmod: 'Bajaj',
      desmod: 'Modelo registrado para pruebas', carmod: 'Configuración estándar',
      premod: null, colores: [],
      imagenes: [{ urlimo: 'https://example.test/foto-1.jpg', ordimo: 1 }]
    } });
    assert.deepEqual(llamadas, [['hu009_modelo_publicado_por_id', { p_codmod: '1' }]]);
    for (const id of ['0', '-1', '1.2', 'abc', '9223372036854775808']) {
      const invalida = await fetch(`${base}/${id}`);
      assert.equal(invalida.status, 400);
      assert.deepEqual(await invalida.json(), { ok: false, message: 'Identificador de modelo inválido' });
    }
    for (const filtros of ['estmod=Borrador', 'select=*', 'or=(estmod.eq.Borrador)']) {
      assert.equal((await fetch(`${base}/1?${filtros}`)).status, 400);
      assert.equal((await fetch(`${base}?${filtros}`)).status, 400);
    }
    assert.equal(llamadas.length, 1);
  });
});

test('HU-009: inexistente, Borrador, No publicado y despublicado comparten 404', async () => {
  const fabrica = () => ({ rpc: async (_nombre: string, parametros: { p_codmod: string }) => ({
    data: parametros.p_codmod === '1' ? {
      codmod: '1', nommod: 'Modelo', marmod: 'Bajaj', desmod: 'Descripción', carmod: 'Características',
      premod: null, colores: [], imagenes: []
    } : null,
    error: null
  }) }) as unknown as SupabaseClient;
  await entorno(fabrica, async base => {
    for (const id of ['2', '3', '999']) {
      const respuesta = await fetch(`${base}/${id}`);
      assert.equal(respuesta.status, 404);
      assert.equal(respuesta.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await respuesta.json(), { ok: false, message: 'Modelo no disponible' });
    }
    const sinImagenes = await fetch(`${base}/1`);
    assert.equal(sinImagenes.status, 200);
    assert.deepEqual((await sinImagenes.json()).data.imagenes, []);
  });
});

test('HU-009: falla con respuesta genérica si Supabase falla', async () => {
  const fabrica = () => ({ rpc: async () => ({ data: null, error: { code: 'XX000', message: 'SQL privado' } }) }) as unknown as SupabaseClient;
  await entorno(fabrica, async base => {
    const respuesta = await fetch(`${base}/1`);
    assert.equal(respuesta.status, 500);
    assert.deepEqual(await respuesta.json(), { ok: false, message: 'Error interno al consultar el modelo' });
  });
});
