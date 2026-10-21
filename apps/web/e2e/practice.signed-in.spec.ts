import { test, expect } from '@playwright/test'

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
})
