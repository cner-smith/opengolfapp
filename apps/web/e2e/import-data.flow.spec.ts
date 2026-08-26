import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Same seeded, fully-loaded course new-round-past.flow.spec.ts relies on.
const COURSE_NAME = 'Pine Ridge Golf Club'

function payload() {
  return JSON.stringify({
    course_name: COURSE_NAME,
    played_at: '2026-06-01',
    total_score: 9,
    total_putts: 4,
    holes: [
      { number: 1, score: 4, putts: 2 },
      { number: 2, score: 5, putts: 2 },
    ],
  })
}

let createdRoundId: string | null = null

test.describe('Import from data (signed in, mutating)', () => {
  test.afterEach(async () => {
    if (createdRoundId) {
      // Cascades through hole_scores + shots via FK.
      await admin.from('rounds').delete().eq('id', createdRoundId)
      createdRoundId = null
    }
  })

  test('paste a valid payload → pick course → import → land on round detail', async ({
    page,
  }) => {
    await page.goto('/rounds/import')
    await expect(
      page.getByRole('heading', { name: /Import from data/i }),
    ).toBeVisible()

    await page.getByPlaceholder('{"played_at"').fill(payload())
    await expect(page.getByText(/Looks good/i)).toBeVisible()

    await page.getByRole('button', { name: /Continue/i }).click()

    // course_name hint pre-seeds CourseSearch verbatim (ImportDataPage
    // passes initialQuery={payload.course_name}).
    await expect(page.getByPlaceholder('Search courses')).toHaveValue(COURSE_NAME)
    await page
      .getByRole('button', { name: new RegExp(COURSE_NAME, 'i') })
      .first()
      .click()
    await expect(
      page.getByText(new RegExp(`Selected: ${COURSE_NAME}`, 'i')),
    ).toBeVisible()

    await page.getByRole('button', { name: /^Import round$/i }).click()

    await page.waitForURL(/\/rounds\/[0-9a-f-]{36}/i, { timeout: 15_000 })
    const match = page.url().match(/\/rounds\/([0-9a-f-]{36})/i)
    expect(match).toBeTruthy()
    createdRoundId = match![1]
  })
})
