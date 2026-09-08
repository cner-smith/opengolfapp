import { test, expect } from '@playwright/test'

test.describe('Landing page (signed out)', () => {
  test('renders hero and open-source badge', async ({ page }) => {
    await page.goto('/')
    await expect(
      page.getByRole('heading', { name: /Track every shot/i }),
    ).toBeVisible()
    // Exact-match the hero badge — the footer carries the longer "Free and
    // open source · MIT License", which a loose match would also hit under
    // strict mode. Exact on the hero's own string separates them.
    // (Was 'Free and open source'; the badge gained "· MIT" in #846 and this
    // assertion has been failing ever since. e2e is not in CI, so nothing
    // caught it.)
    await expect(
      page.getByText('Free and open source · MIT', { exact: true }),
    ).toBeVisible()
  })
})
