/* global __EPSA_API_URL__, __EPSA_SUPABASE_URL__, __EPSA_SUPABASE_ANON_KEY__ */
// Configuración de conexión. Se define en frontend/.env (ver .env.example) o en las variables de Netlify.
// Acepta los nombres de la API de Michelle (SUPABASE_URL, SUPABASE_ANON_KEY) o con VITE_ delante:
// vite.config.js los lee y solo expone estas tres al navegador.
// Si falta cualquiera de las tres, la web funciona en MODO DEMOSTRACIÓN con datos locales.
const limpiar = (v) => (v ? String(v).trim().replace(/\/$/, "") : "");

export const API_URL = limpiar(typeof __EPSA_API_URL__ !== "undefined" ? __EPSA_API_URL__ : "");
export const SUPABASE_URL = limpiar(typeof __EPSA_SUPABASE_URL__ !== "undefined" ? __EPSA_SUPABASE_URL__ : "");
export const SUPABASE_ANON_KEY = limpiar(typeof __EPSA_SUPABASE_ANON_KEY__ !== "undefined" ? __EPSA_SUPABASE_ANON_KEY__ : "");

export const MODO_REAL = Boolean(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
export const WHATSAPP_NUMERO = "51907721481";
