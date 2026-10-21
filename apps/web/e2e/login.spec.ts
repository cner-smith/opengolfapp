import { test, expect } from '@playwright/test'

test.describe('Login page (signed out)', () => {
  test('renders heading and email + password inputs', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    // The sign-up action has one name on both pages.
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup')
  })
})
