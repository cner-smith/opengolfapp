import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// .env.test.local holds the Playwright Supabase creds + URL/anon key.
// Gitignored at the repo root via .env.*.local. Without it, the auth
// setup project skips and signed-in specs are skipped too.
dotenv.config({ path: '.env.test.local' })

// E2E config for the web app. `webServer` auto-starts Vite and reuses
// an existing instance on 5173 so local iteration doesn't pay the boot
// cost every run.
//
// Projects:
//   setup         — runs *.setup.ts (Supabase sign-in → writes storageState)
//   chromium      — *.spec.ts (signed-out)
//   chromium-auth — *.signed-in.spec.ts (uses storageState from setup)
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts$/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.signed-in\.spec\.ts$/,
    },
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.signed-in\.spec\.ts$/,
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
