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

  test('the table has one row per shot', async ({ page }) => {
    await open7i(page)
    const status = await page.getByRole('status').filter({ hasText: 'Showing' }).textContent()
    const n = Number(status?.match(/Showing (\d+) 7-iron/)?.[1])
    expect(n).toBeGreaterThan(0)
    const table = page.getByRole('table', { name: /7-iron shots, newest first/ })
    await expect(table).toHaveCount(0)
    await page.getByRole('button', { name: 'Show the shots as a table' }).click()
    await expect(page.getByRole('button', { name: 'Hide the table' })).toHaveAttribute('aria-expanded', 'true')
    expect((await box(page, table)).height).toBeGreaterThan(0)
    await expect(table.locator('tbody tr')).toHaveCount(n)
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
