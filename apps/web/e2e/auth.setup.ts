import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// One-time sign-in for signed-in specs. Calls auth.signInWithPassword
// server-side (bypasses the Turnstile widget, which only fires in the
// browser), then injects the resulting session into the browser's
// localStorage under supabase-js's default key shape and snapshots
// the storage state to e2e/.auth/user.json.
//
// Subsequent specs in the chromium-auth project load that snapshot via
// `storageState`, so each test starts pre-authenticated without
// re-running this login.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY
const E2E_EMAIL = process.env.E2E_EMAIL
const E2E_PASSWORD = process.env.E2E_PASSWORD

setup('authenticate', async ({ page }) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !E2E_EMAIL || !E2E_PASSWORD) {
    throw new Error(
      'Missing Supabase or e2e creds. Expected VITE_SUPABASE_URL, ' +
        'VITE_SUPABASE_ANON_KEY, E2E_EMAIL, E2E_PASSWORD in ' +
        '.env.test.local at apps/web/.',
    )
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  })
  if (error) throw error
  if (!data.session) throw new Error('signInWithPassword returned no session')

  const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  // localStorage is per-origin, so we have to be on the app's origin
  // before setting it. Landing page is fine and doesn't require auth.
  await page.goto('/')
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, value)
    },
    { key: storageKey, value: JSON.stringify(data.session) },
  )

  await page.context().storageState({ path: 'e2e/.auth/user.json' })
})
