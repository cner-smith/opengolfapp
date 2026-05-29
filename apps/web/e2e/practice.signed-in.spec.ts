import { test, expect } from '@playwright/test'

test.describe('Practice plan + Drill library (signed in)', () => {
  test('practice and drill library routes are reachable', async ({ page }) => {
    // /practice — verify the signed-in user lands and stays here (no auth
    // redirect). The `<h1>` is conditional: "Practice plan" when no plan
    // is stored, the plan's week_focus when one is — so URL stability is
    // the universal signal across both states.
    await page.goto('/practice')
    await expect(page).toHaveURL(/\/practice$/)

    // /practice/drills — direct nav. The page rendered as expected if the
    // "The full set" heading is visible. (The "Drill library" kicker sits
    // above the h1 on this page.)
    await page.goto('/practice/drills')
    await expect(
      page.getByRole('heading', { name: /The full set/i }),
    ).toBeVisible()
  })
})
