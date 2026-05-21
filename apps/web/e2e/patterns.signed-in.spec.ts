import { test, expect } from '@playwright/test'

test.describe('Shot Patterns (signed in)', () => {
  test('renders heading and club picker', async ({ page }) => {
    await page.goto('/patterns')
    await expect(
      page.getByRole('heading', { name: /Shot Patterns/i }),
    ).toBeVisible()
    // Club picker renders buttons for each club. 7i is a common starter
    // pick and exists in the default bag.
    await expect(
      page.getByRole('button', { name: /^7i$/i }).first(),
    ).toBeVisible()
  })
})
