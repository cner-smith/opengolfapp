import { test, expect, type Page } from '@playwright/test'

// The e2e user plays in yards; these serve its profile in metres.
async function playInMetres(page: Page) {
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const res = await route.fetch()
    const body = await res.json()
    const metres = (p: Record<string, unknown>) => ({ ...p, distance_unit: 'meters' })
    await route.fulfill({ response: res, json: Array.isArray(body) ? body.map(metres) : metres(body) })
  })
}

async function openFirstShot(page: Page) {
  await page.goto('/rounds')
  await page.locator('main li a[href^="/rounds/"]').first().click()
  await page.getByRole('button', { name: /^Hole \d+, [1-9]\d* shots?, edit$/ }).first().click()
  await expect(page.getByRole('heading', { name: /^Shot 1/ })).toBeVisible()
  const dialog = page.getByRole('dialog')
  const change = dialog.getByRole('button', { name: 'Change', exact: true })
  if (await change.isVisible()) await change.click()
  return dialog.getByLabel('To the pin (m)')
}

test.describe('Shot editor distance in metres', () => {
  test.afterEach(({ page }) => page.unrouteAll({ behavior: 'ignoreErrors' }))

  test('shows the stored yards in metres', async ({ page }) => {
    await playInMetres(page)
    // The header already prints the stored yards in metres ("Hole 1 · 121 m
    // to the pin"); the field must read the same number.
    const field = await openFirstShot(page)
    const header = await page.getByRole('dialog').locator('header').innerText()
    const metres = header.match(/(\d+) m to the pin/)?.[1]
    expect(metres).toBeTruthy()
    await expect(field).toHaveValue(metres!)
  })

  test('saves a distance typed in metres as yards', async ({ page }) => {
    await playInMetres(page)
    const field = await openFirstShot(page)
    await field.fill('120')
    // Nothing reaches the database: the body is read and the request aborted
    // inside the handler, so the test can't end (and unroute) mid-request.
    let sent: (body: { distance_to_target: number }) => void
    const body = new Promise<{ distance_to_target: number }>((r) => (sent = r))
    await page.route('**/rest/v1/shots*', async (route) => {
      if (route.request().method() === 'GET') return route.fallback()
      const json = route.request().postDataJSON()
      await route.abort()
      sent(json)
    })
    await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click()
    // 120 m is 131.2 yd; shots store whole yards.
    expect((await body).distance_to_target).toBe(131)
  })
})
