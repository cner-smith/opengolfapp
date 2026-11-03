import { test, expect, type Page } from '@playwright/test'

// #1225: a map whose style can't be fetched (offline, blocked) shows the
// fallback with Try again instead of a blank frame.
async function blockMapStyle(page: Page) {
  await page.route(/api\.mapbox\.com\/styles\//, (route) => route.abort('internetdisconnected'))
}

async function firstRound(page: Page): Promise<{ id: string; course_id: string }> {
  const rounds = page.waitForResponse(
    (r) => r.request().method() === 'GET' && new URL(r.url()).pathname.endsWith('/rest/v1/rounds'),
  )
  await page.goto('/rounds')
  const rows = (await (await rounds).json()) as { id: string; course_id: string }[]
  expect(rows.length).toBeGreaterThan(0)
  return rows[0]!
}

test.describe('Map that fails to load', () => {
  test.afterEach(({ page }) => page.unrouteAll({ behavior: 'ignoreErrors' }))

  test('the round map offers Try again', async ({ page }) => {
    const round = await firstRound(page)
    await blockMapStyle(page)
    await page.goto(`/rounds/${round.id}?view=map`)
    await expect(page.getByText('The map didn’t load. Check your connection and try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('the hole plan map offers Try again', async ({ page }) => {
    const round = await firstRound(page)
    await blockMapStyle(page)
    await page.goto(`/plan/${round.course_id}/1`)
    await expect(page.getByText('The map didn’t load. Check your connection and try again.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })
})
