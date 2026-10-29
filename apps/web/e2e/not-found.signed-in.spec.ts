import { test, expect } from '@playwright/test'

// #1259: public pages share the landing footer; signed in, it points back
// into the app, as PublicNav does, instead of offering Sign in.
test('signed in, the footer offers Go to app, not Sign in', async ({ page }) => {
  await page.goto('/support')
  const footer = page.getByRole('navigation', { name: 'Footer' })
  await expect(footer.getByRole('link', { name: 'Go to app' })).toHaveAttribute('href', '/dashboard')
  await expect(footer.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
})

// #1307: signed in, a 404 stays in the app, with one forest key back Home.
test('signed in, a 404 sits in the app shell with one way back', async ({ page }) => {
  await page.goto('/intentional-404')
  await expect(page.getByRole('heading', { name: 'Page not found.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Back to Home/ })).toHaveAttribute('href', '/dashboard')
  await expect(page.getByRole('navigation', { name: 'Footer' })).toHaveCount(0)
  await expect(page.locator('a.key-primary')).toHaveCount(1)
})
