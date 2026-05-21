import { test, expect } from '@playwright/test'

test.describe('Practice plan + Drill library (signed in)', () => {
  test('practice placeholder renders and Drill library is reachable', async ({
    page,
  }) => {
    await page.goto('/practice')
    await expect(
      page.getByRole('heading', { name: /Practice plan/i }),
    ).toBeVisible()
    await page.getByRole('link', { name: /Browse drill library/i }).click()
    await expect(page).toHaveURL(/\/practice\/drills$/)
    // The h1 on /practice/drills is "The full set"; "Drill library" is
    // the kicker above it.
    await expect(
      page.getByRole('heading', { name: /The full set/i }),
    ).toBeVisible()
  })
})
