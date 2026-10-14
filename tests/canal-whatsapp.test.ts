import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app';
import type { SupabaseClient } from '@supabase/supabase-js';

const canal = { codcwa: '1', nomcwa: 'Ventas', numcwa: '51907000001', enlcwa: 'https://wa.me/51907000001', estcwa: true };

async function entorno(
  fn: (request: (id?: string, body?: unknown, role?: string) => Promise<{ status: number; body: any }>, calls: any[]) => Promise<void>,
  result: any = { data: canal, error: null }
) {
  const calls: any[] = [];
  const factory = (token: string) => ({
    auth: { getUser: async () => token === 'expired' ? { data: { user: null }, error: {} } : { data: { user: { id: token } }, error: null } },
    rpc: async (name: string, args?: unknown) => {
      if (name === 'hu007_usuario_actual') return { data: token === 'inactive' ? null : { codusu: '1', uuidusu: token, rol: token }, error: null };
      calls.push({ token, name, args });
      return result;
    }
  } as unknown as SupabaseClient);
  const server = crearApp(factory).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const request = async (id = '1', body?: unknown, role?: string) => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/canal-whatsapp/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(request, calls); } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}

test('gerente y administradora actualizan el canal por RPC; normaliza número internacional', async () => entorno(async (request, calls) => {
  for (const role of ['Gerente', 'Administradora']) {
    const res = await request('1', { numcwa: '+51 (907) 000-001', estcwa: true }, role);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { ok: true, message: 'Canal WhatsApp actualizado correctamente', data: canal });
  }
  assert.deepEqual(calls[0].args, { p_codcwa: '1', p_cambios: {
    numcwa: '51907000001', enlcwa: 'https://wa.me/51907000001', estcwa: true
  } });
  assert.ok(calls.every(c => c.name === 'hu013_actualizar_canal_whatsapp'));
}));

test('acepta número y enlace wa.me correspondientes, normalizando ambos', async () => entorno(async (request, calls) => {
  const res = await request('1', { numcwa: '+51 (907) 000-001', enlcwa: 'https://wa.me/51907000001' }, 'Gerente');
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0].args, { p_codcwa: '1', p_cambios: {
    numcwa: '51907000001', enlcwa: 'https://wa.me/51907000001'
  } });
}));

test('rechaza número y enlace wa.me de teléfonos distintos antes de llamar la RPC', async () => entorno(async (request, calls) => {
  const res = await request('1', { numcwa: '51907000001', enlcwa: 'https://wa.me/51907000002' }, 'Gerente');
  assert.equal(res.status, 400);
  assert.deepEqual(res.body, { ok: false, message: 'enlcwa debe corresponder al número numcwa' });
  assert.equal(calls.length, 0);
}));

test('actualizar solo el nombre conserva número y enlace sin enviarlos a la RPC', async () => entorno(async (request, calls) => {
  const res = await request('1', { nomcwa: 'Atención comercial' }, 'Administradora');
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0].args, { p_codcwa: '1', p_cambios: { nomcwa: 'Atención comercial' } });
}));

test('requiere token y protege la modificación de vendedores', async () => entorno(async request => {
  assert.equal((await request('1', { numcwa: '51907000001' })).status, 401);
  assert.equal((await request('1', { numcwa: '51907000001' }, 'expired')).status, 401);
  assert.equal((await request('1', { numcwa: '51907000001' }, 'Vendedor')).status, 403);
}));

test('rechaza ID, cuerpo, columnas y valores inválidos antes de llamar la RPC', async () => entorno(async (request, calls) => {
  for (const [id, body] of [
    ['0', { numcwa: '51907000001' }], ['abc', { numcwa: '51907000001' }],
    ['9223372036854775808', { numcwa: '51907000001' }],
    ['1', {}], ['1', null], ['1', { numcwa: '' }], ['1', { numcwa: '123456' }],
    ['1', { numcwa: '51907ABC001' }], ['1', { nomcwa: '  ' }], ['1', { enlcwa: 'http://wa.me/51907000001' }],
    ['1', { enlcwa: 'https://user:pass@wa.me/51907000001' }], ['1', { estcwa: 'true' }],
    ['1', { credencial: 'secreto' }]
  ] as Array<[string, unknown]>) assert.equal((await request(id, body, 'Gerente')).status, 400);
  assert.equal(calls.length, 0);
}));

test('canal inexistente responde 404 y número duplicado 409 sin filtrar Supabase', async () => {
  await entorno(async request => {
    const res = await request('2', { numcwa: '51907000002' }, 'Gerente');
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { ok: false, message: 'El canal WhatsApp no existe' });
  }, { data: null, error: { code: 'PT404', message: 'canal privado' } });
  await entorno(async request => {
    const res = await request('1', { numcwa: '51907000002' }, 'Administradora');
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { ok: false, message: 'Ya existe un canal WhatsApp con ese número' });
    assert.ok(!JSON.stringify(res.body).includes('duplicate key'));
  }, { data: null, error: { code: '23505', message: 'duplicate key private' } });
});

test('el RPC no se llama sin enviar un campo editable del canal', async () => entorno(async (request, calls) => {
  assert.equal((await request('1', undefined, 'Gerente')).status, 400);
  assert.equal(calls.length, 0);
}));
