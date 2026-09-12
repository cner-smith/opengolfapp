import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // vite-plugins/ is outside src/ but holds the dev-only API plugins; the
    // loopback guard there is security-critical parsing and is unit-tested.
    include: ['src/**/*.test.ts', 'vite-plugins/**/*.test.ts'],
  },
})
