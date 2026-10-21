import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import type { EstadoMovimientosUnidad, MovimientoUbicacion } from '../src/types/movimiento.types';

interface Perfil { codusu: string; uuidusu: string; rol: 'Gerente' | 'Administradora' | 'Vendedor' }
interface Llamada { nombre: string; parametros: unknown; token: string }
interface RespuestaRPC { data: unknown; error: { code?: string; message?: string } | null }
interface RespuestaHTTP { status: number; body: { ok?: boolean; message?: string; data?: unknown } }
type Requester = (metodo: string, ruta: string, body?: unknown, token?: string) => Promise<RespuestaHTTP>;

const perfiles: Record<string, Perfil> = {
  gerente: { codusu: '1', uuidusu: '00000000-0000-0000-0000-000000000001', rol: 'Gerente' },
  administradora: { codusu: '2', uuidusu: '00000000-0000-0000-0000-000000000002', rol: 'Administradora' },
  vendedor: { codusu: '3', uuidusu: '00000000-0000-0000-0000-000000000003', rol: 'Vendedor' }
};

const movimiento: MovimientoUbicacion = {
  codmub: '12', coduni: '20',
  origen: { codubi: '4', nomubi: 'Crossland Ancón' },
  destino: { codubi: '5', nomubi: 'FIVESA' },
  estado: 'En transito', fechaSalida: '2026-10-19', horaSalida: '09:30:00',
  autorSalida: { nombre: 'Gerente QA' }, fechaRecepcion: null, horaRecepcion: null,
  autorRecepcion: null, observacion: 'Traslado para instalación de techo'
};
const estado: EstadoMovimientosUnidad = {
  coduni: '20', ubicacionConfirmada: { codubi: '4', nomubi: 'Crossland Ancón' },
  movimientoActivo: movimiento, movimientos: [movimiento]
};

async function entorno(
  caso: (request: Requester, llamadas: Llamada[]) => Promise<void>,
  respuestas: Record<string, RespuestaRPC> = {}
) {
  const llamadas: Llamada[] = [];
  const fabrica = (token: string) => ({
    auth: { getUser: async () => token === 'expired'
      ? { data: { user: null }, error: {} }
      : { data: { user: { id: perfiles[token]?.uuidusu ?? '00000000-0000-0000-0000-000000000004' } }, error: null } },
    rpc: async (nombre: string, parametros?: unknown) => {
      if (nombre === 'hu007_usuario_actual')
        return { data: token === 'inactive' ? null : perfiles[token] ?? null, error: null };
      llamadas.push({ nombre, parametros, token });
      return respuestas[nombre] ?? { data: nombre === 'hu003_consultar_movimientos' ? estado : movimiento, error: null };
    }
  } as unknown as SupabaseClient);
  const servidor = crearApp(fabrica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const direccion = servidor.address() as AddressInfo;
  const request: Requester = async (metodo, ruta, body, token = 'gerente') => {
    const respuesta = await fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: respuesta.status, body: await respuesta.json() };
  };
  try { await caso(request, llamadas); }
  finally { servidor.closeAllConnections(); await new Promise<void>(resolve => servidor.close(() => resolve())); }
}

test('HU-003 API: gerente y administradora inician un movimiento con solo los campos permitidos', async () => entorno(async (request, llamadas) => {
  const body = { codubiori: '4', codubides: '5', obsmub: ' Traslado para instalación de techo ' };
  for (const token of ['gerente', 'administradora']) {
    const respuesta = await request('POST', '/api/unidades/20/movimientos', body, token);
    assert.equal(respuesta.status, 201);
    assert.equal((respuesta.body.data as MovimientoUbicacion).estado, 'En transito');
  }
  assert.deepEqual(llamadas.map(llamada => [llamada.nombre, llamada.parametros]), [
    ['hu003_iniciar_movimiento', { p_coduni: '20', p_codubiori: '4', p_codubides: '5', p_obsmub: 'Traslado para instalación de techo' }],
    ['hu003_iniciar_movimiento', { p_coduni: '20', p_codubiori: '4', p_codubides: '5', p_obsmub: 'Traslado para instalación de techo' }]
  ]);
}));

test('HU-003 API: Vendedor no inicia ni recibe; los tres roles consultan el historial', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('POST', '/api/unidades/20/movimientos', { codubiori: '4', codubides: '5' }, 'vendedor')).status, 403);
  assert.equal((await request('PATCH', '/api/unidades/20/movimientos/12/recepcion', undefined, 'vendedor')).status, 403);
  assert.equal(llamadas.length, 0);
  for (const token of ['gerente', 'administradora', 'vendedor']) {
    const respuesta = await request('GET', '/api/unidades/20/movimientos', undefined, token);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body.data, estado);
  }
  assert.ok(llamadas.every(llamada => llamada.nombre === 'hu003_consultar_movimientos'));
}));

test('HU-003 API: autenticación rechaza ausencia de token, sesión vencida y cuenta sin rol activo', async () => entorno(async request => {
  assert.equal((await request('GET', '/api/unidades/20/movimientos', undefined, '')).status, 401);
  assert.equal((await request('GET', '/api/unidades/20/movimientos', undefined, 'expired')).status, 401);
  assert.equal((await request('GET', '/api/unidades/20/movimientos', undefined, 'inactive')).status, 403);
}));

test('HU-003 API: recepción PATCH no admite campos de autor, estado o fecha del cliente', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('PATCH', '/api/unidades/20/movimientos/12/recepcion')).status, 200);
  for (const body of [{ codusurec: '2' }, { estmub: 'Finalizado' }, { fecrecmub: '2026-10-19' }, { observacion: 'recibido' }])
    assert.equal((await request('PATCH', '/api/unidades/20/movimientos/12/recepcion', body)).status, 400);
  assert.deepEqual(llamadas.map(llamada => [llamada.nombre, llamada.parametros]), [
    ['hu003_confirmar_recepcion', { p_coduni: '20', p_codmub: '12' }]
  ]);
}));

test('HU-003 API: rechaza IDs, origen igual a destino, campos extra y tipos inválidos antes de RPC', async () => entorno(async (request, llamadas) => {
  const valido = { codubiori: '4', codubides: '5' };
  for (const id of ['0', '-1', '1.5', '9223372036854775808'])
    assert.equal((await request('GET', `/api/unidades/${id}/movimientos`)).status, 400);
  for (const [ruta, body] of [
    ['/api/unidades/20/movimientos', { codubiori: '4', codubides: '4' }],
    ['/api/unidades/20/movimientos', { ...valido, codusu: '1' }],
    ['/api/unidades/20/movimientos', { ...valido, estmub: 'Finalizado' }],
    ['/api/unidades/20/movimientos', { ...valido, obsmub: 4 }],
    ['/api/unidades/20/movimientos', { codubiori: 0, codubides: '5' }]
  ] as const) assert.equal((await request('POST', ruta, body)).status, 400);
  assert.equal((await request('PATCH', '/api/unidades/20/movimientos/0/recepcion')).status, 400);
  assert.equal(llamadas.length, 0);
}));

for (const [code, status] of [
  ['PT400', 400], ['PT404', 404], ['PT409', 409], ['PT422', 409], ['PT423', 409],
  ['PT424', 409], ['PT425', 409], ['23505', 409], ['40001', 409], ['40P01', 409], ['XX000', 500]
] as const) {
  test(`HU-003 API: traduce ${code} sin exponer mensajes internos`, async () => entorno(async request => {
    const respuesta = await request('POST', '/api/unidades/20/movimientos', { codubiori: '4', codubides: '5' });
    assert.equal(respuesta.status, status);
    assert.ok(!JSON.stringify(respuesta.body).includes('secreto de base de datos'));
  }, { hu003_iniciar_movimiento: { data: null, error: { code, message: 'secreto de base de datos' } } }));
}
