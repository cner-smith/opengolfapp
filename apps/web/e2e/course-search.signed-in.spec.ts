import { test, expect } from '@playwright/test'

// 2026-11-21: api.opengolfapi.org stopped answering and the course list
// never appeared. Our own results must show without waiting on it.
test('course search shows our courses while the outside directory hangs', async ({ page }) => {
  await page.route('https://api.opengolfapi.org/**', () => {}) // never answers
  await page.goto('/rounds/new')
  await page.getByPlaceholder('Search courses').fill('Pine Ridge')
  await expect(
    page.getByRole('button', { name: /Pine Ridge Golf Club/i }).first(),
  ).toBeVisible({ timeout: 2500 }) // under the 3 s outside-search limit
})
