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
        // bundle isn't dragged down by Recharts (~400 KB) and Mapbox
        // (only loaded by the round map, which is itself lazy). Routes
        // that don't use Recharts (dashboard, rounds list, settings)
        // skip its chunk entirely.
        manualChunks: {
          recharts: ['recharts'],
          mapbox: ['mapbox-gl'],
          core: ['@oga/core'],
        },
      },
    },
  },
})
