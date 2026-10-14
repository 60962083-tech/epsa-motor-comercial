import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app';
import type { SupabaseClient } from '@supabase/supabase-js';
import { validarId } from '../src/utils/validacion';

const sede = { codubi: '1', nomubi: 'Sede QA', tipubi: 'Sede', dirubi: null, estubi: true, telsed: '999000001', horsed: 'Lunes a sábado' };

async function entorno(
  fn: (request: (method?: string, path?: string, body?: unknown, role?: string) => Promise<{ status: number; body: any }>, calls: any[]) => Promise<void>,
  result: any = { data: [sede], error: null }
) {
  const calls: any[] = [];
  const factory = (token: string) => ({
    auth: { getUser: async () => token === 'expired' ? { data: { user: null }, error: {} } : { data: { user: { id: token } }, error: null } },
    rpc: async (name: string, args?: unknown) => {
      if (name === 'hu007_usuario_actual') return { data: token === 'inactive' ? null : { codusu: '1', uuidusu: token, rol: token }, error: null };
      calls.push({ token, name, args });
      if (!result.error && !name.includes('listar_ubicaciones')) return { data: sede, error: null };
      return result;
    }
  } as unknown as SupabaseClient);
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

test('ubicaciones requiere sesión válida; vendedores solo pueden consultar', async () => entorno(async request => {
  for (const [role, status] of [[undefined, 401], ['expired', 401], ['inactive', 403]] as const)
    assert.equal((await request('GET', '', undefined, role)).status, status);
  assert.equal((await request('GET', '', undefined, 'Vendedor')).status, 200);
  for (const [method, path] of [['POST', ''], ['PUT', '/1'], ['PATCH', '/1/estado']] as const)
    assert.equal((await request(method, path, {}, 'Vendedor')).status, 403);
}));

test('GET conserva filtro activo y devuelve datos públicos del panel por RPC', async () => entorno(async (request, calls) => {
  const listado = await request('GET', '?activo=false', undefined, 'Gerente');
  assert.equal(listado.status, 200);
  assert.deepEqual(listado.body, { ok: true, data: [sede] });
  assert.deepEqual(calls[0], { token: 'Gerente', name: 'hu026_listar_ubicaciones', args: { p_activo: false } });
  assert.equal((await request('GET', '?activo=otro', undefined, 'Gerente')).status, 400);
}));

test('POST crea ubicación no Sede por RPC atómica', async () => entorno(async (request, calls) => {
  const res = await request('POST', '', { nomubi: '  Taller   nuevo ', tipubi: 'Proveedor' }, 'Gerente');
  assert.equal(res.status, 201);
  assert.equal(calls[0].name, 'hu026_crear_ubicacion');
  assert.deepEqual(calls[0].args, { p_nomubi: 'Taller nuevo', p_tipubi: 'Proveedor', p_dirubi: null, p_telsed: null, p_horsed: null });
}));

test('POST Sede envía teléfono y horario para guardarlos en la tabla sede', async () => entorno(async (request, calls) => {
  const res = await request('POST', '', { nomubi: 'Comas', tipubi: 'Sede', dirubi: ' Av. 1 ', telsed: '999 000 001', horsed: 'Lunes a sábado' }, 'Administradora');
  assert.equal(res.status, 201);
  assert.deepEqual(calls[0].args, {
    p_nomubi: 'Comas', p_tipubi: 'Sede', p_dirubi: 'Av. 1', p_telsed: '999 000 001', p_horsed: 'Lunes a sábado'
  });
  assert.deepEqual(res.body.data, sede);
}));

test('valida campos, límites y campos de sede solo cuando tipubi es Sede', async () => entorno(async (request, calls) => {
  const invalidos = [null, [], {}, { nomubi: 15 }, { nomubi: '   ', tipubi: 'Sede' },
    { nomubi: 'A', tipubi: 'Otro' }, { nomubi: 'a'.repeat(121), tipubi: 'Sede' },
    { nomubi: 'A', tipubi: 'Sede', dirubi: 10 }, { nomubi: 'A', tipubi: 'Sede', dirubi: 'a'.repeat(251) },
    { nomubi: 'A', tipubi: 'Sede', telsed: 't'.repeat(21) }, { nomubi: 'A', tipubi: 'Proveedor', telsed: null },
    { nomubi: 'A', tipubi: 'Sede', codubi: '10' }];
  for (const body of invalidos) assert.equal((await request('POST', '', body, 'Gerente')).status, 400);
  assert.equal(calls.length, 0);
}));

test('PUT actualiza una Sede; permite convertir otra ubicación y conserva campos omitidos', async () => entorno(async (request, calls) => {
  const body = { nomubi: 'Comas', tipubi: 'Sede', telsed: null };
  const res = await request('PUT', '/1', body, 'Gerente');
  assert.equal(res.status, 200);
  assert.equal(calls[0].name, 'hu026_actualizar_ubicacion');
  assert.deepEqual(calls[0].args, {
    p_codubi: '1', p_nomubi: 'Comas', p_tipubi: 'Sede', p_dirubi: null,
    p_telsed: null, p_horsed: null, p_actualizar_telsed: true, p_actualizar_horsed: false
  });
}));

test('PUT permite crear/activar registro sede al convertir tipo y rechaza campos sede al convertir desde Sede', async () => entorno(async (request, calls) => {
  assert.equal((await request('PUT', '/1', { nomubi: 'Nueva sede', tipubi: 'Sede', horsed: 'L-V' }, 'Administradora')).status, 200);
  assert.equal(calls[0].name, 'hu026_actualizar_ubicacion');
  assert.equal(calls[0].args.p_actualizar_horsed, true);
  assert.equal((await request('PUT', '/1', { nomubi: 'Comas', tipubi: 'Proveedor', telsed: null }, 'Gerente')).status, 400);
  assert.equal(calls.length, 1);
}));

test('PATCH de estado utiliza RPC transaccional y valida ID/booleano', async () => entorno(async (request, calls) => {
  const res = await request('PATCH', '/1/estado', { estubi: false }, 'Gerente');
  assert.equal(res.status, 200);
  assert.deepEqual(calls[0], { token: 'Gerente', name: 'hu026_cambiar_estado_ubicacion', args: { p_codubi: '1', p_estubi: false } });
  for (const id of ['0', '-1', '1.5', 'abc', '9223372036854775808'])
    assert.equal((await request('PATCH', `/${id}/estado`, { estubi: false }, 'Gerente')).status, 400);
  assert.equal((await request('PATCH', '/1/estado', { estubi: 'false' }, 'Gerente')).status, 400);
  assert.equal(validarId('9223372036854775807'), '9223372036854775807');
}));

test('ubicación inexistente responde 404 sin detalles internos', async () => entorno(async request => {
  const res = await request('PUT', '/123', { nomubi: 'Sede', tipubi: 'Sede' }, 'Gerente');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { ok: false, message: 'La ubicación no existe' });
}, { data: null, error: { code: 'PT404', message: 'private' } }));

for (const [code, status] of [['23505', 409], ['PT409', 409], ['42501', 403], ['23514', 400], ['PT400', 400], ['XX000', 500]]) {
  test(`traduce error de RPC ${code} sin exponer detalles`, async () => entorno(async request => {
    const res = await request('PATCH', '/1/estado', { estubi: false }, 'Gerente');
    assert.equal(res.status, status);
    assert.ok(!JSON.stringify(res.body).includes('detalle privado'));
  }, { data: null, error: { code, message: 'detalle privado', details: 'detalle privado', hint: 'detalle privado' } }));
}

test('las llamadas concurrentes mantienen su propio cliente autenticado', async () => entorno(async (request, calls) => {
  await Promise.all(['Gerente', 'Administradora'].map(role => request('POST', '', { nomubi: role, tipubi: 'Sede' }, role)));
  assert.deepEqual(calls.map(c => c.token).sort(), ['Administradora', 'Gerente']);
}));
