import { test, expect } from '@playwright/test'

// Signed-in smoke for the #237 auth-aware Learn shell. Authentication
// state is loaded from e2e/.auth/user.json (written by auth.setup.ts).
test.describe('Learn — signed in', () => {
  test('/learn renders AppShell with sidebar nav', async ({ page }) => {
    await page.goto('/learn')
    // The sidebar's hamburger only renders on mobile widths; on desktop
    // (default Playwright viewport ~1280px), Sidebar is mounted directly
    // and its top-level destinations are visible. "Home" is the
    // first authed-only link and is unique to AppShell.
    await expect(
      page.getByRole('link', { name: /^home$/i }).first(),
    ).toBeVisible()
  })

  test('/learn hides the public "Create account" CTA', async ({ page }) => {
    await page.goto('/learn')
    // PublicNav is gone for authed users on /learn, so its sign-up CTA
    // should not be in the DOM. (Authed PublicNav swaps to "Go to app"
    // on other public routes, but PublicNav itself isn't rendered here.)
    await expect(
      page.getByRole('link', { name: /^create account$/i }),
    ).toHaveCount(0)
  })

  // #1258: signed in, AppShell's <main> is the scroll container, so the
  // window-based ScrollRestoration can't reset it; AppShell does on a new path.
  test('a new guide opens with main scrolled to the top', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/learn/glossary')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const main = page.locator('main')
    await main.evaluate((el) => el.scrollTo(0, el.scrollHeight))
    expect(await main.evaluate((el) => el.scrollTop)).toBeGreaterThan(2000)
    await page.getByRole('link', { name: /Previous/ }).click()
    await expect(page).not.toHaveURL(/glossary/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => main.evaluate((el) => el.scrollTop)).toBeLessThan(10)
  })
})
