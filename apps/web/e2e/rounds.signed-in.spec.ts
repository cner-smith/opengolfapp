import { test, expect } from '@playwright/test'

test.describe('Rounds list (signed in)', () => {
  test('renders Rounds heading + at least one row from seed', async ({
    page,
  }) => {
    await page.goto('/rounds')
    await expect(
      page.getByRole('heading', { name: /^Rounds$/i }),
    ).toBeVisible()
    // Seed inserts 15 rounds. Asserting ≥1 covers data-rendered without
    // making the test brittle to the exact count.
    const deleteButtons = page.getByRole('button', { name: /Delete round/i })
    await expect(deleteButtons.first()).toBeVisible()
  })
})
