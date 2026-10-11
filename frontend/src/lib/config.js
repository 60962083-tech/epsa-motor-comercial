/* global __EPSA_API_URL__, __EPSA_SUPABASE_URL__, __EPSA_SUPABASE_ANON_KEY__ */
// Conexión: API y Supabase (vienen de vite.config.js)
const limpiar = (v) => (v ? String(v).trim().replace(/\/$/, "") : "");

export const API_URL = limpiar(typeof __EPSA_API_URL__ !== "undefined" ? __EPSA_API_URL__ : "");
export const SUPABASE_URL = limpiar(typeof __EPSA_SUPABASE_URL__ !== "undefined" ? __EPSA_SUPABASE_URL__ : "");
export const SUPABASE_ANON_KEY = limpiar(typeof __EPSA_SUPABASE_ANON_KEY__ !== "undefined" ? __EPSA_SUPABASE_ANON_KEY__ : "");

export const MODO_REAL = Boolean(API_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
// WhatsApp de la empresa
export const WHATSAPP_NUMERO = "51907721481";
