import { test, expect } from '@playwright/test'

// TEMPORARY verification of the Google OAuth wiring (#859/#866).
test.describe('Google sign-in wiring', () => {
  for (const path of ['/login', '/signup']) {
    test(`button renders on ${path}`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
    })
  }

  test('clicking it reaches Google with our client + an allow-listed return URL', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await page.waitForURL(/accounts\.google\.com/, { timeout: 20_000 })
    const url = page.url()
    console.log('LANDED ON:', url.slice(0, 80))
    expect(url).toContain('accounts.google.com')
    // Supabase silently swaps redirect_to for Site URL when it is NOT
    // allow-listed, so its survival here proves localhost is allow-listed.
    // Google nests this several encodings deep; decode until it stops changing
    // rather than guessing a fixed number of passes.
    let decoded = url
    for (let i = 0; i < 6; i++) {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    }
    expect(decoded).toContain(`client_id=594879721243-`)
    expect(decoded).toContain('redirect_uri=https://txquvfeyvkaetqlamqlz.supabase.co/auth/v1/callback')
    expect(decoded).toContain('scope=email+profile')
    // Supabase silently swaps redirect_to for Site URL when it is NOT
    // allow-listed, so its survival proves localhost IS allow-listed.
    expect(decoded).toContain('localhost:5173/auth/callback')
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
