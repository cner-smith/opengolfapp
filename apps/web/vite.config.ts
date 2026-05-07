import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
})
