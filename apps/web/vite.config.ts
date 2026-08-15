import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { devCourseApi } from './vite-plugins/dev-course-api'

// index.html's CSP meta tag ships to production, so its connect-src only
// allowlists prod hosts (*.supabase.co etc) — it has no reason to know
// about a dev's local Supabase stack. `apply: 'serve'` scopes this to
// `vite dev` only, so `vite build` emits the unmodified, production CSP.
// Without this, sign-in against a local Supabase instance fails outright
// ("Failed to fetch") since the browser blocks the disallowed connect-src.
function devCsp(): Plugin {
  return {
    name: 'dev-csp-local-supabase',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(
        "connect-src 'self'",
        "connect-src 'self' http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*",
      )
    },
  }
}

export default defineConfig(({ mode }) => {
  // devCourseApi (dev-only Course Editor backend) needs the service-role key
  // server-side. It's intentionally not VITE_-prefixed so Vite never bundles
  // it into client code — which also means it isn't auto-populated onto
  // process.env the way VITE_* vars are onto import.meta.env, so load it
  // explicitly here (empty prefix = load all vars, not just VITE_*).
  const env = loadEnv(mode, process.cwd(), '')
  process.env.SUPABASE_URL ??= env.SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SUPABASE_SERVICE_ROLE_KEY

  return {
    plugins: [react(), devCsp(), devCourseApi()],
    server: {
      port: 5173,
    },
    build: {
      rollupOptions: {
        output: {
          // Split the heaviest deps into their own chunks so the initial
          // bundle isn't dragged down by Recharts (~150 KB gzip) and
          // Mapbox (~490 KB gzip). Routes that don't use Recharts
          // (dashboard's static path, rounds list, settings) skip its
          // chunk entirely.
          manualChunks: {
            recharts: ['recharts'],
            mapbox: ['mapbox-gl'],
            core: ['@oga/core'],
          },
        },
      },
      // Strip recharts from the entry chunk's modulepreload list —
      // SGTrendChart on the dashboard and the StrokesGainedSection on
      // the lazy /stats route both go through dynamic imports, so the
      // chunk should download lazily. Vite's default preloads it
      // alongside index.js, putting the bytes back on the first-paint
      // path. Same treatment for mapbox so its ~490 KB gzip chunk only
      // hits the wire when the round-map route mounts.
      modulePreload: {
        resolveDependencies: (_filename, deps) =>
          deps.filter((d) => !d.includes('recharts') && !d.includes('mapbox')),
      },
    },
  }
})
