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
    // Dates read in sentence case, the way Home's recent rounds do.
    await expect(page.locator('main li').first()).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)
  })

  // #1195: the list (and its "N rounds logged") used to stop at the newest 20.
  test('asks for every round, not just the newest 20', async ({ page }) => {
    const limits: number[] = []
    page.on('request', (r) => {
      const u = new URL(r.url())
      if (r.method() === 'GET' && u.pathname.endsWith('/rest/v1/rounds') && u.searchParams.has('limit')) {
        limits.push(Number(u.searchParams.get('limit')))
      }
    })
    await page.goto('/rounds')
    await expect(page.getByRole('heading', { name: /^Rounds$/i })).toBeVisible()
    await expect.poll(() => Math.max(0, ...limits)).toBeGreaterThanOrEqual(500)
  })

  test('offers Import rounds and New round', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page.getByRole('link', { name: 'Import rounds' })).toHaveAttribute('href', '/rounds/import')
    await expect(page.getByRole('link', { name: /^New round/ })).toHaveAttribute('href', '/rounds/new')
  })

  // The e2e user has rounds, so the empty list is served here.
  test('with no rounds, Rounds and Home offer Log a round and Import your history', async ({ page }) => {
    await page.route('**/rest/v1/rounds*', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback(),
    )
    for (const path of ['/rounds', '/dashboard']) {
      await page.goto(path)
      await expect(page.getByText('No rounds logged yet')).toBeVisible()
      await expect(page.getByRole('link', { name: /^Log a round/ })).toHaveAttribute('href', '/rounds/new')
      await expect(page.getByRole('link', { name: 'Import your history' })).toHaveAttribute('href', '/rounds/import')
    }
  })
})

// #1230: ?view=map used to mark any round live, so the shot editor hid its
// mini-map on a finished round.
test('a finished round opened on the map keeps the shot editor mini-map', async ({ page }) => {
  await page.goto('/rounds')
  const href = await page.locator('main li a[href^="/rounds/"]').first().getAttribute('href')
  await page.goto(`${href}?view=map`)
  await page.getByRole('tab', { name: 'Scorecard' }).click()
  await page.getByRole('button', { name: /^Hole 1, \d+ shots?, edit$/ }).click()
  const editor = page.locator('.fixed.inset-0.z-50')
  await editor.getByRole('button', { name: /^edit$/i }).first().click()
  await expect(editor.locator('.mapboxgl-map')).toHaveCount(1, { timeout: 15_000 })
})
