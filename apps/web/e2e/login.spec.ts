import { test, expect } from '@playwright/test'

// LoginPage uses a styled <FieldLabel> span (not a <label htmlFor>), so
// getByLabel doesn't resolve. We assert the visible label text + the
// input element by type.
test.describe('Login page (signed out)', () => {
  test('renders heading and email + password inputs', async ({ page }) => {
    await page.goto('/login')
    await expect(
      page.getByRole('heading', { name: /Sign in to OGA/i }),
    ).toBeVisible()
    await expect(page.getByText('Email', { exact: true })).toBeVisible()
    await expect(page.getByText('Password', { exact: true })).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })
})
