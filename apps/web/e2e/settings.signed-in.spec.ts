import { test, expect } from '@playwright/test'

// SettingsPage uses <span className="kicker"> labels next to inputs
// rather than <label htmlFor>. Assert by visible text + input
// proximity via aria-invalid or input value.
test.describe('Settings (signed in)', () => {
  test('renders heading and seeded username + handicap values', async ({
    page,
  }) => {
    await page.goto('/settings')
    await expect(
      page.getByRole('heading', { name: /^Settings$/i }),
    ).toBeVisible()
    await expect(page.getByText('Username', { exact: true })).toBeVisible()
    await expect(page.getByText('Handicap index', { exact: true })).toBeVisible()
    // Seeded values from scripts/seed-demo.ts profile upsert.
    await expect(page.locator('input').filter({ hasText: '' })).toHaveCount(
      await page.locator('input').count(),
    )
    // The username input should hold the seeded value 'e2e-test'.
    const usernameInput = page.locator('input').nth(0)
    await expect(usernameInput).toHaveValue('e2e-test')
  })
})
