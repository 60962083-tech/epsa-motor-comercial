import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import { consultarComprasPendientes } from '../src/services/compras.pendientes.service';
import type {
  ComprasPendientesResultado,
  ConsultaComprasPendientesInput
} from '../src/types/compras.pendientes.types';

interface Perfil {
  codusu: string;
  uuidusu: string;
  rol: 'Gerente' | 'Administradora' | 'Vendedor';
}
interface LlamadaRPC { nombre: string; parametros: unknown; token: string }
interface ErrorRPC { code?: string; message?: string; details?: string }
interface RespuestaRPC { data: unknown; error: ErrorRPC | null }
interface RespuestaHTTP { status: number; body: { ok?: boolean; message?: string; data?: ComprasPendientesResultado } }
type Requester = (ruta: string, token?: string) => Promise<RespuestaHTTP>;

const perfiles: Record<string, Perfil> = {
  Gerente: { codusu: '1', uuidusu: '00000000-0000-0000-0000-000000000001', rol: 'Gerente' },
  Administradora: { codusu: '2', uuidusu: '00000000-0000-0000-0000-000000000002', rol: 'Administradora' },
  Vendedor: { codusu: '3', uuidusu: '00000000-0000-0000-0000-000000000003', rol: 'Vendedor' }
};

const resultadoVacio: ComprasPendientesResultado = {
  compras: [],
  documentos_sin_compra: [],
  conteo: {
    'Pendiente de factura': 0,
    'Pendiente de identificación': 0,
    'Pendiente de recepción': 0,
    'Incidencia documental': 0
  },
  total: 0,
  limite: 200,
  offset: 0
};

async function entorno(
  caso: (request: Requester, llamadas: LlamadaRPC[]) => Promise<void>,
  respuesta: RespuestaRPC = { data: resultadoVacio, error: null }
) {
  const llamadas: LlamadaRPC[] = [];
  const fabrica = (token: string) => ({
    auth: {
      getUser: async () => token === 'vencido'
        ? { data: { user: null }, error: { message: 'invalid token' } }
        : { data: { user: { id: perfiles[token]?.uuidusu ?? '00000000-0000-0000-0000-000000000004' } }, error: null }
    },
    rpc: async (nombre: string, parametros?: unknown) => {
      if (nombre === 'hu007_usuario_actual')
        return { data: token === 'inactivo' ? null : perfiles[token] ?? null, error: null };
      llamadas.push({ nombre, parametros, token });
      return respuesta;
    }
  } as unknown as SupabaseClient);

  const servidor = crearApp(fabrica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const direccion = servidor.address() as AddressInfo;
  const request: Requester = async (ruta, token = 'Gerente') => {
    const http = await fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    return { status: http.status, body: await http.json() };
  };
  try { await caso(request, llamadas); }
  finally { servidor.closeAllConnections(); await new Promise<void>(resolve => servidor.close(() => resolve())); }
}

test('HU-023 API: Gerente recibe 200 con la consulta consolidada', async () => entorno(async (request, calls) => {
  const response = await request('/api/compras-pendientes');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { ok: true, data: resultadoVacio });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.nombre, 'hu023_consultar_compras_pendientes');
}));

test('HU-023 API: Administradora recibe 200', async () => entorno(async request => {
  assert.equal((await request('/api/compras-pendientes', 'Administradora')).status, 200);
}));

test('HU-023 API: Vendedor recibe 403 antes de llamar la RPC', async () => entorno(async (request, calls) => {
  const response = await request('/api/compras-pendientes', 'Vendedor');
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
}));

test('HU-023 API: lista vacía se devuelve con 200 y colecciones vacías', async () => entorno(async request => {
  const response = await request('/api/compras-pendientes');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data?.compras, []);
  assert.deepEqual(response.body.data?.documentos_sin_compra, []);
  assert.equal(response.body.data?.total, 0);
}));

test('HU-023 API: filtra el origen Manual y mapea filtros a la RPC', async () => entorno(async (request, calls) => {
  assert.equal((await request('/api/compras-pendientes?origen=Manual&limite=25&offset=10')).status, 200);
  assert.deepEqual(calls[0]!.parametros, { p_origen: 'Manual', p_limite: 25, p_offset: 10 });
}));

test('HU-023 API: normaliza Automatico y el alias del frontend al valor canónico', async () => entorno(async (request, calls) => {
  assert.equal((await request('/api/compras-pendientes?origen=Automatico')).status, 200);
  assert.deepEqual(calls[0]!.parametros, { p_origen: 'Automatico', p_limite: 200, p_offset: 0 });
  assert.equal((await request('/api/compras-pendientes?origen=Autom%C3%A1tico')).status, 200);
  assert.deepEqual(calls[1]!.parametros, { p_origen: 'Automatico', p_limite: 200, p_offset: 0 });
}));

test('HU-023 API: origen inválido devuelve 400 y no llama la RPC', async () => entorno(async (request, calls) => {
  assert.equal((await request('/api/compras-pendientes?origen=Vendedor')).status, 400);
  assert.equal(calls.length, 0);
}));

test('HU-023 API: limite inválido devuelve 400 y no llama la RPC', async () => entorno(async (request, calls) => {
  for (const valor of ['0', '-1', '201', '1.5', 'abc'])
    assert.equal((await request(`/api/compras-pendientes?limite=${encodeURIComponent(valor)}`)).status, 400, valor);
  assert.equal(calls.length, 0);
}));

test('HU-023 API: offset inválido devuelve 400 y no llama la RPC', async () => entorno(async (request, calls) => {
  for (const valor of ['-1', '1.5', '2147483648', 'abc'])
    assert.equal((await request(`/api/compras-pendientes?offset=${encodeURIComponent(valor)}`)).status, 400, valor);
  assert.equal(calls.length, 0);
}));

test('HU-023 service: ejecuta exactamente una RPC con los parámetros recibidos', async () => {
  const llamadas: LlamadaRPC[] = [];
  const db = {
    rpc: async (nombre: string, parametros?: unknown) => {
      llamadas.push({ nombre, parametros, token: 'service-test' });
      return { data: resultadoVacio, error: null };
    }
  } as unknown as SupabaseClient;
  const filtros: ConsultaComprasPendientesInput = {
    p_origen: 'Manual',
    p_limite: 37,
    p_offset: 74
  };

  const resultado = await consultarComprasPendientes(db, filtros);
  assert.deepEqual(resultado, resultadoVacio);
  assert.equal(llamadas.length, 1);
  assert.deepEqual(llamadas[0], {
    nombre: 'hu023_consultar_compras_pendientes',
    parametros: filtros,
    token: 'service-test'
  });
});

test('HU-023 API: error RPC responde 500 sin exponer detalles internos', async () => entorno(async (request, calls) => {
  const response = await request('/api/compras-pendientes');
  assert.equal(response.status, 500);
  assert.equal(response.body.message, 'Error interno al consultar las compras pendientes');
  assert.equal(JSON.stringify(response.body).includes('SQL privado'), false);
  assert.equal(JSON.stringify(response.body).includes('detalle secreto'), false);
  assert.equal(calls.length, 1);
}, { data: null, error: { code: 'XX000', message: 'SQL privado', details: 'detalle secreto' } }));

test('HU-023 API: error 42501 de la RPC se traduce a 403', async () => entorno(async request => {
  const response = await request('/api/compras-pendientes');
  assert.equal(response.status, 403);
}, { data: null, error: { code: '42501', message: 'detalle interno' } }));

test('HU-023 API: falta de autenticación conserva la respuesta estándar', async () => entorno(async (request, calls) => {
  const response = await request('/api/compras-pendientes', '');
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
}));
