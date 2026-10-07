import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ConflictoIdentificacion, ErrorUnidadBD, FacturaCompraResultado,
  IdentificacionCompraResultado, IdentificarCompraRequest
} from '../src/types/unidad.types';
import { crearApp } from '../src/app';

interface LlamadaRPC { nombre: string; args: unknown; token: string }
interface RespuestaMock { data: IdentificacionCompraResultado | FacturaCompraResultado | null; error: ErrorUnidadBD | null }
interface RespuestaHTTP { status: number; body: { ok: boolean; data?: IdentificacionCompraResultado; message?: string; conflicto?: ConflictoIdentificacion } }
type Peticion = (metodo: string, ruta: string, body?: unknown, rol?: string) => Promise<RespuestaHTTP>;
type Caso = (request: Peticion, llamadas: LlamadaRPC[]) => Promise<void>;

const lote: IdentificarCompraRequest = {
  unidades: [{ nummotuni: ' m-01 ', chauni: ' c-01 ', codmod: '1', coluni: ' Azul ' }]
};
const resultado: IdentificacionCompraResultado = {
  codcom: '1', cantidad_comprada: 4, cantidad_identificada: 1, cantidad_pendiente: 3,
  estcom: 'Pendiente de identificación', factura: null,
  unidades: [{ coduni: '1', codcom: '1', codmod: '1', nummotuni: 'M-01', chauni: 'C-01', coluni: 'Azul', fecreguni: '2026-10-06T10:00:00Z' }]
};
async function entorno(caso: Caso, respuesta: RespuestaMock = { data: resultado, error: null }) {
  const llamadas: LlamadaRPC[] = [];
  const fabrica = (token: string) => ({
    auth: { getUser: async () => ({ data: { user: token === 'expired' ? null : { id: token } }, error: null }) },
    rpc: async (nombre: string, args: unknown) => {
      if (nombre === 'hu026_rol_actual') return { data: token === 'inactive' ? null : token, error: null };
      llamadas.push({ nombre, args, token });
      return respuesta;
    }
  } as unknown as SupabaseClient);
  const servidor = crearApp(fabrica).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const direccion = servidor.address();
  if (!direccion || typeof direccion === 'string') throw new Error('Puerto no disponible');
  const request: Peticion = async (metodo, ruta, body, rol = 'Gerente') => {
    const r = await fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', ...(rol ? { Authorization: `Bearer ${rol}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: r.status, body: await r.json() };
  };
  try { await caso(request, llamadas); }
  finally { servidor.closeAllConnections(); await new Promise<void>(resolve => servidor.close(() => resolve())); }
}

test('HU002 API: gerente y administradora identifican usando contratos y datos normalizados', async () => entorno(async (request, llamadas) => {
  for (const rol of ['Gerente', 'Administradora']) {
    const r = await request('POST', '/api/compras/1/unidades', lote, rol);
    assert.equal(r.status, 201); assert.equal(r.body.data?.cantidad_pendiente, 3);
  }
  assert.deepEqual(llamadas[0].args, {
    p_codcom: '1',
    p_unidades: [{ nummotuni: 'M-01', chauni: 'C-01', codmod: '1', coluni: 'Azul' }]
  });
}));
test('HU002 API: GET por compra, sin endpoint individual adicional', async () => entorno(async (request, llamadas) => {
  assert.equal((await request('GET', '/api/compras/1/unidades')).status, 200);
  assert.equal(llamadas[0].nombre, 'hu002_consultar_unidades');
  assert.deepEqual(llamadas[0].args, { p_codcom: '1' });
}));
test('HU002 API: el cliente no puede sustituir la cantidad almacenada en factura', async () => entorno(async (request, llamadas) => {
  for (const extra of [{ cantidad_factura: 4 }, { p_cantidad_factura: 4 }, { cantidad_motos: 4 }, { requiere_revision: false }]) {
    assert.equal((await request('POST', '/api/compras/1/unidades', { ...lote, ...extra })).status, 400);
  }
  assert.equal(llamadas.length, 0);
}));
test('HU002 API: vendedor, sesión ausente/vencida y cuenta inactiva rechazados', async () => entorno(async (request, llamadas) => {
  for (const [rol, estado] of [['Vendedor', 403], ['', 401], ['expired', 401], ['inactive', 403]] as const) {
    assert.equal((await request('POST', '/api/compras/1/unidades', lote, rol)).status, estado);
    assert.equal((await request('GET', '/api/compras/1/unidades', undefined, rol)).status, estado);
    assert.equal((await request('PUT', '/api/compras/1/factura', {}, rol)).status, estado);
  }
  assert.equal(llamadas.length, 0);
}));
test('HU002 API: valida ID, cantidad, lote y series; rechaza bonificaciones/datos operativos', async () => entorno(async (request, llamadas) => {
  for (const body of [null, [], {}, { ...lote, cantidad_factura: 0 }, { ...lote, cantidad_factura: 1.5 },
    { ...lote, cantidad_factura: '4' }, { ...lote, unidades: [] }, { ...lote, unidades: Array(101).fill(lote.unidades[0]) },
    { ...lote, aceites: 8 }, { ...lote, unidades: [{ ...lote.unidades[0], codubi: 1 }] },
    { ...lote, unidades: [{ ...lote.unidades[0], estcomuni: 'Disponible' }] },
    { ...lote, unidades: [{ ...lote.unidades[0], codepr: 1 }] },
    { ...lote, unidades: [{ ...lote.unidades[0], nummotuni: '' }] },
    { ...lote, unidades: [{ ...lote.unidades[0], chauni: 5 }] },
    { ...lote, unidades: [{ ...lote.unidades[0], nummotuni: 'A'.repeat(101) }] },
    { ...lote, unidades: [{ ...lote.unidades[0], coluni: null }] }])
    assert.equal((await request('POST', '/api/compras/1/unidades', body)).status, 400);
  assert.equal((await request('POST', '/api/compras/0/unidades', lote)).status, 400);
  assert.equal((await request('POST', '/api/compras/1/unidades', { ...lote, unidades: [lote.unidades[0], lote.unidades[0]] })).status, 409);
  assert.equal(llamadas.length, 0);
}));
test('HU002 API: registra metadatos y muestra discrepancia de factura sin inventar adjunto', async () => entorno(async (request, llamadas) => {
  const r = await request('PUT', '/api/compras/1/factura', { emisor: ' Crossland ', numero: ' F001-1 ', fecha_emision: '2026-10-01', cantidad_motos: 5 });
  assert.equal(r.status, 200); assert.match(r.body.message ?? '', /discrepancia/);
  assert.deepEqual(llamadas[0].args, { p_codcom: '1', p_emisor: 'Crossland', p_numero: 'F001-1', p_fecha_emision: '2026-10-01', p_cantidad_motos: 5 });
}, { data: { codcom: '1', estcom: 'Pendiente de identificación', requiere_revision: true,
  factura: { codfac: '1', emisor: 'Crossland', numero: 'F001-1', fecha_emision: '2026-10-01', cantidad_motos: 5, archivo_adjuntado: false } }, error: null }));
test('HU002 API: factura requiere metadatos válidos y no acepta URL/archivo improvisado', async () => entorno(async (request, llamadas) => {
  const base = { emisor: 'Crossland', numero: 'F001-1', fecha_emision: '2026-10-01', cantidad_motos: 4 };
  for (const body of [{ ...base, numero: '' }, { ...base, fecha_emision: '2026-02-30' }, { ...base, fecha_emision: 'ayer' },
    { ...base, cantidad_motos: -1 }, { ...base, archivo: 'https://example.com/factura.pdf' }])
    assert.equal((await request('PUT', '/api/compras/1/factura', body)).status, 400);
  assert.equal(llamadas.length, 0);
}));
test('HU002 API: 409 con proyección segura de duplicado, sin datos ajenos', async () => entorno(async request => {
  const r = await request('POST', '/api/compras/1/unidades', lote);
  assert.equal(r.status, 409); assert.equal(r.body.conflicto?.unidad.coduni, '1');
  assert.ok(!JSON.stringify(r.body).includes('secreto'));
}, { data: null, error: { code: 'PT409', details: JSON.stringify({ campo: 'nummotuni', unidad: { ...resultado.unidades[0], obsuni: 'secreto' }, privado: 'secreto' }) } }));
for (const [code, estado] of [['PT404',404], ['PT410',409], ['PT411',409], ['PT412',409], ['PT413',409], ['40001',409], ['40P01',409], ['XX000',500]] as const)
  test(`HU002 API: traduce ${code} sin exponer error interno`, async () => entorno(async request => {
    const r = await request('POST', '/api/compras/1/unidades', lote);
    assert.equal(r.status, estado); assert.ok(!JSON.stringify(r.body).includes('secreto'));
  }, { data: null, error: { code, details: 'secreto' } }));
