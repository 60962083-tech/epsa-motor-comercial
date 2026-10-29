import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { crearApp } from '../src/app';
import { obtenerClaveIdempotencia } from '../src/utils/preparacion.unidad.validacion';
import type {
  ActualizarPreparacionUnidadRequest,
  ConsultaPreparacionUnidad,
  PreparacionUnidadActual
} from '../src/types/preparacion.unidad.types';

interface Perfil { codusu: string; uuidusu: string; rol: 'Gerente' | 'Administradora' | 'Vendedor' }
interface Llamada { nombre: string; parametros: unknown; token: string }
interface RespuestaRPC { data: unknown; error: { code?: string; message?: string; details?: string; hint?: string } | null }
interface RespuestaHTTP { status: number; body: { ok?: boolean; message?: string; data?: unknown } }
type Requester = (
  metodo: string,
  ruta: string,
  body?: unknown,
  token?: string,
  headers?: Record<string, string>
) => Promise<RespuestaHTTP>;

const perfiles: Record<string, Perfil> = {
  gerente: { codusu: '1', uuidusu: '00000000-0000-0000-0000-000000000001', rol: 'Gerente' },
  administradora: { codusu: '2', uuidusu: '00000000-0000-0000-0000-000000000002', rol: 'Administradora' },
  vendedor: { codusu: '3', uuidusu: '00000000-0000-0000-0000-000000000003', rol: 'Vendedor' }
};

const actual: PreparacionUnidadActual = {
  coduni: '20', armado: 'Pendiente',
  techo: { estado: 'Pendiente', codtte: '4', configuracion: 'Techo alto', requiereInstalacion: true },
  version: '3', preparacionCompleta: false,
  condicionesFaltantes: ['Armado pendiente', 'Instalación de techo pendiente'],
  ultimaActualizacion: '2026-10-28T12:00:00Z',
  actualizadoPor: { codusu: '1', nombre: 'Gerente QA' }
};
const consulta: ConsultaPreparacionUnidad = {
  actual,
  historial: [{
    codhprep: '8', etapa: 'Techo', estadoAnterior: 'En proceso', estadoNuevo: 'Pendiente',
    fecha: '2026-10-28T12:00:00Z', observacion: 'Revisión requerida', fuente: 'Interno',
    proveedor: null, autor: { codusu: '1', nombre: 'Gerente QA' }
  }]
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
      return respuestas[nombre] ?? { data: nombre === 'hu033_consultar_preparacion_unidad' ? consulta : actual, error: null };
    }
  } as unknown as SupabaseClient);
  const servidor = crearApp(fabrica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const direccion = servidor.address() as AddressInfo;
  const request: Requester = async (metodo, ruta, body, token = 'gerente', headers = {}) => {
    const respuesta = await fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers
      },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: respuesta.status, body: await respuesta.json() };
  };
  try { await caso(request, llamadas); }
  finally { servidor.closeAllConnections(); await new Promise<void>(resolve => servidor.close(() => resolve())); }
}

const bodyArmado: ActualizarPreparacionUnidadRequest = {
  etapa: 'Armado', estado: 'Terminado', version: 3, observacion: '   ', fuente: 'Interno'
};
const bodyTecho: ActualizarPreparacionUnidadRequest = {
  etapa: 'Techo', estado: 'Instalado', version: 3, observacion: 'Trabajo confirmado', fuente: 'Aviso proveedor'
};

test('HU-033 API: Gerente consulta preparación y conserva estado e historial con una sola RPC', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('GET', '/api/unidades/20/preparacion', undefined, 'gerente');
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.body.data, consulta);
  assert.equal((respuesta.body.data as ConsultaPreparacionUnidad).historial.length, 1);
  assert.deepEqual(llamadas, [{ nombre: 'hu033_consultar_preparacion_unidad', parametros: { p_coduni: '20' }, token: 'gerente' }]);
}));

test('HU-033 API: Administradora y Vendedor consultan si la RPC los autoriza', async () => entorno(async request => {
  for (const token of ['administradora', 'vendedor']) {
    const respuesta = await request('GET', '/api/unidades/20/preparacion', undefined, token);
    assert.equal(respuesta.status, 200);
    assert.deepEqual(respuesta.body.data, consulta);
  }
}));

test('HU-033 API: GET exige autenticación y rechaza cuenta sin perfil activo', async () => entorno(async request => {
  assert.equal((await request('GET', '/api/unidades/20/preparacion', undefined, '')).status, 401);
  assert.equal((await request('GET', '/api/unidades/20/preparacion', undefined, 'expired')).status, 401);
  assert.equal((await request('GET', '/api/unidades/20/preparacion', undefined, 'inactive')).status, 403);
}));

test('HU-033 API: Gerente actualiza armado con una sola llamada y devuelve estado derivado', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'gerente', { 'Idempotency-Key': ' HU033-armado-01 ' });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(respuesta.body.data, actual);
  assert.equal((respuesta.body.data as PreparacionUnidadActual).preparacionCompleta, false);
  assert.deepEqual((respuesta.body.data as PreparacionUnidadActual).condicionesFaltantes, actual.condicionesFaltantes);
  assert.deepEqual(llamadas, [{
    nombre: 'hu033_actualizar_preparacion_unidad', token: 'gerente',
    parametros: {
      p_coduni: '20', p_etapa: 'Armado', p_estado: 'Terminado', p_version_esperada: 3,
      p_observacion: null, p_fuente: 'Interno', p_idempotencia: 'HU033-armado-01'
    }
  }]);
}));

test('HU-033 API: Administradora actualiza etapa de Techo y normaliza la observación', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('PATCH', '/api/unidades/20/preparacion', bodyTecho, 'administradora', { 'Idempotency-Key': 'techo-02' });
  assert.equal(respuesta.status, 200);
  assert.deepEqual(llamadas[0]?.parametros, {
    p_coduni: '20', p_etapa: 'Techo', p_estado: 'Instalado', p_version_esperada: 3,
    p_observacion: 'Trabajo confirmado', p_fuente: 'Aviso proveedor', p_idempotencia: 'techo-02'
  });
}));

test('HU-033 API: Vendedor recibe 403 antes de llamar la RPC de actualización', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'vendedor', { 'Idempotency-Key': 'denied' });
  assert.equal(respuesta.status, 403);
  assert.equal(llamadas.filter(llamada => llamada.nombre === 'hu033_actualizar_preparacion_unidad').length, 0);
}));

test('HU-033 API: Idempotency-Key obligatorio y único; ausencia no llama RPC', async () => entorno(async (request, llamadas) => {
  const respuesta = await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'gerente');
  assert.equal(respuesta.status, 400);
  assert.equal(llamadas.length, 0);
}));

test('HU-033 API: el header Idempotency-Key duplicado no se interpreta como una clave única', () => {
  assert.throws(() => obtenerClaveIdempotencia([
    'Idempotency-Key', 'clave-1', 'idempotency-key', 'clave-2'
  ]), /Idempotency-Key/);
  assert.equal(obtenerClaveIdempotencia(['Idempotency-Key', 'clave-unica']), 'clave-unica');
});

test('HU-033 API: valida etapa, estados por etapa, fuente, versión, observación y propiedades permitidas', async () => entorno(async (request, llamadas) => {
  const base = { ...bodyArmado };
  const invalidos: unknown[] = [
    { ...base, etapa: 'Pintura' },
    { ...base, estado: 'En proceso' },
    { ...base, etapa: 'Techo', estado: 'Terminado' },
    { ...base, etapa: 'Techo', estado: 'No requiere' },
    { ...base, fuente: 'Configuración techo' },
    { ...base, fuente: 'Externo' },
    { ...base, version: 0 }, { ...base, version: 1.5 }, { ...base, version: '3' },
    { ...base, observacion: 5 }, { ...base, observacion: 'x'.repeat(501) },
    { ...base, codusu: '1' }, { ...base, idempotencia: 'desde-body' }
  ];
  for (const body of invalidos) {
    const respuesta = await request('PATCH', '/api/unidades/20/preparacion', body, 'gerente', { 'Idempotency-Key': 'valid-key' });
    assert.equal(respuesta.status, 400);
  }
  assert.equal(llamadas.length, 0);
}));

test('HU-033 API: valida coduni antes de consultar la RPC', async () => entorno(async (request, llamadas) => {
  for (const coduni of ['0', '-1', '1.2', '9223372036854775808'])
    assert.equal((await request('GET', `/api/unidades/${coduni}/preparacion`)).status, 400);
  assert.equal(llamadas.length, 0);
}));

for (const [code, status] of [['PT409', 409], ['PT400', 400], ['22023', 400], ['42501', 403], ['PT404', 404], ['XX000', 500]] as const) {
  test(`HU-033 API: traduce ${code} sin exponer mensajes ni detalles internos`, async () => entorno(async (request, llamadas) => {
    const respuesta = await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'gerente', { 'Idempotency-Key': 'error-key' });
    assert.equal(respuesta.status, status);
    assert.ok(!JSON.stringify(respuesta.body).includes('secreto SQL'));
    assert.ok(!JSON.stringify(respuesta.body).includes('historialpreparacionunidad'));
    assert.equal(llamadas.length, 1);
  }, { hu033_actualizar_preparacion_unidad: {
    data: null,
    error: { code, message: 'secreto SQL', details: 'historialpreparacionunidad', hint: 'detalle privado' }
  } }));
}

test('HU-033 API: rechaza una clave de idempotencia vacía o demasiado larga antes de RPC', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'gerente', { 'Idempotency-Key': '   ' })).status, 400);
  assert.equal((await request('PATCH', '/api/unidades/20/preparacion', bodyArmado, 'gerente', { 'Idempotency-Key': 'k'.repeat(129) })).status, 400);
  assert.equal(llamadas.length, 0);
}));
