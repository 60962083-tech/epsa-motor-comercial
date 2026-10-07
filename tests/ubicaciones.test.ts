import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app';
import { SupabaseClient } from '@supabase/supabase-js';
import { validarId } from '../src/utils/validacion';

async function entorno(fn: (request: Function, calls: any[]) => Promise<void>, result: any = { data: { codubi: 1 }, error: null }) {
  const calls: any[] = [];
  const factory = (token: string) => {
    const query: any = {};
    for (const method of ['select', 'order', 'eq', 'insert', 'update']) query[method] = (...args: any[]) => {
      calls.push({ token, method, args }); return query;
    };
    query.single = query.maybeSingle = async () => result;
    query.then = (resolve: Function, reject: Function) => Promise.resolve(result).then(resolve as any, reject as any);
    return {
      auth: { getUser: async () => token === 'expired' ? { data: { user: null }, error: {} } : { data: { user: { id: token } }, error: null } },
      rpc: async () => ({ data: token === 'inactive' ? null : { codusu: '1', uuidusu: token, rol: token }, error: null }),
      from: () => query
    } as unknown as SupabaseClient;
  };
  const server = crearApp(factory).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const request = async (method = 'GET', path = '', body?: unknown, role?: string) => {
    const res = await fetch(`http://127.0.0.1:${address.port}/api/ubicaciones${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${role}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(request, calls); } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
}

test('rechaza sesión ausente/vencida y usuario inactivo', async () => entorno(async request => {
  for (const [role, status] of [[undefined, 401], ['expired', 401], ['inactive', 403]])
    assert.equal((await request('GET', '', undefined, role)).status, status);
}));
test('vendedor consulta pero no crea, edita ni desactiva', async () => entorno(async request => {
  assert.equal((await request('GET', '', undefined, 'Vendedor')).status, 200);
  for (const [method, path] of [['POST', ''], ['PUT', '/1'], ['PATCH', '/1/estado']])
    assert.equal((await request(method, path, {}, 'Vendedor')).status, 403);
}));
test('gerente y administradora crean; normaliza nombre y permite dirección desconocida', async () => entorno(async (request, calls) => {
  for (const role of ['Gerente', 'Administradora']) {
    assert.equal((await request('POST', '', { nomubi: '  Taller   nuevo ', tipubi: 'Proveedor' }, role)).status, 201);
  }
  assert.deepEqual(calls.find((x: any) => x.method === 'insert').args[0], { nomubi: 'Taller nuevo', tipubi: 'Proveedor', dirubi: null, estubi: true });
}));
test('rechaza tipos de datos, límites y nombres vacíos antes de acceder a la tabla', async () => entorno(async (request, calls) => {
  for (const datos of [null, [], {}, { nomubi: 15 }, { nomubi: '   ' }, { nomubi: 'A', tipubi: 'Otro' },
    { nomubi: 'a'.repeat(121), tipubi: 'Sede' }, { nomubi: 'A', tipubi: 'Sede', dirubi: 10 },
    { nomubi: 'A', tipubi: 'Sede', dirubi: 'a'.repeat(251) }])
    assert.equal((await request('POST', '', datos, 'Gerente')).status, 400);
  assert.equal(calls.length, 0);
}));
test('IDs positivos BIGINT y estado booleano estricto', async () => entorno(async request => {
  for (const id of ['0', '-1', '1.5', 'abc', '9223372036854775808'])
    assert.equal((await request('PATCH', `/${id}/estado`, { estubi: false }, 'Gerente')).status, 400);
  assert.equal((await request('PATCH', '/1/estado', { estubi: 'false' }, 'Gerente')).status, 400);
  assert.equal(validarId('9223372036854775807'), '9223372036854775807');
}));
test('selección de movimientos filtra ubicaciones activas', async () => entorno(async (request, calls) => {
  assert.equal((await request('GET', '?activo=true', undefined, 'Vendedor')).status, 200);
  assert.ok(calls.some((x: any) => x.method === 'eq' && x.args[0] === 'estubi' && x.args[1] === true));
  assert.equal((await request('GET', '?activo=otro', undefined, 'Gerente')).status, 400);
}));
test('ubicación inexistente responde 404', async () => entorno(async request => {
  assert.equal((await request('PATCH', '/123/estado', { estubi: false }, 'Gerente')).status, 404);
}, { data: null, error: null }));
for (const [code, status] of [['23505', 409], ['PT409', 409], ['42501', 403], ['23514', 400], ['XX000', 500]]) {
  test(`traduce error de base de datos ${code} sin exponer detalles`, async () => entorno(async request => {
    const r = await request('PATCH', '/1/estado', { estubi: false }, 'Gerente');
    assert.equal(r.status, status);
    assert.ok(!JSON.stringify(r.body).includes('detalle privado'));
  }, { data: null, error: { code, message: 'detalle privado' } }));
}
test('peticiones simultáneas conservan su propio usuario', async () => entorno(async (request, calls) => {
  await Promise.all(['Gerente', 'Administradora'].map(role => request('POST', '', { nomubi: role, tipubi: 'Sede' }, role)));
  for (const c of calls.filter((x: any) => x.method === 'insert')) assert.equal(c.token, c.args[0].nomubi);
}));
