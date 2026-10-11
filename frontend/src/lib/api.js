// Conexión con la API de Michelle y Supabase
import { API_URL, SUPABASE_URL, SUPABASE_ANON_KEY, MODO_REAL } from "./config";
import { ApiError } from "./errores";

// Sesión guardada
const CLAVE = "epsa-sesion";

export function leerSesion() {
  try { return JSON.parse(sessionStorage.getItem(CLAVE)); } catch { return null; }
}
function guardarSesion(s) {
  try { if (s) sessionStorage.setItem(CLAVE, JSON.stringify(s)); else sessionStorage.removeItem(CLAVE); } catch {}
}
export const cerrarSesionApi = () => guardarSesion(null);

// HU-007 · Login con Supabase Auth
async function authFetch(grant, cuerpo) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=${grant}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(cuerpo),
    });
  } catch { throw new ApiError(0, "No se pudo conectar. Revisa tu internet e inténtalo de nuevo."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 400 || r.status === 401) throw new ApiError(401, grant === "password" ? "Correo o contraseña incorrectos." : "Tu sesión venció. Vuelve a iniciar sesión.");
    throw new ApiError(r.status, j.error_description || j.msg || "No se pudo iniciar sesión.");
  }
  return j;
}

export async function iniciarSesion(correo, clave) {
  const j = await authFetch("password", { email: correo, password: clave });
  const sesion = { access_token: j.access_token, refresh_token: j.refresh_token };
  guardarSesion(sesion);
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/hu007_usuario_actual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${j.access_token}` },
    body: JSON.stringify({}),
  }).catch(() => { throw new ApiError(0, "No se pudo conectar. Revisa tu internet e inténtalo de nuevo."); });
  const d = await r.json().catch(() => null);
  const u = Array.isArray(d) ? d[0] : d;
  if (!r.ok || !u?.rol) { guardarSesion(null); throw new ApiError(403, "Tu usuario no tiene un rol activo en EPSA Motor."); }
  const meta = j.user?.user_metadata || {};
  const local = correo.split("@")[0];
  const nombre = meta.nombre || (/^\d+$/.test(local) ? local : local.replace(/[._-]+/g, " ").replace(/(^|\s)(\p{L})/gu, (_, e, l) => e + l.toUpperCase()));
  return { nombre, rol: String(u.rol).toLowerCase(), codusu: u.codusu, claveTemporal: meta.clave_temporal === true };
}

// Lectura de tablas de Supabase
async function leerTabla(ruta, error, reintento = true) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${leerSesion()?.access_token || ""}` },
    });
  } catch { throw new ApiError(0, "No se pudo conectar. Revisa tu internet e inténtalo de nuevo."); }
  if (r.status === 401 && reintento) {
    try { await refrescar(); return leerTabla(ruta, error, false); } catch {}
  }
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new ApiError(r.status, j?.message || error);
  return j;
}

export const listarUsuariosSupabase = () =>
  leerTabla("usuario?select=codusu,nomusu,apepatusu,apematusu,corusu,estusu,rol(nomrol)&order=codusu", "No se pudo cargar la lista de usuarios.");

export const listarCanalesWhatsapp = () =>
  leerTabla("canalwhatsapp?select=codcwa,nomcwa,numcwa,estcwa&order=codcwa", "No se pudo cargar el WhatsApp de la empresa.");

// Cambiar contraseña
export async function cambiarClaveApi(nueva) {
  let r;
  try {
    r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${leerSesion()?.access_token || ""}` },
      body: JSON.stringify({ password: nueva, data: { clave_temporal: false } }),
    });
  } catch { throw new ApiError(0, "No se pudo conectar. Revisa tu internet e inténtalo de nuevo."); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(r.status, j.msg || j.error_description || "No se pudo cambiar la contraseña.");
  return true;
}

// Renovar la sesión
async function refrescar() {
  const s = leerSesion();
  if (!s?.refresh_token) throw new ApiError(401, "Sesión vencida");
  const j = await authFetch("refresh_token", { refresh_token: s.refresh_token });
  guardarSesion({ access_token: j.access_token, refresh_token: j.refresh_token });
}

// Petición a la API
export async function pedir(ruta, { metodo = "GET", cuerpo, formulario, headers = {}, privada = true } = {}, reintento = true) {
  if (!MODO_REAL) throw new ApiError(0, "Esta función necesita conexión.");
  const h = { ...headers };
  if (cuerpo !== undefined) h["Content-Type"] = "application/json";
  if (privada) h.Authorization = `Bearer ${leerSesion()?.access_token || ""}`;
  const body = formulario || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined);
  let r;
  try {
    r = await fetch(`${API_URL}${ruta}`, body === undefined ? { method: metodo, headers: h } : { method: metodo, headers: h, body });
  } catch { throw new ApiError(0, "No se pudo conectar. Si es la primera consulta del día, espera un minuto y vuelve a intentar."); }
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && privada && reintento) {
    try { await refrescar(); return pedir(ruta, { metodo, cuerpo, formulario, headers, privada }, false); } catch {}
  }
  if (!r.ok || j.ok === false) throw new ApiError(r.status, j.message || "Error", j);
  return { data: j.data, message: j.message, status: r.status };
}

// HU-012 · Modelos publicados
export const modelosPublicos = () => pedir("/api/modelos", { privada: false });
// HU-010 · Sedes
export const sedesPublicasApi = () => pedir("/api/sedes", { privada: false });
// HU-014 · Registrar interesado
export const registrarLeadApi = (b) => pedir("/api/leads", { metodo: "POST", cuerpo: b });

// HU-026 · Ubicaciones
export const listarUbicaciones = (activo) => pedir(`/api/ubicaciones${activo === undefined ? "" : `?activo=${activo}`}`);
export const crearUbicacion = (b) => pedir("/api/ubicaciones", { metodo: "POST", cuerpo: b });
export const editarUbicacion = (id, b) => pedir(`/api/ubicaciones/${id}`, { metodo: "PUT", cuerpo: b });
export const estadoUbicacion = (id, estubi) => pedir(`/api/ubicaciones/${id}/estado`, { metodo: "PATCH", cuerpo: { estubi } });

// HU-034 · Compras
export const listarCompras = (limite = 50, offset = 0) => pedir(`/api/compras?limite=${limite}&offset=${offset}`);
export const obtenerCompra = (id) => pedir(`/api/compras/${id}`);
export const crearCompra = (b, idempotencia) => pedir("/api/compras", { metodo: "POST", cuerpo: b, headers: { "Idempotency-Key": idempotencia } });

// HU-002 · Factura, PDF e identificación
export const registrarFactura = (id, b) => pedir(`/api/compras/${id}/factura`, { metodo: "PUT", cuerpo: b });
export const subirPdfFacturaApi = (id, archivo) => {
  const fd = new FormData();
  fd.append("archivo", archivo instanceof File && archivo.type === "application/pdf" ? archivo : new File([archivo], archivo.name || "factura.pdf", { type: "application/pdf" }));
  return pedir(`/api/compras/${id}/factura/archivo`, { metodo: "POST", formulario: fd });
};
export const consultarPdfFacturaApi = (id) => pedir(`/api/compras/${id}/factura/archivo`);
export const urlPdfFacturaApi = (id) => pedir(`/api/compras/${id}/factura/archivo/url`);
// HU-004 · Techo de la unidad
export const tiposTechoApi = () => pedir("/api/unidades/catalogos/tipos-techo");
export const proveedoresTechoApi = () => pedir("/api/unidades/catalogos/proveedores-techo");
export const techoUnidadApi = (coduni) => pedir(`/api/unidades/${coduni}/techo`);
export const guardarTechoUnidadApi = (coduni, b) => pedir(`/api/unidades/${coduni}/techo`, { metodo: "PUT", cuerpo: b });
// HU-009 · Ficha de un modelo
export const modeloPublicadoApi = (codmod) => pedir(`/api/modelos/${codmod}`, { privada: false });
export const listarUnidadesCompra = (id) => pedir(`/api/compras/${id}/unidades`);
export const vincularUnidades = (id, unidades) => pedir(`/api/compras/${id}/unidades`, { metodo: "POST", cuerpo: { unidades } });
