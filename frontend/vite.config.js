import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Conexión con el backend de Michelle.
// Se aceptan los mismos nombres que usa su API (SUPABASE_URL, SUPABASE_ANON_KEY) o los de Vite (VITE_…).
// Solo estas tres variables llegan al navegador; cualquier otra del .env (por ejemplo una service_role) nunca se publica.
// EPSA_DEMO=1 fuerza el modo demostración aunque exista un .env.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const demo = env.EPSA_DEMO === '1'
  const valor = (...claves) => {
    if (demo) return ''
    for (const k of claves) if (env[k] !== undefined && String(env[k]).trim() !== '') return String(env[k]).trim()
    return ''
  }
  return {
    plugins: [react()],
    define: {
      __EPSA_API_URL__: JSON.stringify(valor('VITE_API_URL', 'API_URL')),
      __EPSA_SUPABASE_URL__: JSON.stringify(valor('VITE_SUPABASE_URL', 'SUPABASE_URL')),
      __EPSA_SUPABASE_ANON_KEY__: JSON.stringify(valor('VITE_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')),
    },
  }
})
