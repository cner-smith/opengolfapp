import { test, expect } from '@playwright/test'

test.describe('Stats / Strokes Gained (signed in)', () => {
  test('renders heading + segmented control', async ({ page }) => {
    await page.goto('/stats')
    await expect(
      page.getByRole('heading', { name: /^Stats$/i }),
    ).toBeVisible()
    // SegmentedControl renders "Last N" buttons.
    await expect(
      page.getByRole('button', { name: /^Last 5$/i }),
    ).toBeVisible()
  })
})
