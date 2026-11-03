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
    // Every sign-up link on the page says "Create account" (nav, hero, the
    // bag ladder, close).
    const signup = page.locator('a[href="/signup"]')
    await expect(signup).toHaveCount(4)
    for (const text of await signup.allTextContents()) {
      expect(text.replace('→', '').trim()).toBe('Create account')
    }
  })

  test('the example Shot patterns chart loads and answers a club change', async ({ page }) => {
    await page.goto('/')
    // The chart mounts when it comes into view.
    await page.locator('#try').scrollIntoViewIfNeeded()
    const ladder = page.getByRole('radiogroup', { name: 'Club' })
    await expect(ladder).toBeVisible()
    const finding = page.locator('.lb-demo-body p').first()
    await expect(finding).toContainText('driver')
    await ladder.getByRole('radio', { name: /^7-iron/ }).click()
    await expect(finding).toContainText('7-iron')
    await expect(finding).not.toContainText('driver')
  })

  test('the try-yours ladder answers a typed distance, a club out and metres', async ({ page }) => {
    await page.goto('/')
    const wedge = page.getByLabel('Gap wedge typical distance, yards')
    await wedge.scrollIntoViewIfNeeded()
    const headline = page.getByTestId('bag-headline')
    await expect(headline).toHaveText('Your driver to your lob wedge, 226 to 87 yd, with every gap under 20 yd.')

    // The promo bag: pitching wedge 128, gap wedge 116 → 104: a 24 yd hole.
    await wedge.fill('104')
    await expect(headline).toHaveText('24 yd hole between your pitching wedge and gap wedge.')

    // Out of the bag, the 5-hybrid's row leaves the chart.
    const chart = page.getByRole('region', { name: 'Gapping chart' })
    await expect(chart.getByText('5-hybrid', { exact: true })).toHaveCount(1)
    const hybrid = page.getByRole('button', { name: '5-hybrid in the bag' })
    await hybrid.click()
    await expect(hybrid).toHaveAttribute('aria-pressed', 'false')
    await expect(chart.getByText('5-hybrid', { exact: true })).toHaveCount(0)

    // Metres: the fields, the chart and the sentence all change unit.
    await page.getByRole('button', { name: 'Metres' }).click()
    await expect(page.getByLabel('Gap wedge typical distance, metres')).toHaveValue('95')
    await expect(headline).toHaveText('22 m hole between your pitching wedge and gap wedge.')
  })
})
