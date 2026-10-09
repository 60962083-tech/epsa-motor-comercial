import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import type { ConfiguracionTecho, ProveedorTechoCatalogo, TipoTechoCatalogo } from '../src/types/techo.types';

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

async function entorno(caso: (request: Requester, llamadas: Llamada[]) => Promise<void>, respuestas: Record<string, RespuestaRPC> = {}) {
  const llamadas: Llamada[] = [];
  const fabrica = (token: string) => ({
    auth: { getUser: async () => token === 'expired' ? { data: { user: null }, error: {} }
      : { data: { user: { id: perfiles[token]?.uuidusu ?? '00000000-0000-0000-0000-000000000004' } }, error: null } },
    rpc: async (nombre: string, parametros?: unknown) => {
      if (nombre === 'hu007_usuario_actual')
        return { data: token === 'inactive' ? null : perfiles[token] ?? null, error: null };
      llamadas.push({ nombre, parametros, token });
      return respuestas[nombre] ?? { data: {}, error: null };
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

test('HU-004: gerente, administradora y vendedor consultan configuración y catálogos autenticados', async () => entorno(async request => {
  const tipos: TipoTechoCatalogo[] = [{ codtte: '1', nomtte: 'Sin techo', reqprotte: false }];
  const proveedores: ProveedorTechoCatalogo[] = [{ codpro: '1', nompro: 'FIVESA' }];
  const config: ConfiguracionTecho = { coduni: '10', tipoTecho: null, proveedor: null, detalle: null };
  for (const token of ['gerente', 'administradora', 'vendedor']) {
    for (const [ruta, esperado] of [
      ['/api/unidades/catalogos/tipos-techo', tipos],
      ['/api/unidades/catalogos/proveedores-techo', proveedores],
      ['/api/unidades/10/techo', config]
    ] as const) {
      const respuesta = await request('GET', ruta, undefined, token);
      assert.equal(respuesta.status, 200);
      assert.deepEqual(respuesta.body.data, esperado);
    }
  }
}, {
  hu004_listar_tipos_techo: { data: [{ codtte: '1', nomtte: 'Sin techo', reqprotte: false }], error: null },
  hu004_listar_proveedores_techo: { data: [{ codpro: '1', nompro: 'FIVESA' }], error: null },
  hu004_obtener_configuracion_techo: { data: { coduni: '10', tipoTecho: null, proveedor: null, detalle: null }, error: null }
}));

test('HU-004: autenticación y vendedor no permiten PUT; mantiene usuario inactivo y sesión vencida', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('GET', '/api/unidades/1/techo', undefined, '')).status, 401);
  assert.equal((await request('GET', '/api/unidades/1/techo', undefined, 'expired')).status, 401);
  assert.equal((await request('GET', '/api/unidades/1/techo', undefined, 'inactive')).status, 403);
  assert.equal((await request('PUT', '/api/unidades/1/techo', { codtte: '1' }, 'vendedor')).status, 403);
  assert.equal(llamadas.length, 0);
}));

test('HU-004: gerente y administradora actualizan solo con el contrato de techo normalizado', async () => entorno(async (request, llamadas) => {
  for (const token of ['gerente', 'administradora']) {
    const respuesta = await request('PUT', '/api/unidades/10/techo', { codtte: '4', codpro: '2', detalle: '  Cámara   de retroceso  ' }, token);
    assert.equal(respuesta.status, 200);
    assert.match(respuesta.body.message ?? '', /no indica instalación física/);
  }
  assert.deepEqual(llamadas.map(llamada => llamada.parametros), [
    { p_coduni: '10', p_codtte: '4', p_codpro: '2', p_detalle: 'Cámara de retroceso' },
    { p_coduni: '10', p_codtte: '4', p_codpro: '2', p_detalle: 'Cámara de retroceso' }
  ]);
}, { hu004_actualizar_configuracion_techo: { data: { coduni: '10' }, error: null } }));

test('HU-004: valida IDs, detalle y rechaza campos ajenos sin llamar RPC de actualización', async () => entorno(async (request, llamadas) => {
  for (const id of ['0', '-1', '1.2', '9223372036854775808'])
    assert.equal((await request('GET', `/api/unidades/${id}/techo`)).status, 400);
  for (const body of [null, [], {}, { codtte: 1 }, { codtte: '0' }, { codtte: '1', codpro: 2 },
    { codtte: '1', detalle: 'x'.repeat(251) }, { codtte: '1', codepr: '2' },
    { codtte: '1', codubi: '2' }, { codtte: '1', codcom: '1' }, { codtte: '1', nummotuni: 'M' }])
    assert.equal((await request('PUT', '/api/unidades/10/techo', body)).status, 400);
  assert.equal(llamadas.length, 0);
}));

test('HU-004: errores controlados de PostgreSQL no exponen detalles internos', async () => entorno(async (request, llamadas) => {
  const r = await request('PUT', '/api/unidades/10/techo', { codtte: '4', codpro: '999' });
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'El proveedor no existe, está inactivo o no está habilitado para techos');
  assert.ok(!JSON.stringify(r.body).includes('secreto'));
  assert.equal(llamadas[0].nombre, 'hu004_actualizar_configuracion_techo');
}, { hu004_actualizar_configuracion_techo: { data: null, error: { code: 'PT422', message: 'secreto de base de datos' } } }));
