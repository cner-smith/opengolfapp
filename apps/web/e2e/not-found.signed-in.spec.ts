import { test, expect } from '@playwright/test'

// #1259: public pages share the landing footer; signed in, it points back
// into the app, as PublicNav does, instead of offering Sign in.
test('signed in, the footer offers Go to app, not Sign in', async ({ page }) => {
  await page.goto('/intentional-404')
  const footer = page.getByRole('navigation', { name: 'Footer' })
  await expect(footer.getByRole('link', { name: 'Go to app' })).toHaveAttribute('href', '/dashboard')
  await expect(footer.getByRole('link', { name: 'Sign in' })).toHaveCount(0)
})
