// Configuración de conexión. Se define en frontend/.env (ver .env.example).
// Si falta cualquiera de las tres variables, la web funciona en MODO DEMOSTRACIÓN
// con datos locales (útil para Netlify / presentaciones sin backend publicado).
const limpiar = (v) => (v ? String(v).trim().replace(/\/$/, "") : "");

export const API_URL = limpiar(import.meta.env.VITE_API_URL);
export const SUPABASE_URL = limpiar(import.meta.env.VITE_SUPABASE_URL);
export const SUPABASE_ANON_KEY = limpiar(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const MODO_REAL = Boolean(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
export const WHATSAPP_NUMERO = "51907721481";
