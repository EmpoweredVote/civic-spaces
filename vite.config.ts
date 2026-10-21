import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Local dev reads the LIVE public ev-accounts API (officials, elections,
// meetings, compass topics) through a same-origin `/api` proxy, so a fresh
// clone shows real public data with no keys. The browser cannot call the API
// directly from localhost (no CORS header), and the API rejects a disallowed
// Origin, so the proxy strips it. Signed out, it reaches only what any visitor
// reaches. Forum content (posts, replies, slices) is members-only and stays on
// the fixtures in src/lib/devMockData.ts. Running ev-accounts locally? Set
// VITE_API_PROXY_TARGET=http://localhost:3000. Dev only.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_PROXY_TARGET || 'https://accounts-api.empowered.vote',
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
          },
        },
      },
    },
  }
})
