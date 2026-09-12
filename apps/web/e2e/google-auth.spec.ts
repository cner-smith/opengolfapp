import { test, expect } from '@playwright/test'

// Regression guard for the Google sign-in wiring (#859/#866) and for the
// #509 failure mode, where a callback with no usable code sat on
// "Signing you in…" forever instead of failing.
//
// These assert the *shape* of the wiring rather than one project's literal
// config — client id, Supabase URL and app origin all come from the
// environment — so the suite runs against a self-hosted deployment, not
// only the maintainer's project. The network-dependent test below hits
// live accounts.google.com and the live Supabase project, which is fine
// while e2e is local-only; it would need to be made hermetic before
// moving into CI.
test.describe('Google sign-in wiring', () => {
  for (const path of ['/login', '/signup']) {
    test(`button renders on ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    })
  }

  test('clicking it reaches Google with our client + an allow-listed return URL', async ({
    page,
    baseURL,
  }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 })

    const authorizeUrl = new URL(page.url())
    expect(authorizeUrl.hostname).toBe('accounts.google.com')

    // Whatever Google client this Supabase project is configured with —
    // assert it is present and well-formed, not that it is one specific
    // project's.
    const clientId = authorizeUrl.searchParams.get('client_id')
    expect(clientId, 'no client_id on the Google authorize URL').toBeTruthy()
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/)

    // Google must hand the code back to *our* Supabase project.
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    expect(supabaseUrl, 'VITE_SUPABASE_URL must be set (apps/web/.env.test.local)').toBeTruthy()
    expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
      `${supabaseUrl!.replace(/\/$/, '')}/auth/v1/callback`,
    )

    const scope = authorizeUrl.searchParams.get('scope') ?? ''
    expect(scope).toContain('email')
    expect(scope).toContain('profile')

    // Supabase silently swaps redirect_to for the project's Site URL when the
    // value is NOT allow-listed, so our own origin surviving here proves it IS
    // allow-listed. Google nests this several encodings deep; decode until it
    // stops changing rather than guessing a fixed number of passes.
    let decoded = page.url()
    for (let i = 0; i < 6; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
    expect(decoded).toContain(`${baseURL}/auth/callback`)
  })

  test('callback with no code fails fast instead of hanging', async ({ page }) => {
    await page.goto('/auth/callback')
    await expect(page.getByRole('heading', { name: 'Sign-in failed' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/Missing sign-in code/i)).toBeVisible()
    await expect(page.getByText('Signing you in…')).toHaveCount(0)
  })

  test('callback with a bogus code fails fast instead of hanging', async ({ page }) => {
    await page.goto('/auth/callback?code=not-a-real-pkce-code')
    // The #509 failure mode was sitting on "Signing you in…" forever.
    await expect(page.getByRole('heading', { name: 'Sign-in failed' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('link', { name: /Back to sign in/i })).toBeVisible()
  })
})
