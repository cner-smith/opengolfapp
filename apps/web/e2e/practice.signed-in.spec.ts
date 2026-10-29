import { test, expect, type Page } from '@playwright/test'

const AI_LINE = /^Claude, Anthropic’s AI, writes your plan\. Generating sends it your handicap/

// Serve the e2e user's real plan as last week's, written by Claude, so the
// Generate button shows. Optionally answer the rounds-with-SG count. The plan
// function is blocked: these tests must never reach the paid API.
async function lastWeeksAiPlan(page: Page, roundsWithSG?: number) {
  await page.route('**/functions/v1/generate-practice-plan*', (route) => route.abort())
  await page.route('**/rest/v1/practice_plans*', async (route) => {
    if (route.request().method() !== 'GET') return route.fallback()
    const res = await route.fetch()
    const rows = (await res.json()) as Record<string, unknown>[]
    await route.fulfill({
      response: res,
      json: rows.map((p) => ({ ...p, valid_until: '2020-01-07', raw_model_output: { status: 'ok' } })),
    })
  })
  if (roundsWithSG != null) {
    // The count rides on content-range; keep the real response's CORS headers
    // so the browser lets the client read it.
    await page.route('**/rest/v1/rounds*', async (route) => {
      if (route.request().method() !== 'HEAD') return route.fallback()
      const res = await route.fetch()
      await route.fulfill({ response: res, headers: { ...res.headers(), 'content-range': `*/${roundsWithSG}` } })
    })
  }
}

test.describe('Practice plan + Drills (signed in)', () => {
  test('practice page leads with the title and the week bar', async ({ page }) => {
    await page.goto('/practice')
    await expect(page).toHaveURL(/\/practice$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible()
    // The seeded e2e user has a plan, so the week bar's progress reads
    // "<done> of <total> min" in its accessible values.
    const bar = page.getByRole('progressbar', { name: 'Minutes practised this week' })
    await expect(bar).toHaveAttribute('aria-valuemax', /^[1-9]\d*$/)
  })

  test('a drill line opens its instructions in place', async ({ page }) => {
    await page.goto('/practice/drills')
    await expect(page.getByRole('heading', { level: 1, name: 'Drills' })).toBeVisible()
    const first = page.getByTestId('drill-line').first().getByRole('button')
    await expect(first).toHaveAttribute('aria-expanded', 'false')
    await first.click()
    await expect(first).toHaveAttribute('aria-expanded', 'true')
    const detail = page.locator(`#${await first.getAttribute('aria-controls')}`)
    await expect(detail).toHaveCount(1)
    expect((await detail.boundingBox())?.height ?? 0).toBeGreaterThan(20)
  })

  test("the plan toggle shows only this week's plan drills", async ({ page }) => {
    await page.goto('/practice/drills')
    const lines = page.getByTestId('drill-line')
    await expect(lines.first()).toBeVisible()
    const all = await lines.count()
    const toggle = page.getByRole('button', { name: /^In this week's plan · \d+$/ })
    const n = Number((await toggle.textContent())!.match(/(\d+)$/)![1])
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect(lines).toHaveCount(n)
    expect(n).toBeLessThan(all)
    // Every line left is marked as in the plan.
    for (const line of await lines.all()) await expect(line).toContainText("In this week's plan")
  })

  test('Generate says Claude writes the plan, and the plan says Claude wrote it', async ({ page }) => {
    await lastWeeksAiPlan(page, 6)
    await page.goto('/practice')
    await expect(page.getByRole('button', { name: /Generate this week's plan/ })).toBeVisible()
    const line = page.getByTestId('ai-disclosure')
    await expect(line).toHaveText(AI_LINE)
    expect((await line.boundingBox())?.height ?? 0).toBeGreaterThan(10)
    await expect(page.getByText('Claude reads this note too.', { exact: false })).toHaveCount(1)
    await expect(page.getByTestId('ai-written')).toHaveText('Claude wrote this plan from your numbers. Use your judgment.')
  })

  test('below 5 rounds with strokes gained, Generate says nothing about Claude', async ({ page }) => {
    await lastWeeksAiPlan(page, 4)
    await page.goto('/practice')
    await expect(page.getByRole('button', { name: /Generate this week's plan/ })).toBeVisible()
    await expect(page.getByTestId('ai-disclosure')).toHaveCount(0)
    await expect(page.getByText('Claude reads this note too.', { exact: false })).toHaveCount(0)
  })
})
