import { test, expect } from '@playwright/test'

test.describe('Signup page (signed out)', () => {
  test('renders heading + name + email + password fields', async ({
    page,
  }) => {
    await page.goto('/signup')
    await expect(page.getByRole('heading', { name: 'Start your yardage book.' })).toBeVisible()
    await expect(page.getByLabel('What should we call you?')).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('minlength', '8')
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
