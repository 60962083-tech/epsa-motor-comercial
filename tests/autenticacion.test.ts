import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { autenticar, exigirGestion, exigirRoles } from '../src/middleware/autenticacion';
import type { UsuarioAutenticado } from '../src/types/autenticacion.types';

interface RespuestaHTTP {
  status: number;
  body: { ok?: boolean; message?: string; usuario?: UsuarioAutenticado; rol?: string };
}
interface ConsultaIdentidad { token: string; nombre: string; argumentos: unknown[] }
interface OpcionesPeticion { token?: string; authorization?: string; body?: unknown; headers?: Record<string, string> }
type Peticion = (ruta: string, opciones?: OpcionesPeticion) => Promise<RespuestaHTTP>;
type Perfil = (token: string) => unknown;

const perfiles: Record<string, UsuarioAutenticado> = {
  gerente: { codusu: '1', uuidusu: '00000000-0000-0000-0000-000000000001', rol: 'Gerente' },
  administradora: { codusu: '2', uuidusu: '00000000-0000-0000-0000-000000000002', rol: 'Administradora' },
  vendedor: { codusu: '3', uuidusu: '00000000-0000-0000-0000-000000000003', rol: 'Vendedor' }
};

async function entorno(caso: (request: Peticion, consultas: ConsultaIdentidad[]) => Promise<void>, perfil: Perfil = token => perfiles[token] ?? null) {
  const consultas: ConsultaIdentidad[] = [];
  const app = express();
  app.use(express.json());
  const fabrica = (token: string) => ({
    auth: { getUser: async (recibido: string) => {
      assert.equal(recibido, token);
      if (token === 'invalido') return { data: { user: null }, error: { message: 'Token privado' } };
      // Los metadatos editables del usuario no son una fuente de permisos.
      return { data: { user: { id: perfiles[token]?.uuidusu ?? '00000000-0000-0000-0000-000000000004', user_metadata: { rol: 'Gerente', codusu: '1' } } }, error: null };
    } },
    rpc: async (nombre: string, ...argumentos: unknown[]) => {
      consultas.push({ token, nombre, argumentos });
      if (token === 'fallo-bd') return { data: null, error: { code: 'XX000', message: 'Datos SQL privados' } };
      return { data: perfil(token), error: null };
    }
  } as unknown as SupabaseClient);
  const responder: express.RequestHandler = (_req, res) => { res.json({ usuario: res.locals.usuario, rol: res.locals.rol }); };
  app.post('/sin-autenticar', exigirRoles('Gerente'), responder);
  app.use(autenticar(fabrica));
  app.post('/identidad', responder);
  app.post('/gestion', exigirGestion, responder);
  // Rutas exclusivas del fixture para probar combinaciones de la infraestructura.
  app.post('/solo-gerente', exigirRoles('Gerente'), responder);
  app.post('/lectura', exigirRoles('Gerente', 'Administradora', 'Vendedor'), responder);
  app.post('/ninguno', exigirRoles(), responder);
  const servidor = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => servidor.once('listening', resolve));
  const direccion = servidor.address();
  if (!direccion || typeof direccion === 'string') throw new Error('Puerto no disponible');
  const request: Peticion = async (ruta, opciones = {}) => {
    const authorization = opciones.authorization ?? (opciones.token ? `Bearer ${opciones.token}` : undefined);
    const res = await fetch(`http://127.0.0.1:${direccion.port}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}), ...opciones.headers },
      body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body)
    });
    return { status: res.status, body: await res.json() };
  };
  try { await caso(request, consultas); }
  finally { servidor.closeAllConnections(); await new Promise<void>(resolve => servidor.close(() => resolve())); }
}

test('HU007: token ausente, malformado o inválido responde 401 sin consultar perfil', async () => entorno(async (request, consultas) => {
  for (const authorization of [undefined, 'Basic abc', 'Bearer', 'Bearer a b', 'Bearer invalido'])
    assert.equal((await request('/gestion', { authorization })).status, 401);
  assert.equal(consultas.length, 0);
}));
test('HU007: cada rol activo obtiene identidad de BD; consulta sin parámetros del cliente', async () => entorno(async (request, consultas) => {
  for (const token of Object.keys(perfiles)) {
    const r = await request('/identidad', { token });
    assert.equal(r.status, 200); assert.deepEqual(r.body.usuario, perfiles[token]); assert.equal(r.body.rol, perfiles[token].rol);
  }
  assert.ok(consultas.every(c => c.nombre === 'hu007_usuario_actual' && c.argumentos.length === 0));
}));
test('HU007: usuario inexistente o perfil inactivo/no autorizado denegado', async () => entorno(async request => {
  for (const token of ['sin-perfil', 'usuario-inactivo', 'rol-inactivo', 'rol-desconocido'])
    assert.equal((await request('/gestion', { token })).status, 403);
}));
test('HU007: rechaza perfil con rol desconocido o UUID de otro usuario', async () => {
  for (const perfil of [
    { ...perfiles.gerente, rol: 'Superadmin' },
    { ...perfiles.gerente, uuidusu: perfiles.vendedor.uuidusu },
    { ...perfiles.gerente, codusu: '0' },
    { ...perfiles.gerente, codusu: '9223372036854775808' }
  ]) await entorno(async request => {
    assert.equal((await request('/gestion', { token: 'gerente' })).status, 403);
  }, () => perfil);
});
test('HU007: exigirGestion mantiene permisos y mensaje exacto', async () => entorno(async request => {
  for (const token of ['gerente', 'administradora']) assert.equal((await request('/gestion', { token })).status, 200);
  const r = await request('/gestion', { token: 'vendedor' });
  assert.equal(r.status, 403);
  assert.equal(r.body.message, 'Solo gerente y administradora pueden realizar esta operación de gestión');
}));
test('HU007: exigirRoles admite combinaciones y deniega por defecto', async () => entorno(async request => {
  for (const token of Object.keys(perfiles)) {
    assert.equal((await request('/lectura', { token })).status, 200);
    assert.equal((await request('/ninguno', { token })).status, 403);
    assert.equal((await request('/solo-gerente', { token })).status, token === 'gerente' ? 200 : 403);
  }
  assert.equal((await request('/sin-autenticar', { token: 'gerente' })).status, 403);
}));
test('HU007: body, query, cabeceras y metadata no conceden rol ni identidad', async () => entorno(async request => {
  const opciones: OpcionesPeticion = { token: 'vendedor', body: { rol: 'Gerente', codusu: '1', uuidusu: perfiles.gerente.uuidusu }, headers: { 'x-role': 'Gerente', 'x-codusu': '1' } };
  assert.equal((await request('/gestion?rol=Gerente&codusu=1', opciones)).status, 403);
  assert.deepEqual((await request('/identidad?rol=Gerente&codusu=1', opciones)).body.usuario, perfiles.vendedor);
}));
test('HU007: permisos se vuelven a consultar y no quedan almacenados entre peticiones', async () => {
  let activo = true;
  await entorno(async request => {
    assert.equal((await request('/gestion', { token: 'gerente' })).status, 200);
    activo = false;
    assert.equal((await request('/gestion', { token: 'gerente' })).status, 403);
  }, token => activo ? perfiles[token] : null);
});
test('HU007: peticiones simultáneas mantienen identidad propia', async () => entorno(async request => {
  const tokens = ['gerente', 'administradora', 'vendedor'];
  const respuestas = await Promise.all(tokens.map(token => request('/identidad', { token })));
  respuestas.forEach((r, i) => assert.deepEqual(r.body.usuario, perfiles[tokens[i]]));
}));
test('HU007: fallo de BD deniega sin revelar SQL ni secretos', async () => entorno(async request => {
  const r = await request('/gestion', { token: 'fallo-bd' });
  assert.equal(r.status, 500); assert.ok(!JSON.stringify(r.body).includes('privados'));
}));
