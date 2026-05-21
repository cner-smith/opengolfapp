import { test, expect } from '@playwright/test'

// Signed-in smoke for the #237 auth-aware Learn shell. Authentication
// state is loaded from e2e/.auth/user.json (written by auth.setup.ts).
test.describe('Learn — signed in', () => {
  test('/learn renders AppShell with sidebar nav', async ({ page }) => {
    await page.goto('/learn')
    // The sidebar's hamburger only renders on mobile widths; on desktop
    // (default Playwright viewport ~1280px), Sidebar is mounted directly
    // and its top-level destinations are visible. "Dashboard" is the
    // first authed-only link and is unique to AppShell.
    await expect(
      page.getByRole('link', { name: /^dashboard$/i }).first(),
    ).toBeVisible()
  })

  test('/learn hides the public "Sign up free" CTA', async ({ page }) => {
    await page.goto('/learn')
    // PublicNav is gone for authed users on /learn, so its sign-up CTA
    // should not be in the DOM. (Authed PublicNav swaps to "Go to app"
    // on other public routes, but PublicNav itself isn't rendered here.)
    await expect(
      page.getByRole('link', { name: /sign up free/i }),
    ).toHaveCount(0)
  })
})
