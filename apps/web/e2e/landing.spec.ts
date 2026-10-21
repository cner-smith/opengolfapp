import { test, expect } from '@playwright/test'

test.describe('Landing page (signed out)', () => {
  test('renders the two-line hero and one name for sign-up', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const h1 = page.getByRole('heading', { level: 1 })
    await expect(h1).toHaveText(
      'Approach costs you 0.8 strokes a round. Track your rounds. OGA finds yours.',
    )
    // Two lines at desktop: each half of the headline sits on one line.
    await page.evaluate(() => document.fonts.ready)
    const lines = await h1.locator('span').evaluateAll((spans) =>
      spans.map((s) => s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight)),
    )
    expect(lines).toHaveLength(2)
    for (const n of lines) expect(Math.round(n)).toBe(1)
    // Every sign-up link on the page says "Create account" (nav, hero, close).
    const signup = page.locator('a[href="/signup"]')
    await expect(signup).toHaveCount(3)
    for (const text of await signup.allTextContents()) {
      expect(text.replace('→', '').trim()).toBe('Create account')
    }
  })

  test('the example Shot patterns chart loads and answers a club change', async ({ page }) => {
    await page.goto('/')
    const ladder = page.getByRole('radiogroup', { name: 'Club' })
    await expect(ladder).toBeVisible()
    const finding = page.locator('.lb-demo-body p').first()
    await expect(finding).toContainText('driver')
    await ladder.getByRole('radio', { name: /^7-iron/ }).click()
    await expect(finding).toContainText('7-iron')
    await expect(finding).not.toContainText('driver')
  })
})
