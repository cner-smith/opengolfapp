import { test, expect } from '@playwright/test'

// Smoke for the #237 auth-aware Learn shell, signed-out branch.
// Signed-in cases live in a separate spec once the auth fixture is
// in place (needs a Supabase test account + saved storageState).
test.describe('Learn — signed out', () => {
  test('/learn renders PublicNav with "Create account" CTA', async ({ page }) => {
    await page.goto('/learn')
    await expect(
      page.getByRole('link', { name: /^create account$/i }),
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

  // #1258: the window is the scroll container here, so a guide opened from
  // the bottom of a long page must start at its title, and Back must return
  // to where the reader was.
  test('a new guide opens at the top; Back restores the position', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/learn/glossary')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    const bottom = await page.evaluate(() => window.scrollY)
    expect(bottom).toBeGreaterThan(2000)
    await page.getByRole('link', { name: /Previous/ }).click()
    await expect(page).not.toHaveURL(/glossary/)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
    await page.goBack()
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(bottom)
  })
})
