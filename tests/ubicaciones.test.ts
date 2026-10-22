import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearApp } from '../src/app';
import { SupabaseClient } from '@supabase/supabase-js';
import { validarId } from '../src/utils/validacion';

const proyeccion = 'codubi,nomubi,tipubi,dirubi,telubi,estubi';
const fila = { codubi: '1', nomubi: 'Comas', tipubi: 'Sede', dirubi: 'Av. Uno', telubi: '+51 999 999 999', estubi: true };

async function entorno(fn: (request: Function, calls: any[]) => Promise<void>, result: any = { data: fila, error: null }) {
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
      from: (table: string) => { calls.push({ token, method: 'from', args: [table] }); return query; }
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
    assert.equal((await request('POST', '', { nomubi: '  Taller   nuevo ', tipubi: 'Proveedor', telubi: '  +51 999 999 999  ' }, role)).status, 201);
  }
  assert.deepEqual(calls.filter((x: any) => x.method === 'insert').map((x: any) => x.args[0]), [
    { nomubi: 'Taller nuevo', tipubi: 'Proveedor', dirubi: null, telubi: '+51 999 999 999', estubi: true },
    { nomubi: 'Taller nuevo', tipubi: 'Proveedor', dirubi: null, telubi: '+51 999 999 999', estubi: true }
  ]);
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

test('POST y PUT normalizan null, cadena vacía y espacios como NULL', async () => entorno(async (request, calls) => {
  const valores = [null, '', '   '];
  for (const [i, telubi] of valores.entries()) {
    const body = { nomubi: `Ubicación ${i}`, tipubi: 'Almacen', telubi };
    assert.equal((await request('POST', '', body, 'Gerente')).status, 201);
    assert.equal((await request('PUT', `/${i + 1}`, body, 'Administradora')).status, 200);
  }
  assert.deepEqual(calls.filter((x: any) => x.method === 'insert' || x.method === 'update')
    .map((x: any) => x.args[0].telubi), [null, null, null, null, null, null]);
}));

test('acepta los formatos telefónicos acordados sin alterar prefijo ni ceros iniciales', async () => entorno(async (request, calls) => {
  const valores = ['+51 999 999 999', '01 555 1234', '999999999', '(01) 555-1234', '001234567'];
  for (const [i, telubi] of valores.entries())
    assert.equal((await request('POST', '', { nomubi: `Formato ${i}`, tipubi: 'Sede', telubi }, 'Gerente')).status, 201);
  assert.deepEqual(calls.filter((x: any) => x.method === 'insert').map((x: any) => x.args[0].telubi), valores);
}));

test('rechaza contactos inválidos y payloads con campos desconocidos', async () => entorno(async (request, calls) => {
  const contactos: unknown[] = [123456789, '0', 'abc123', '999@999', '++51 999 999 999', '51+999999999', '<script>', 'tel:999999999', '1'.repeat(41)];
  for (const telubi of contactos)
    assert.equal((await request('POST', '', { nomubi: 'Ubicación inválida', tipubi: 'Almacen', telubi }, 'Gerente')).status, 400);
  for (const campo of ['telefono', 'contacto', 'telsed', 'horsed'])
    assert.equal((await request('POST', '', { nomubi: 'Ubicación extra', tipubi: 'Almacen', [campo]: '999999999' }, 'Gerente')).status, 400);
  assert.equal(calls.filter((x: any) => x.method === 'insert').length, 0);
}));

test('GET listado y detalle incluyen solo la proyección acordada; Vendedor puede consultar', async () => {
  await entorno(async (request, calls) => {
  const listado = await request('GET', '', undefined, 'Vendedor');
  assert.equal(listado.status, 200);
  assert.deepEqual(listado.body, { ok: true, data: [fila] });
  assert.ok(calls.some((x: any) => x.method === 'select' && x.args[0] === proyeccion));
  }, { data: [fila], error: null });

  await entorno(async (request, calls) => {
  const detalle = await request('GET', '/1', undefined, 'Vendedor');
  assert.equal(detalle.status, 200);
  assert.deepEqual(detalle.body, { ok: true, data: fila });
  assert.ok(calls.some((x: any) => x.method === 'select' && x.args[0] === proyeccion));
  assert.ok(calls.some((x: any) => x.method === 'eq' && x.args[0] === 'codubi' && x.args[1] === '1'));
  }, { data: fila, error: null });
});

test('GET detalle inexistente responde 404 y no incluye información de sede', async () => entorno(async (request, calls) => {
  const respuesta = await request('GET', '/999', undefined, 'Gerente');
  assert.equal(respuesta.status, 404);
  assert.deepEqual(respuesta.body, { ok: false, message: 'La ubicación no existe' });
  assert.ok(calls.every((x: any) => x.args[0] !== 'sede'));
}, { data: null, error: null }));

test('Gerente y Administradora actualizan telubi sin cambiar otros campos', async () => entorno(async (request, calls) => {
  for (const rol of ['Gerente', 'Administradora']) {
    const respuesta = await request('PUT', '/1', {
      nomubi: fila.nomubi, tipubi: fila.tipubi, dirubi: fila.dirubi, telubi: '001234567'
    }, rol);
    assert.equal(respuesta.status, 200);
  }
  const updates = calls.filter((x: any) => x.method === 'update');
  assert.deepEqual(updates.map((x: any) => x.args[0]), [
    { nomubi: 'Comas', tipubi: 'Sede', dirubi: 'Av. Uno', telubi: '001234567' },
    { nomubi: 'Comas', tipubi: 'Sede', dirubi: 'Av. Uno', telubi: '001234567' }
  ]);
}));

test('PUT omitiendo telubi lo reemplaza por NULL', async () => entorno(async (request, calls) => {
  assert.equal((await request('PUT', '/1', { nomubi: 'Comas', tipubi: 'Sede', dirubi: 'Av. Uno' }, 'Gerente')).status, 200);
  assert.deepEqual(calls.find((x: any) => x.method === 'update').args[0], {
    nomubi: 'Comas', tipubi: 'Sede', dirubi: 'Av. Uno', telubi: null
  });
}));

test('Vendedor no puede crear ni actualizar; petición sin token recibe 401', async () => entorno(async request => {
  const body = { nomubi: 'Ubicación', tipubi: 'Almacen', telubi: '999999999' };
  assert.equal((await request('POST', '', body, 'Vendedor')).status, 403);
  assert.equal((await request('PUT', '/1', body, 'Vendedor')).status, 403);
  assert.equal((await request('GET', '')).status, 401);
}));

test('GET detalle rechaza un ID no válido antes de consultar la tabla', async () => entorno(async (request, calls) => {
  assert.equal((await request('GET', '/0', undefined, 'Gerente')).status, 400);
  assert.equal(calls.length, 0);
}));
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
