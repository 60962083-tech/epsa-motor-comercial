import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';

type Opciones = {
  compraError?: unknown; sinFactura?: boolean; existe?: boolean;
  listError?: unknown; uploadError?: unknown; urlError?: unknown; lanzarStorage?: boolean;
};
async function entorno(fn: (request: any, calls: any[]) => Promise<void>, opciones: Opciones = {}) {
  const calls: any[] = [];
  let existe = opciones.existe ?? false;
  const factory = (token: string) => ({
    auth: { getUser: async () => ({ data: { user: { id: token } }, error: null }) },
    rpc: async (name: string, args: unknown) => {
      if (name === 'hu007_usuario_actual') return { data: { codusu: '1', uuidusu: token, rol: token }, error: null };
      calls.push({ name, args, token });
      assert.equal(name, 'hu002_consultar_unidades');
      return { data: { codcom: '15', factura: opciones.sinFactura ? null : { codfac: '1' } }, error: opciones.compraError };
    },
    storage: { from: (bucket: string) => {
      assert.equal(bucket, 'facturas-compra');
      if (opciones.lanzarStorage) throw new Error('detalle privado');
      return {
        list: async (path: string, options: unknown) => {
          calls.push({ name: 'list', path, options, token });
          return { data: existe ? [{ name: 'factura.pdf' }] : [], error: opciones.listError };
        },
        upload: async (path: string, buffer: Buffer, options: unknown) => {
          calls.push({ name: 'upload', path, buffer, options, token });
          if (!opciones.uploadError) existe = true;
          return { data: {}, error: opciones.uploadError };
        },
        createSignedUrl: async (path: string, seconds: number) => {
          calls.push({ name: 'url', path, seconds, token });
          return { data: { signedUrl: 'https://storage.example/signed' }, error: opciones.urlError };
        }
      };
    } }
  } as unknown as SupabaseClient);
  const server = crearApp(factory).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  const request = async (method = 'GET', suffix = '', role = 'Gerente', body?: FormData, id = '15') => {
    const response = await fetch(`http://127.0.0.1:${port}/api/compras/${id}/factura/archivo${suffix}`, {
      method, headers: role ? { Authorization: `Bearer ${role}` } : {}, body
    });
    return { status: response.status, body: await response.json() };
  };
  try { await fn(request, calls); }
  finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
function archivo(type = 'application/pdf', size?: number, field = 'archivo') {
  const form = new FormData();
  form.append(field, new Blob([size === undefined ? '%PDF-1.7\nprueba' : new Uint8Array(size)], { type }), 'original.pdf');
  return form;
}

for (const rol of ['Gerente', 'Administradora']) {
  test(`PDF: ${rol} sube en memoria con JWT y sin sobrescribir`, async () => entorno(async (request, calls) => {
    const r = await request('POST', '', rol, archivo());
    assert.equal(r.status, 201);
    assert.deepEqual(r.body.data, { codcom: '15', archivo_adjuntado: true, nombre: 'factura.pdf' });
    const upload = calls.find(c => c.name === 'upload');
    assert.equal(upload.token, rol);
    assert.equal(upload.path, 'compras/15/factura.pdf');
    assert.ok(Buffer.isBuffer(upload.buffer));
    assert.deepEqual(upload.options, { contentType: 'application/pdf', upsert: false });
    assert.equal((await request('POST', '', rol, archivo())).status, 409);
    assert.equal(calls.filter(c => c.name === 'upload').length, 1);
  }));
}
test('PDF: todos los endpoints requieren Bearer y rol de gestión', async () => entorno(async (request, calls) => {
  for (const [method, suffix] of [['POST', ''], ['GET', ''], ['GET', '/url']]) {
    assert.equal((await request(method, suffix, '')).status, 401);
    assert.equal((await request(method, suffix, 'Vendedor')).status, 403);
  }
  assert.equal(calls.length, 0);
}));
test('PDF: rechaza MIME, tamaño, ausencia, campo inesperado y varios archivos', async () => entorno(async (request, calls) => {
  const dos = archivo(); dos.append('archivo', new Blob(['%PDF'], { type: 'application/pdf' }), 'otro.pdf');
  for (const form of [archivo('text/plain'), archivo('application/pdf', 10 * 1024 * 1024 + 1),
    new FormData(), undefined, archivo('application/pdf', undefined, 'otro'), dos]) {
    assert.equal((await request('POST', '', 'Gerente', form)).status, 400);
  }
  assert.equal(calls.length, 0);
}));
test('PDF: acepta archivo de exactamente 10 MB', async () => entorno(async request => {
  assert.equal((await request('POST', '', 'Gerente', archivo('application/pdf', 10 * 1024 * 1024))).status, 201);
}));
test('PDF: valida bigint en todos los endpoints', async () => entorno(async (request, calls) => {
  for (const id of ['0', '-1', 'abc', '1.5', '9223372036854775808']) {
    for (const [method, suffix] of [['POST', ''], ['GET', ''], ['GET', '/url']]) {
      assert.equal((await request(method, suffix, 'Gerente', method === 'POST' ? archivo() : undefined, id)).status, 400);
    }
  }
  assert.equal(calls.length, 0);
}));
for (const opciones of [{ compraError: { code: 'PT404', message: 'privado' } }, { sinFactura: true }]) {
  test(`PDF: rechaza compra o factura inexistente ${JSON.stringify(opciones)}`, async () => entorno(async (request, calls) => {
    for (const [method, suffix] of [['POST', ''], ['GET', ''], ['GET', '/url']]) {
      assert.equal((await request(method, suffix, 'Gerente', method === 'POST' ? archivo() : undefined)).status, 404);
    }
    assert.ok(calls.every(c => c.name === 'hu002_consultar_unidades'));
  }, opciones));
}
for (const existe of [false, true]) {
  test(`PDF: consulta devuelve archivo_adjuntado ${existe}`, async () => entorno(async request => {
    const r = await request(); assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true, data: { codcom: '15', archivo_adjuntado: existe } });
  }, { existe }));
}
test('PDF: archivo existente produce 409 sin llamar upload', async () => entorno(async (request, calls) => {
  assert.equal((await request('POST', '', 'Gerente', archivo())).status, 409);
  assert.ok(!calls.some(c => c.name === 'upload'));
}, { existe: true }));
for (const error of [{ status: 400, code: 'ResourceAlreadyExists' }, { status: 400, statusCode: 'Duplicate' }, { status: 409 }]) {
  test(`PDF: conflicto concurrente ${JSON.stringify(error)} responde 409`, async () => entorno(async request => {
    assert.equal((await request('POST', '', 'Gerente', archivo())).status, 409);
  }, { uploadError: error }));
}
test('PDF: URL ausente produce 404 sin firmar', async () => entorno(async (request, calls) => {
  assert.equal((await request('GET', '/url')).status, 404);
  assert.ok(!calls.some(c => c.name === 'url'));
}));
test('PDF: roles autorizados reciben URL firmada por 60 segundos', async () => entorno(async (request, calls) => {
  for (const rol of ['Gerente', 'Administradora']) {
    const r = await request('GET', '/url', rol);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body.data, { url: 'https://storage.example/signed', expira_en: 60 });
    assert.deepEqual(calls[calls.length - 1], { name: 'url', path: 'compras/15/factura.pdf', seconds: 60, token: rol });
  }
}, { existe: true }));
for (const opciones of [
  { listError: { message: 'detalle privado' } }, { uploadError: { message: 'detalle privado' } },
  { existe: true, urlError: { message: 'detalle privado' } }, { lanzarStorage: true }
]) {
  test(`PDF: errores inesperados no revelan detalles ${JSON.stringify(opciones)}`, async () => entorno(async request => {
    const r = await request(opciones.urlError ? 'GET' : 'POST', opciones.urlError ? '/url' : '', 'Gerente', opciones.urlError ? undefined : archivo());
    assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('privado'));
  }, opciones));
}
test('PDF: Storage denegado responde 403', async () => entorno(async request => {
  assert.equal((await request('POST', '', 'Gerente', archivo())).status, 403);
}, { uploadError: { status: 403, message: 'privado' } }));
test('PDF: objeto desaparecido antes de firmar responde 404', async () => entorno(async request => {
  assert.equal((await request('GET', '/url')).status, 404);
}, { existe: true, urlError: { code: 'NoSuchKey', message: 'privado' } }));
test('PDF: preserva precisión del codcom bigint', async () => entorno(async (request, calls) => {
  const id = '9223372036854775807';
  const r = await request('POST', '', 'Gerente', archivo(), id);
  assert.equal(r.status, 201);
  assert.equal(r.body.data.codcom, id);
  assert.equal(calls[0].args.p_codcom, id);
  assert.equal(calls.find(c => c.name === 'upload').path, `compras/${id}/factura.pdf`);
}));
