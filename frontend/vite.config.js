import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Conexión con el backend de Michelle.
// Las dos direcciones ya vienen puestas (no son secretas): la API publicada en Render y el proyecto de Supabase.
// Solo la clave anon de Supabase va aparte. Se toma, en este orden, de:
//   1) las variables de Netlify (o del sistema),
//   2) frontend/.env,
//   3) el .env de la raíz del repositorio (el de la API de Michelle: SUPABASE_URL, SUPABASE_ANON_KEY, PORT).
// Ningún .env se sube a GitHub. Solo estas tres variables llegan al navegador; cualquier otra (por ejemplo PORT o
// una service_role) nunca se publica. EPSA_DEMO=1 fuerza el modo demostración.
const API_EPSA = 'https://epsa-motor-api.onrender.com'
const SUPABASE_EPSA = 'https://scydgghoucqlnpyxlczg.supabase.co'

// Una dirección «localhost» (por ejemplo un .env antiguo con http://localhost:3000) no sirve en Netlify ni sin la API
// corriendo en tu computadora: se ignora y se usa la de Render. Para probar la API de Michelle en local: EPSA_API_LOCAL=1.
const esLocal = (u) => /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(u)

// La clave service_role nunca debe llegar al navegador: si alguien la pone por error, se ignora.
function esClaveSecreta(clave) {
  if (/^sb_secret_/i.test(clave)) return true
  try { return JSON.parse(Buffer.from(clave.split('.')[1], 'base64url').toString()).role === 'service_role' } catch { return false }
}

export default defineConfig(({ mode }) => {
  // El .env del frontend manda sobre el de la raíz; las variables del sistema (Netlify) mandan sobre ambos
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
  return {
    plugins: [react()],
    define: {
      __EPSA_API_URL__: JSON.stringify(direccion(API_EPSA, 'VITE_API_URL', 'API_URL')),
      __EPSA_SUPABASE_URL__: JSON.stringify(direccion(SUPABASE_EPSA, 'VITE_SUPABASE_URL', 'SUPABASE_URL')),
      __EPSA_SUPABASE_ANON_KEY__: JSON.stringify(clave),
    },
  }
})
