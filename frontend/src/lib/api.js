import { API_URL, SUPABASE_URL, SUPABASE_ANON_KEY, MODO_REAL } from "./config";
import { ApiError } from "./errores";

const CLAVE = "epsa-sesion";

export function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE)); } catch { return null; }
}
function guardarSesion(s) {
  try { if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s)); else sessionStorage.removeItem(CLAVE); } catch { /* sin storage */ }
}
export const cerrarSesionApi = () => guardarSesion(null);

async function authFetch(grant, cuerpo) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(cuerpo),
    });
  } catch { throw new ApiError(0, "Sin conexión con Supabase"); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status === 400 ? 401 : r.status, j.error_description || j.msg || "Credenciales inválidas");
  return j;
}

/** Login real: Supabase Auth (password grant) + rol desde hu007_usuario_actual(). */
export async function iniciarSesion(correo, clave) {
  const j = await authFetch("password", { email: correo, password: clave });
  const sesion = { access_token: j.access_token, refresh_token: j.refresh_token };
  guardarSesion(sesion);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hu007_usuario_actual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${j.access_token}` },
    body: JSON.stringify({}),
  }).catch(() => { throw new ApiError(0, "Sin conexión con Supabase"); });
  const d = await r.json().catch(() => null);
  const u = Array.isArray(d) ? d[0] : d;
  if (!r.ok || !u?.rol) { guardarSesion(null); throw new ApiError(403, "Tu usuario no tiene un rol activo en EPSA Motor."); }
  return { nombre: correo.split("@")[0], rol: String(u.rol).toLowerCase(), codusu: u.codusu };
}

async function refrescar() {
  const s = leerSesion();
  if (!s?.refresh_token) throw new ApiError(401, "Sesión vencida");
  const j = await authFetch("refresh_token", { refresh_token: s.refresh_token });
  guardarSesion({ access_token: j.access_token, refresh_token: j.refresh_token });
}

/** Petición al backend de Michelle. Devuelve `data` ({ok,data,message}). */
export async function pedir(ruta, { metodo = "GET", cuerpo, headers = {}, privada = true } = {}, reintento = true) {
  if (!MODO_REAL) throw new ApiError(0, "Modo demostración: backend no configurado");
  const h = { ...headers };
  if (cuerpo !== undefined) h["Content-Type"] = "application/json";
  if (privada) h.Authorization = `Bearer ${leerSesion()?.access_token || ""}`;
  let r;
  try {
    r = await fetch(`${API_URL}${ruta}`, { method: metodo, headers: h, body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined });
  } catch { throw new ApiError(0, "Sin conexión con el servidor"); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && privada && reintento) {
    try { await refrescar(); return pedir(ruta, { metodo, cuerpo, headers, privada }, false); } catch { /* cae al error */ }
  }
  if (!r.ok || j.ok === false) throw new ApiError(r.status, j.message || "Error", j);
  return { data: j.data, message: j.message, status: r.status };
}

// ---------- Endpoints (contratos de HU-012, HU-026, HU-034, HU-002) ----------
export const modelosPublicos = () => pedir("/api/modelos", { privada: false });

export const listarUbicaciones = (activo) => pedir(`/api/ubicaciones${activo === undefined ? "" : `?activo=${activo}`}`);
export const crearUbicacion = (b) => pedir("/api/ubicaciones", { metodo: "POST", cuerpo: b });
export const editarUbicacion = (id, b) => pedir(`/api/ubicaciones/${id}`, { metodo: "PUT", cuerpo: b });
export const estadoUbicacion = (id, estubi) => pedir(`/api/ubicaciones/${id}/estado`, { metodo: "PATCH", cuerpo: { estubi } });

export const listarCompras = (limite = 50, offset = 0) => pedir(`/api/compras?limite=${limite}&offset=${offset}`);
export const obtenerCompra = (id) => pedir(`/api/compras/${id}`);
export const crearCompra = (b, idempotencia) => pedir("/api/compras", { metodo: "POST", cuerpo: b, headers: { "Idempotency-Key": idempotencia } });

export const registrarFactura = (id, b) => pedir(`/api/compras/${id}/factura`, { metodo: "PUT", cuerpo: b });
export const listarUnidadesCompra = (id) => pedir(`/api/compras/${id}/unidades`);
export const vincularUnidades = (id, unidades) => pedir(`/api/compras/${id}/unidades`, { metodo: "POST", cuerpo: { unidades } });
