import { test, expect } from '@playwright/test'

test.describe('404 page (signed out)', () => {
  test('unknown route renders Page not found + back-to-dashboard button', async ({
    page,
  }) => {
    await page.goto('/intentional-404')
    await expect(
      page.getByRole('heading', { name: /Page not found/i }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Back to dashboard/i }),
    ).toBeVisible()
  })
})
