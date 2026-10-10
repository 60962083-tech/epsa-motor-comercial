/* global __EPSA_API_URL__, __EPSA_SUPABASE_URL__, __EPSA_SUPABASE_ANON_KEY__ */
// Configuración de conexión (vite.config.js la arma y solo expone estas tres al navegador).
// La API (https://epsa-motor-api.onrender.com) y la URL de Supabase ya vienen puestas.
// La clave anon de Supabase sale de las variables de Netlify, de frontend/.env o del .env de la raíz del repositorio.
// Sin la clave, la web funciona en MODO DEMOSTRACIÓN con datos locales.
const limpiar = (v) => (v ? String(v).trim().replace(/\/$/, "") : "");

export const API_URL = limpiar(typeof __EPSA_API_URL__ !== "undefined" ? __EPSA_API_URL__ : "");
export const SUPABASE_URL = limpiar(typeof __EPSA_SUPABASE_URL__ !== "undefined" ? __EPSA_SUPABASE_URL__ : "");
export const SUPABASE_ANON_KEY = limpiar(typeof __EPSA_SUPABASE_ANON_KEY__ !== "undefined" ? __EPSA_SUPABASE_ANON_KEY__ : "");

export const MODO_REAL = Boolean(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
export const WHATSAPP_NUMERO = "51907721481";
