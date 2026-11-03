import { test, expect } from '@playwright/test'

test.describe('Login page (signed out)', () => {
  test('renders heading and email + password inputs', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Password')).toHaveAttribute('type', 'password')
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
    // The sign-up action has one name on both pages.
    await expect(page.getByRole('link', { name: 'Create account' })).toHaveAttribute('href', '/signup')
  })

  test('Forgot password asks for the email and sends the reset link to /auth/reset', async ({ page }) => {
    // Answer the recover call here: no email goes out from a test run.
    let sent: { url: string; body: string } | null = null
    await page.route('**/auth/v1/recover**', async (route) => {
      sent = { url: route.request().url(), body: route.request().postData() ?? '' }
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot password?' }).click()
    await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveCount(0)
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: /Send the link/ }).click()
    await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
    expect(sent).not.toBeNull()
    expect(sent!.body).toContain('someone@example.com')
    expect(decodeURIComponent(sent!.url)).toMatch(/redirect_to=https?:\/\/[^&]+\/auth\/reset/)
  })
})
