import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import type { InventarioResultado } from '../src/types/inventario.types';

interface Perfil { codusu: string; uuidusu: string; rol: 'Gerente' | 'Administradora' | 'Vendedor' }
interface Llamada { nombre: string; parametros: unknown; token: string }
interface RespuestaRPC { data: unknown; error: { code?: string; message?: string; details?: string } | null }
interface RespuestaHTTP { status: number; body: { ok?: boolean; message?: string; data?: InventarioResultado } }
type Requester = (ruta: string, token?: string) => Promise<RespuestaHTTP>;

const perfiles: Record<string, Perfil> = {
  Gerente: { codusu: '1', uuidusu: '00000000-0000-0000-0000-000000000001', rol: 'Gerente' },
  Administradora: { codusu: '2', uuidusu: '00000000-0000-0000-0000-000000000002', rol: 'Administradora' },
  Vendedor: { codusu: '3', uuidusu: '00000000-0000-0000-0000-000000000003', rol: 'Vendedor' }
};

const unidad = {
  coduni: '21', modelo: { codmod: '4', nommod: 'Modelo QA' },
  nummotuni: 'MOTOR-21', chauni: 'CHASIS-21', color: 'Azul',
  ubicacionConfirmada: { codubi: '2', nomubi: 'Comas', tipubi: 'Sede' },
  movimientoActivo: { codmub: '7', estado: 'En transito', destino: { codubi: '3', nomubi: 'FIVESA' } },
  techo: null, preparacion: null,
  preparacionOperativa: {
    coduni: '21', armado: 'Pendiente',
    techo: { estado: 'Pendiente', codtte: null, configuracion: null, requiereInstalacion: null },
    version: '1', preparacionCompleta: false,
    condicionesFaltantes: ['Armado pendiente', 'Configuración de techo pendiente'],
    ultimaActualizacion: '2026-10-28T12:00:00Z', actualizadoPor: null
  },
  situacionComercial: 'No disponible'
};
const inventario: InventarioResultado = {
  items: [unidad], total: 1, limite: 50, offset: 0,
  resumen: { unidadesIdentificadas: 1, cantidadPendienteIdentificacion: 0 }
};

async function entorno(
  caso: (request: Requester, llamadas: Llamada[]) => Promise<void>,
  respuesta: RespuestaRPC = { data: inventario, error: null }
) {
  const llamadas: Llamada[] = [];
  const fabrica = (token: string) => ({
    auth: { getUser: async () => token === 'vencido'
      ? { data: { user: null }, error: {} }
      : { data: { user: { id: perfiles[token]?.uuidusu ?? '00000000-0000-0000-0000-000000000004' } }, error: null } },
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

test('HU-001 API: los tres roles permitidos reciben la consulta central autenticada', async () => entorno(async (request, llamadas) => {
  for (const rol of ['Gerente', 'Administradora', 'Vendedor']) {
    const respuesta = await request('/api/inventario', rol);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body, { ok: true, data: inventario });
  }
  assert.equal(llamadas.length, 3);
  assert.ok(llamadas.every(llamada => llamada.nombre === 'hu001_consultar_inventario'));
  assert.ok(llamadas.every(llamada => JSON.stringify(llamada.parametros) === JSON.stringify({
    p_codubi: null, p_codmod: null, p_estado: null, p_color: null,
    p_codtte: null, p_codepr: null, p_limite: 50, p_offset: 0
  })));
}));

test('HU-001 API: sin token, sesión vencida y usuario no autorizado son rechazados antes de consultar', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('/api/inventario', '')).status, 401);
  assert.equal((await request('/api/inventario', 'vencido')).status, 401);
  assert.equal((await request('/api/inventario', 'inactivo')).status, 403);
  assert.equal(llamadas.length, 0);
}));

test('HU-001 API: todos los filtros se combinan y mapean a la RPC', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('/api/inventario?codubi=2&codmod=4&estado=Disponible&color=%20Azul%20&codtte=5&codepr=6');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(llamadas[0].parametros, {
    p_codubi: '2', p_codmod: '4', p_estado: 'Disponible', p_color: 'Azul',
    p_codtte: '5', p_codepr: '6', p_limite: 50, p_offset: 0
  });
}));

test('HU-001 API: permite filtrar por cada campo admitido', async () => entorno(async (request, llamadas) => {
  for (const filtro of ['codubi=2', 'codmod=4', 'estado=Disponible', 'color=Azul', 'codtte=5', 'codepr=6'])
    assert.equal((await request(`/api/inventario?${filtro}`)).status, 200);
  assert.equal(llamadas.length, 6);
}));

test('HU-001 API: una consulta válida sin coincidencias devuelve lista vacía', async () => entorno(async request => {
  const respuesta = await request('/api/inventario?codmod=999');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.body.data?.items, []);
}, { data: { ...inventario, items: [], total: 0 }, error: null }));

test('HU-001 API: la paginación respeta limite y offset', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('/api/inventario?limite=25&offset=50')).status, 200);
  assert.deepEqual(llamadas[0].parametros, {
    p_codubi: null, p_codmod: null, p_estado: null, p_color: null,
    p_codtte: null, p_codepr: null, p_limite: 25, p_offset: 50
  });
}));

test('HU-001 API: rechaza IDs, filtros y paginación inválidos sin invocar la RPC', async () => entorno(async (request, llamadas) => {
  const rutas = [
    '/api/inventario?codubi=0', '/api/inventario?codmod=-1', '/api/inventario?codtte=1.5',
    '/api/inventario?codepr=9223372036854775808', '/api/inventario?codubi=1&codubi=2',
    '/api/inventario?color=%20', '/api/inventario?estado=Disponible&extra=1',
    '/api/inventario?limite=0', '/api/inventario?limite=101', '/api/inventario?limite=1.5',
    '/api/inventario?offset=-1', '/api/inventario?offset=2147483648'
  ];
  for (const ruta of rutas) assert.equal((await request(ruta)).status, 400, ruta);
  assert.equal(llamadas.length, 0);
}));

test('HU-001 API: el contrato proyecta solo los campos públicos de inventario', async () => entorno(async request => {
  const respuesta = await request('/api/inventario');
  assert.equal(respuesta.status, 200);
  const item = respuesta.body.data?.items[0] as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(item).sort(), [
    'chauni', 'coduni', 'color', 'modelo', 'movimientoActivo', 'nummotuni',
    'preparacion', 'preparacionOperativa', 'situacionComercial', 'techo', 'ubicacionConfirmada'
  ].sort());
  assert.equal(item.nummotuni, 'MOTOR-21');
  assert.equal(item.chauni, 'CHASIS-21');
  assert.equal((item.preparacionOperativa as { armado: string }).armado, 'Pendiente');
  const serializado = JSON.stringify(respuesta.body);
  for (const campo of ['codcom', 'codcli', 'cliente', 'obsuni', 'factura', 'precom', 'motor', 'chasis', 'historial', 'idempotencia'])
    assert.equal(serializado.includes(`"${campo}"`), false, campo);
}));

for (const [code, status] of [['PT400', 400], ['42501', 403], ['XX000', 500]] as const) {
  test(`HU-001 API: sanitiza error RPC ${code}`, async () => entorno(async request => {
    const respuesta = await request('/api/inventario');
    assert.equal(respuesta.status, status);
    assert.equal(JSON.stringify(respuesta.body).includes('detalle secreto'), false);
    assert.equal(JSON.stringify(respuesta.body).includes('SQL privado'), false);
  }, { data: null, error: { code, message: 'SQL privado', details: 'detalle secreto' } }));
}
