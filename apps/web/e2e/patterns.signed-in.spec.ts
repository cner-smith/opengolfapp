import { test, expect, type Page } from '@playwright/test'

// The seeded e2e user has aimed shots with every club in the demo bag, with
// shape and start line recorded on most but not all of them.

async function open7i(page: Page) {
  await page.goto('/patterns')
  await expect(page.getByRole('heading', { level: 1, name: 'Shot patterns' })).toBeVisible()
  const clubs = page.getByRole('radiogroup', { name: 'Club' })
  // Pick another club first so choosing the 7-iron is a real change.
  const driver = clubs.getByRole('radio', { name: /^driver,/i })
  await driver.click()
  await expect(driver).toHaveAttribute('aria-checked', 'true')
  const seven = clubs.getByRole('radio', { name: /^7-iron,/ })
  await seven.click()
  await expect(seven).toHaveAttribute('aria-checked', 'true')
  await expect(driver).toHaveAttribute('aria-checked', 'false')
  // Wait for the 7-iron's shots to draw.
  await expect(page.locator('svg.pat-chart [data-shot]').first()).toBeAttached()
}

async function box(page: Page, selector: ReturnType<Page['locator']>) {
  const b = await selector.boundingBox()
  expect(b, 'element has a layout box').not.toBeNull()
  return b!
}

test.describe('Shot patterns (signed in)', () => {
  test('the club ladder selects the 7-iron', async ({ page }) => {
    await open7i(page)
    await expect(page.getByRole('status').filter({ hasText: 'Showing' })).toContainText(/Showing \d+ 7-iron shots/)
    // The small numbers on the rules are gaps, not shot counts.
    await expect(page.getByText('The small number on each rule is the gap between clubs.')).toBeVisible()
  })

  test('colour by shape shows the legend with a Not recorded entry', async ({ page }) => {
    await open7i(page)
    const shape = page.getByRole('radiogroup', { name: 'Colour the shots by' }).getByRole('radio', { name: 'Shape' })
    await shape.click()
    await expect(shape).toHaveAttribute('aria-checked', 'true')
    const groups = page.getByRole('group', { name: 'Show or hide groups of shots' })
    const notRecorded = groups.getByRole('button', { name: /Not recorded/ })
    await expect(notRecorded).toHaveAttribute('aria-pressed', 'true')
    const b = await box(page, notRecorded)
    expect(b.width).toBeGreaterThan(0)
    expect(b.height).toBeGreaterThan(0)
  })

  test('a layer toggle hides the shots', async ({ page }) => {
    await open7i(page)
    const shots = page.getByRole('group', { name: 'Show on the chart' }).getByRole('button', { name: 'Shots' })
    await expect(shots).toHaveAttribute('aria-pressed', 'true')
    // Each shot sits in a group whose opacity the layer drives.
    const holder = page.locator('svg.pat-chart [data-shot]').first().locator('xpath=..')
    await expect.poll(() => holder.evaluate((el) => getComputedStyle(el).opacity)).toBe('1')
    await shots.click()
    await expect(shots).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => holder.evaluate((el) => getComputedStyle(el).opacity)).toBe('0')
  })

  test('the list key opens a table with one row per shot', async ({ page }) => {
    await open7i(page)
    const status = await page.getByRole('status').filter({ hasText: 'Showing' }).textContent()
    const n = Number(status?.match(/Showing (\d+) 7-iron/)?.[1])
    expect(n).toBeGreaterThan(0)
    const table = page.getByRole('table', { name: /7-iron shots, newest first/ })
    await expect(table).toHaveCount(0)
    await page.getByRole('button', { name: 'List the shots' }).click()
    await expect(page.getByRole('button', { name: 'Hide the list' })).toHaveAttribute('aria-expanded', 'true')
    expect((await box(page, table)).height).toBeGreaterThan(0)
    await expect(table.locator('tbody tr')).toHaveCount(n)
  })

  test('a layer toggle that is off has a solid edge; dashed is only for needs five shots', async ({ page }) => {
    await open7i(page)
    const rings = page.getByRole('group', { name: 'Show on the chart' }).getByRole('button', { name: 'Rings' })
    await rings.click()
    await expect(rings).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(() => rings.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid')
    await expect.poll(() => rings.locator('svg').evaluate((el) => getComputedStyle(el).opacity)).toBe('0.35')
  })

  test('on a phone the Filters key counts the filters and the sheet clears them', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 })
    await open7i(page)
    const filters = page.getByRole('button', { name: /^Filters/ })
    await expect(filters).toHaveText('Filters')
    await filters.click()
    const sheet = page.getByRole('dialog', { name: 'Filters' })
    await expect(sheet.getByRole('button', { name: 'Clear filters' })).toHaveCount(0)
    await sheet.getByRole('group', { name: 'Lie' }).getByRole('button', { name: 'Rough' }).click()
    await sheet.getByRole('button', { name: 'Clear filters' }).click()
    await expect(sheet.getByRole('group', { name: 'Lie' }).getByRole('button', { name: 'Any' })).toHaveAttribute('aria-pressed', 'true')
    await sheet.getByRole('group', { name: 'Lie' }).getByRole('button', { name: 'Rough' }).click()
    await page.keyboard.press('Escape')
    await expect(filters).toHaveText('Filters · 1')
  })

  test('the tee view draws from where the ball was hit', async ({ page }) => {
    await open7i(page)
    const tee = page.getByRole('tab', { name: 'From the tee' })
    await tee.click()
    await expect(tee).toHaveAttribute('aria-selected', 'true')
    const label = page.locator('svg.pat-chart text', { hasText: 'hit from here' })
    await expect(label).toHaveCount(1)
    const b = await box(page, label)
    expect(b.width).toBeGreaterThan(0)
  })
})

test.describe('Shot patterns on a touch screen (signed in)', () => {
  test.use({ viewport: { width: 400, height: 860 }, hasTouch: true, isMobile: true })

  test('the first tap on a legend group brings it forward, the second hides it', async ({ page }) => {
    await page.goto('/patterns')
    const seven = page.getByRole('radiogroup', { name: 'Club' }).getByRole('radio', { name: /^7-iron,/ })
    await seven.tap()
    await expect(seven).toHaveAttribute('aria-checked', 'true')
    await expect(page.locator('svg.pat-chart [data-shot]').first()).toBeAttached()
    await page.getByRole('radiogroup', { name: 'Colour the shots by' }).getByRole('radio', { name: 'Shape' }).tap()
    await expect(page.getByText('Tap a group once to bring it forward, twice to hide it.')).toBeVisible()
    const group = page.getByRole('group', { name: 'Show or hide groups of shots' }).getByRole('button').first()
    const stepped = () => page.locator('svg.pat-chart [data-shot]').evaluateAll((els) => els.filter((e) => Number(getComputedStyle(e).opacity) < 0.5).length)
    await expect.poll(stepped).toBe(0)
    await group.tap()
    // Still shown, and the other groups' shots step back.
    await expect(group).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(stepped).toBeGreaterThan(0)
    await group.tap()
    await expect(group).toHaveAttribute('aria-pressed', 'false')
  })
})
