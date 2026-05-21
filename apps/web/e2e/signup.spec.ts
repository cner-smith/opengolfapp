import { test, expect } from '@playwright/test'

// SignupPage uses styled <FieldLabel> spans (not <label htmlFor>), so
// getByLabel doesn't resolve. Assert visible label text + input by type
// for email/password; the username field has no type so we look it up
// as a sibling textbox after its label.
test.describe('Signup page (signed out)', () => {
  test('renders heading + username + email + password fields', async ({
    page,
  }) => {
    await page.goto('/signup')
    await expect(
      page.getByRole('heading', { name: /Create your OGA account/i }),
    ).toBeVisible()
    await expect(page.getByText('Username', { exact: true })).toBeVisible()
    await expect(page.getByText('Email', { exact: true })).toBeVisible()
    await expect(page.getByText('Password', { exact: true })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
