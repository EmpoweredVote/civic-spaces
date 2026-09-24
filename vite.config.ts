import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildQuery, createNewsCache, type Level } from './supabase/functions/news-proxy/gnews.ts'

/**
 * `npm run dev` only: serves POST /__dev/news-proxy, the same contract as the deployed
 * news-proxy edge function, from the same gnews.ts — so a local preview shows real
 * headlines before (or without) the function being deployed.
 *
 * The key is GNEWS_API_KEY in .env.local, deliberately WITHOUT the VITE_ prefix: only
 * VITE_ variables reach the browser bundle, so this one stays on the dev machine. With
 * no key the route answers 503, and the widget shows its "not available" state.
 */
function devNewsProxy(apiKey: string | undefined): Plugin {
  const cachedSearch = createNewsCache(30 * 60 * 1000)
  return {
    name: 'civic-spaces-dev-news-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__dev/news-proxy', (req, res) => {
        const send = (status: number, body: unknown) => {
          res.statusCode = status
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(body))
        }
        if (req.method !== 'POST') return send(405, { error: 'POST only' })
        if (!apiKey) return send(503, { error: 'GNEWS_API_KEY is not set in .env.local', articles: [] })

        let raw = ''
        req.on('data', (chunk) => { raw += chunk })
        req.on('end', async () => {
          try {
            const { level, location, state } = JSON.parse(raw || '{}') as { level?: Level; location?: string; state?: string | null }
            if (!level || !location) return send(400, { error: 'level and location are required', articles: [] })
            const query = buildQuery(level, location, state ?? null)
            if (!query) return send(200, { articles: [] })
            send(200, { articles: await cachedSearch(apiKey, query) })
          } catch (err) {
            send(502, { error: String(err), articles: [] })
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // '' prefix loads every variable, including the unprefixed server-only GNEWS_API_KEY.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devNewsProxy(env.GNEWS_API_KEY)],
  }
})
