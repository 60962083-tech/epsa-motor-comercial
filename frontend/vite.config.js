// Configuración de Vite y conexión con la API
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// API de Michelle (Render) y proyecto de Supabase
const API_EPSA = 'https://epsa-motor-api.onrender.com'
const SUPABASE_EPSA = 'https://scydgghoucqlnpyxlczg.supabase.co'

// Una dirección localhost solo se usa con EPSA_API_LOCAL=1
const esLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(u)

// La clave service_role nunca llega al navegador
function esClaveSecreta(clave) {
  if (/^sb_secret_/i.test(clave)) return true
  try { return JSON.parse(Buffer.from(clave.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { return false }
}

export default defineConfig(({ mode }) => {
  // .env del frontend o de la raíz; las variables de Netlify mandan
  const env = { ...loadEnv(mode, resolve(process.cwd(), '..'), ''), ...loadEnv(mode, process.cwd(), '') }
  const demo = env.EPSA_DEMO === '1'
  const valor = (...claves) => {
    if (demo) return ''
    for (const k of claves) if (env[k] !== undefined && String(env[k]).trim() !== '') return String(env[k]).trim()
    return ''
  }
  const direccion = (porDefecto, ...claves) => {
    if (demo) return ''
    const v = valor(...claves)
    return v && (!esLocal(v) || env.EPSA_API_LOCAL === '1') ? v : porDefecto
  }
  let clave = valor('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')
  if (clave && esClaveSecreta(clave)) {
    console.warn('\n[EPSA] SUPABASE_ANON_KEY tiene una clave service_role (secreta): no se usa. Pon la clave «anon». La web queda en modo demostración.\n')
    clave = ''
  }
  // Lo único que llega al navegador
  return {
    plugins: [react()],
    define: {
      __EPSA_API_URL__: JSON.stringify(direccion(API_EPSA, 'VITE_API_URL', 'API_URL')),
      __EPSA_SUPABASE_URL__: JSON.stringify(direccion(SUPABASE_EPSA, 'VITE_SUPABASE_URL', 'SUPABASE_URL')),
      __EPSA_SUPABASE_ANON_KEY__: JSON.stringify(clave),
    },
  }
})
