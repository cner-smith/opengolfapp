import { test, expect } from '@playwright/test'

test.describe('Privacy page (signed out)', () => {
  test('renders policy heading', async ({ page }) => {
    await page.goto('/privacy')
    await expect(
      page.getByRole('heading', { name: /What we collect, and why\./i }),
    ).toBeVisible()
  })
})
