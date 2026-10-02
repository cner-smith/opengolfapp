import { defineConfig } from 'vitest/config'

// Run the suite west of Greenwich. Date-only parsing bugs (#914) are
// invisible in UTC, which is where CI runs; set here, before the workers
// start — assigning it inside a test file does not reach a worker thread.
process.env.TZ = 'America/Chicago'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
