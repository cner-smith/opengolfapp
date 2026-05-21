import { test, expect } from '@playwright/test'

test.describe('Dashboard (signed in)', () => {
  test('renders greeting + Avg score tile + SG trend section', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    // No bounce to /onboarding — proves the full auth → ProfileGuard →
    // onboarding_completed path against real Supabase.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole('heading', { name: /Good round/i }),
    ).toBeVisible()
    await expect(page.getByText('Avg score', { exact: true })).toBeVisible()
    await expect(page.getByText('SG total trend', { exact: true })).toBeVisible()
  })
})
