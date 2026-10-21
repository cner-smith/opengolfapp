import { test, expect } from '@playwright/test'

test.describe('Bag (signed in)', () => {
  test('gapping chart headline, then a yardage card of the 14 default clubs', async ({ page }) => {
    await page.goto('/settings/bag')
    await expect(page.getByRole('heading', { level: 1, name: 'My bag' })).toBeVisible()
    // Seeded via scripts/seed-demo.ts → DEFAULT_BAG (14 clubs), each with a drag handle.
    await expect(page.getByRole('button', { name: /^Drag .+ to reorder$/ })).toHaveCount(14)
    const card = page.getByRole('region', { name: 'Yardage card' })
    await expect(card.getByTestId('bag-row')).toHaveCount(14)
    // core bagGaps' headline sentence leads the chart.
    await expect(page.getByTestId('bag-headline')).toHaveText(/\d+ yd/)
    // Gaps sit on the rules; exactly one is the widest.
    expect(await card.getByTestId('bag-gap').count()).toBeGreaterThan(0)
    await expect(card.getByTestId('bag-gap').filter({ hasText: 'the widest' })).toHaveCount(1)
  })

  test('opening a club shows its edit form with Bench it and Delete', async ({ page }) => {
    await page.goto('/settings/bag')
    const row = page.getByRole('button', { name: /^7 Iron[,.]/ })
    await expect(row).toHaveAttribute('aria-expanded', 'false')
    await expect(page.getByRole('button', { name: 'Bench it' })).toHaveCount(0)
    await row.click()
    await expect(row).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('button', { name: 'Bench it' })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Delete 7 Iron' })).toHaveCount(1)
  })
})
