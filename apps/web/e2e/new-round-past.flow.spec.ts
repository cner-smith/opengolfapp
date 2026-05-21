import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const E2E_USER_ID = 'd49b00a3-0486-4c47-814f-f4d16bffed0c'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Stable course name from the seed (scripts/seed-demo.ts inserts
// rounds against the first 3 courses, which include 'Pine Ridge Golf
// Club'). Unique enough that the search dropdown has exactly one row.
const SEARCH_QUERY = 'Pine Ridge'
const COURSE_NAME = 'Pine Ridge Golf Club'

let createdRoundId: string | null = null

test.describe('New round (past, signed in, mutating)', () => {
  test.afterEach(async () => {
    if (createdRoundId) {
      // Cascades through hole_scores + shots via FK.
      await admin.from('rounds').delete().eq('id', createdRoundId)
      createdRoundId = null
    }
  })

  test('create a past round → navigate to round detail', async ({ page }) => {
    await page.goto('/rounds/new')
    await expect(
      page.getByRole('heading', { name: /New round/i }),
    ).toBeVisible()

    // Mode chip is a <button aria-pressed>. Make "After the fact"
    // active explicitly rather than relying on the default.
    await page.getByRole('button', { name: /After the fact/i }).click()

    // CourseSearch input + debounced result list.
    await page.getByPlaceholder('Search courses').fill(SEARCH_QUERY)
    // SearchRow renders the course as a button whose accessible name
    // includes the course name; click the first match.
    await page
      .getByRole('button', { name: new RegExp(COURSE_NAME, 'i') })
      .first()
      .click()

    // Confirmation text after select.
    await expect(
      page.getByText(new RegExp(`Selected: ${COURSE_NAME}`, 'i')),
    ).toBeVisible()

    await page.getByRole('button', { name: /Start round/i }).click()

    // Past mode lands on /rounds/:uuid (scorecard view, no ?view=map).
    await page.waitForURL(/\/rounds\/[0-9a-f-]{36}/i, { timeout: 15_000 })
    const match = page.url().match(/\/rounds\/([0-9a-f-]{36})/i)
    expect(match).toBeTruthy()
    createdRoundId = match![1]
  })
})
