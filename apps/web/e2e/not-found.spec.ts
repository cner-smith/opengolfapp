import { test, expect } from '@playwright/test'

test.describe('404 page (signed out)', () => {
  test('unknown route renders Page not found + a way back to the start', async ({
    page,
  }) => {
    await page.goto('/intentional-404')
    await expect(
      page.getByRole('heading', { name: /Page not found/i }),
    ).toBeVisible()
    // Signed out, the way back is the landing page, not a dashboard (#1229).
    await expect(page.getByRole('link', { name: /Back to the start/i })).toHaveAttribute('href', '/')
  })
})
