import { test, expect } from '@playwright/test'

// Phase 3 — form validation: SettingsPage inline guards.
//
// SettingsPage validates inputs BEFORE the DB write and renders the
// error from setError() in the form's error slot. Failing tests don't
// mutate profile state, so they live in chromium-auth (read-only)
// rather than chromium-flows.
//
// Username constraint: /^[a-zA-Z0-9_-]{3,32}$/ — letters, numbers, -, _
// Handicap constraint: -10 to 54, must be a number
test.describe('Settings form (signed in, validation)', () => {
  test('handicap > 54 shows out-of-range error', async ({ page }) => {
    await page.goto('/settings')
    const handicapInput = page.locator('input').nth(1)
    await handicapInput.fill('99')
    await page.getByRole('button', { name: /Save profile/i }).click()
    await expect(
      page.getByText(/Handicap must be between -10 and 54/i),
    ).toBeVisible()
  })

  test('invalid username disables Save button', async ({ page }) => {
    // Username regex is enforced via canSubmit, not via setError on
    // submit (unlike handicap). Save button disables when the regex
    // fails, so the test asserts the disabled state directly.
    await page.goto('/settings')
    const usernameInput = page.locator('input').nth(0)
    // Two characters fails the {3,32} length constraint.
    await usernameInput.fill('ab')
    const saveBtn = page.getByRole('button', { name: /Save profile/i })
    await expect(saveBtn).toBeDisabled()
  })
})
