import { test, expect } from '@playwright/test'

test.describe('Bag (signed in)', () => {
  test('renders heading + 14 default-bag rows', async ({ page }) => {
    await page.goto('/settings/bag')
    await expect(
      page.getByRole('heading', { name: /My bag\./i }),
    ).toBeVisible()
    // Seeded via scripts/seed-demo.ts → DEFAULT_BAG (14 clubs).
    // Each row has a drag handle with aria-label "Drag to reorder".
    const dragHandles = page.getByRole('button', { name: /Drag to reorder/i })
    await expect(dragHandles).toHaveCount(14)
  })
})
