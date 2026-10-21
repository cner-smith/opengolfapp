import { test, expect } from '@playwright/test'

test.describe('Rounds list (signed in)', () => {
  test('renders Rounds heading + at least one row from seed', async ({
    page,
  }) => {
    await page.goto('/rounds')
    await expect(
      page.getByRole('heading', { name: /^Rounds$/i }),
    ).toBeVisible()
    // Seed inserts 15 rounds. Asserting ≥1 covers data-rendered without
    // making the test brittle to the exact count.
    const deleteButtons = page.getByRole('button', { name: /Delete round/i })
    await expect(deleteButtons.first()).toBeVisible()
    // Dates read in sentence case, the way Home's recent rounds do.
    await expect(page.locator('main li').first()).toContainText(/[A-Z][a-z]{2} \d{1,2}, \d{4}/)
  })

  test('offers Import rounds and New round', async ({ page }) => {
    await page.goto('/rounds')
    await expect(page.getByRole('link', { name: 'Import rounds' })).toHaveAttribute('href', '/rounds/import')
    await expect(page.getByRole('link', { name: /^New round/ })).toHaveAttribute('href', '/rounds/new')
  })

  // The e2e user has rounds, so the empty list is served here.
  test('with no rounds, Rounds and Home offer Log a round and Import your history', async ({ page }) => {
    await page.route('**/rest/v1/rounds*', (route) =>
      route.request().method() === 'GET' ? route.fulfill({ json: [] }) : route.fallback(),
    )
    for (const path of ['/rounds', '/dashboard']) {
      await page.goto(path)
      await expect(page.getByText('No rounds logged yet')).toBeVisible()
      await expect(page.getByRole('link', { name: /^Log a round/ })).toHaveAttribute('href', '/rounds/new')
      await expect(page.getByRole('link', { name: 'Import your history' })).toHaveAttribute('href', '/rounds/import')
    }
  })
})
