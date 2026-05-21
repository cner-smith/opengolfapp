import { test, expect } from '@playwright/test'

test.describe('Landing page (signed out)', () => {
  test('renders hero and open-source badge', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /Track every shot/i }),
    ).toBeVisible()
    // Exact-match the badge text — there's also a footer "Free and open
    // source · MIT License" div that loose-matches under strict mode.
    await expect(
      page.getByText('Free and open source', { exact: true }),
    ).toBeVisible()
  })
})
