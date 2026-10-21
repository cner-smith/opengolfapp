import { test, expect } from '@playwright/test'

// Form validation: SettingsPage guards the profile fields BEFORE the DB
// write. Failing saves don't mutate profile state, so these live in
// chromium-auth (read-only) rather than chromium-flows.
//
// Username constraint: /^[a-zA-Z0-9_-]{3,32}$/ — letters, numbers, -, _
// Handicap constraint: -10 to 54, must be a number
test.describe('Settings form (signed in, validation)', () => {
  test('handicap > 54 shows out-of-range error', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^Handicap index/ }).click()
    await page.getByLabel('Handicap index').fill('99')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('alert')).toHaveText(/Handicap must be between -10 and 54/i)
  })

  test('invalid username disables Save button', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^Username/ }).click()
    // Two characters fails the {3,32} length constraint.
    await page.getByLabel('Username').fill('ab')
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })
})
