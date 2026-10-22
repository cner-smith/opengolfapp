import { test, expect } from '@playwright/test'

test.describe('Dashboard (signed in)', () => {
  test('renders greeting + Average score tile + round-by-round trend', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    // No bounce to /onboarding — proves the full auth → ProfileGuard →
    // onboarding_completed path against real Supabase.
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(
      page.getByRole('heading', { name: /^Good (morning|afternoon|evening)/i }),
    ).toBeVisible()
    await expect(page.getByText('Average score', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Round by round' })).toBeVisible()
  })
})
