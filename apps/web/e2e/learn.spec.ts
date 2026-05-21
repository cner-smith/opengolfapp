import { test, expect } from '@playwright/test'

// Smoke for the #237 auth-aware Learn shell, signed-out branch.
// Signed-in cases live in a separate spec once the auth fixture is
// in place (needs a Supabase test account + saved storageState).
test.describe('Learn — signed out', () => {
  test('/learn renders PublicNav with "Sign up free" CTA', async ({ page }) => {
    await page.goto('/learn')
    await expect(
      page.getByRole('link', { name: /sign up free/i }),
    ).toBeVisible()
  })

  test('/learn renders without the authenticated app sidebar', async ({
    page,
  }) => {
    await page.goto('/learn')
    // Sidebar nav items only exist in AppShell. If any of these are
    // visible, we've regressed and signed-out users are inside the
    // auth shell.
    await expect(
      page.getByRole('link', { name: /^dashboard$/i }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: /^rounds$/i }),
    ).toHaveCount(0)
  })
})
