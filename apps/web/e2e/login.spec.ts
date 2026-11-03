import { test, expect } from '@playwright/test'

test.describe('Login page (signed out)', () => {
  test('renders heading and email + password inputs', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveAttribute('type', 'email')
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'password')
    // Show turns the dots into text and back (#1273).
    await page.getByRole('button', { name: 'Show password' }).click()
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text')
    await expect(page.getByRole('button', { name: 'Show password' })).toHaveAttribute('aria-pressed', 'true')
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
    await page.getByRole('button', { name: 'Forgot your password?' }).click()
    await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible()
    await expect(page).toHaveURL(/\?mode=forgot$/)
    // The password row folds shut rather than unmounting (#1262).
    await expect
      .poll(() => page.getByLabel('Password', { exact: true }).evaluate((el) => getComputedStyle(el).visibility))
      .toBe('hidden')
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: /Send the link/ }).click()
    await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
    expect(sent).not.toBeNull()
    expect(sent!.body).toContain('someone@example.com')
    expect(decodeURIComponent(sent!.url)).toMatch(/redirect_to=https?:\/\/[^&]+\/auth\/reset/)
    // The sent page names the address and can send again, then rests (#1274).
    await expect(page.getByText('someone@example.com')).toBeVisible()
    sent = null
    await page.getByRole('button', { name: 'Send it again' }).click()
    await expect(page.getByRole('button', { name: 'Sent again' })).toBeDisabled()
    expect(sent).not.toBeNull()
  })

  test('Back from the reset form returns to sign in', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'Forgot your password?' }).click()
    await expect(page.getByRole('heading', { name: 'Reset your password.' })).toBeVisible()
    await page.goBack()
    await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible()
    await expect(page.getByLabel('Password', { exact: true })).toBeEditable()
  })

  test('a dead reset link asks for a fresh one on the spot', async ({ page }) => {
    let sent = ''
    await page.route('**/auth/v1/recover**', async (route) => {
      sent = route.request().postData() ?? ''
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    })
    // No code and no session: the link is dead (#1276).
    await page.goto('/auth/reset')
    await expect(page.getByRole('heading', { name: 'That link didn’t work.' })).toBeVisible()
    await page.getByLabel('Email').fill('someone@example.com')
    await page.getByRole('button', { name: /Send a fresh link/ }).click()
    await expect(page.getByRole('heading', { name: 'Check your email.' })).toBeVisible()
    expect(sent).toContain('someone@example.com')
  })
})
