import { test, expect } from '@playwright/test'

// Settings rows show the label left and the current value right; tapping a
// row opens its editor in place, one row at a time.
test.describe('Settings (signed in)', () => {
  test('rows show the seeded values; a row opens its editor', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { level: 1, name: 'Profile' })).toBeVisible()
    // Seeded values from scripts/seed-demo.ts profile upsert.
    const username = page.getByRole('button', { name: /^Username/ })
    await expect(username).toContainText('e2e-test')
    await expect(page.getByRole('button', { name: /^Handicap index/ })).toContainText('12.4')
    await expect(page.getByLabel('Username')).toHaveCount(0)
    await username.click()
    await expect(username).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByLabel('Username')).toHaveValue('e2e-test')
    // Opening another row closes the first.
    await page.getByRole('button', { name: /^Goal/ }).click()
    await expect(page.getByLabel('Username')).toHaveCount(0)
    // Nothing edited, so no Save button.
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0)
  })

  test('Your data has an Import rounds row', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: 'Your data' })).toBeVisible()
    await expect(page.getByRole('link', { name: /^Import rounds/ })).toHaveAttribute('href', '/rounds/import')
  })
})
