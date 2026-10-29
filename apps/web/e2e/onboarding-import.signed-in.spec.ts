import { test, expect, type Page } from '@playwright/test'

// The e2e user is already onboarded, so the profile writes are answered here
// instead of reaching DEV. Each test records them to prove onboarding is
// finished before the import step shows.
async function walkToImportStep(page: Page) {
  const writes: Record<string, unknown>[] = []
  await page.route('**/rest/v1/profiles*', async (route) => {
    if (route.request().method() !== 'PATCH') return route.fallback()
    const body = route.request().postDataJSON() as Record<string, unknown>
    writes.push(body)
    await route.fulfill({ json: { onboarding_completed: false, ...body } })
  })
  await page.goto('/onboarding')
  await page.getByRole('radio', { name: /^Casual/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('radio', { name: /^Break 90/ }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('radio', { name: 'About once a week' }).click()
  await page.getByRole('radio', { name: 'Mixed' }).click()
  await page.getByRole('button', { name: /Continue/ }).click()
  await page.getByRole('button', { name: /Save and continue/ }).click()
  await page.getByRole('button', { name: /Set up later/ }).click()
  await expect(page.getByRole('heading', { name: 'Your yardage book is open.' })).toBeVisible()
  await expect(page.getByText('One more thing')).toBeVisible()
  expect(writes.at(-1)).toEqual({ onboarding_completed: true })
  return writes
}

test.describe('Onboarding import step (signed in)', () => {
  test('Import rounds goes to the import page', async ({ page }) => {
    const writes = await walkToImportStep(page)
    const before = writes.length
    await page.getByRole('button', { name: /Import rounds/ }).click()
    await expect(page).toHaveURL(/\/rounds\/import$/)
    expect(writes.length).toBe(before)
  })

  test('Go to Home goes Home', async ({ page }) => {
    await walkToImportStep(page)
    await page.getByRole('button', { name: 'Go to Home' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})

test.describe('Onboarding step 1 (signed in)', () => {
  // The user is signed in, so there is nothing behind step 1: no Back that
  // lands on the sign-in form (#1228). Step 2 has one, back to step 1.
  test('has no Back; step 2 goes back to step 1', async ({ page }) => {
    await page.goto('/onboarding')
    await expect(page.getByText('Step 1 of 5')).toBeVisible()
    await expect(page.getByRole('button', { name: /Back/ })).toHaveCount(0)
    // Continue with no pick says why and takes focus to the list (#1267).
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByText('Pick the one that fits best.')).toBeVisible()
    await expect(page.getByRole('radio').first()).toBeFocused()
    await page.getByRole('radio', { name: /^Casual/ }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    await page.getByRole('button', { name: /Back/ }).click()
    await expect(page.getByText('Step 1 of 5')).toBeVisible()
    await expect(page).toHaveURL(/\/onboarding$/)
  })
})

test.describe('Onboarding step 4 on a phone (signed in)', () => {
  // Three play-style keys side by side overflowed at 390 px; below 560 px
  // they stack.
  test('the play-style keys stack, one per row, inside the page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/onboarding')
    await page.getByRole('radio', { name: /^Casual/ }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    await page.getByRole('radio', { name: /^Break 90/ }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    const group = page.getByRole('radiogroup', { name: 'How do you usually play?' })
    const boxes = await Promise.all(
      ['Casual', 'Mixed', 'Competitive'].map(async (name) => (await group.getByRole('radio', { name }).boundingBox())!),
    )
    for (const b of boxes) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(390)
    }
    expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y)
    expect(boxes[2]!.y).toBeGreaterThan(boxes[1]!.y)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
})

test.describe('Onboarding step 2 (signed in)', () => {
  // Step 1's answer sets where the handicap starts, and says so (#1266).
  test('starts the handicap from the skill picked on step 1', async ({ page }) => {
    await page.goto('/onboarding')
    await page.getByRole('radio', { name: /^Casual/ }).click()
    await page.getByRole('button', { name: /Continue/ }).click()
    await expect(page.getByRole('button', { name: /^Handicap index 28\.0/ })).toBeVisible()
    await expect(page.getByText(/No handicap yet\? Keep this/)).toBeVisible()
    await page.getByRole('button', { name: 'Raise by a tenth' }).click()
    await expect(page.getByRole('button', { name: /^Handicap index 28\.1/ })).toBeVisible()
    await expect(page.getByText(/No handicap yet\? Keep this/)).toHaveCount(0)
  })
})
