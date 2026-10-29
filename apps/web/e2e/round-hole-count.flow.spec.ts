import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Throwaway DEV courses with no course_tees row (#727): one with holes 1–9 mapped, one with no
// holes at all. Created per test, deleted after with their rounds.
const MAPPED_NINE = 'Oga E2e Nine Hole Mapped 727'
const UNMAPPED = 'Oga E2e Nine Hole Unmapped 727'

let courseIds: string[] = []

async function createCourse(name: string, holes: number) {
  const { data, error } = await admin.from('courses').insert({ name }).select('id').single()
  if (error || !data) throw error ?? new Error('course insert returned no row')
  courseIds.push(data.id)
  if (holes > 0) {
    const rows = Array.from({ length: holes }, (_, i) => ({ course_id: data.id, number: i + 1, par: 4 }))
    const { error: holesError } = await admin.from('holes').insert(rows)
    if (holesError) throw holesError
  }
}

async function startPastRound(page: Page, name: string, holes?: '9' | '18') {
  await page.goto('/rounds/new')
  await page.getByRole('radio', { name: /After the fact/i }).click()
  await page.getByPlaceholder('Search courses').fill(name)
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click()
  await expect(page.getByRole('region', { name: 'Course' }).getByText(name, { exact: true })).toBeVisible()
  if (holes) await page.getByRole('radiogroup', { name: 'Holes' }).getByRole('radio', { name: holes }).click()
  await page.getByRole('button', { name: /Start round/i }).click()
  await page.waitForURL(/\/rounds\/[0-9a-f-]{36}/i, { timeout: 15_000 })
}

test.describe('Round hole count (signed in, mutating)', () => {
  test.afterEach(async () => {
    if (courseIds.length) {
      // rounds.course_id has no cascade: drop the rounds (→ hole_scores, shots) first.
      await admin.from('rounds').delete().in('course_id', courseIds)
      await admin.from('courses').delete().in('id', courseIds)
      courseIds = []
    }
  })

  test('a mapped 9-hole course with no tee row shows 9 holes, not 18', async ({ page }) => {
    await createCourse(MAPPED_NINE, 9)
    await startPastRound(page, MAPPED_NINE)
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel('Hole 9 score')).toBeVisible({ timeout: 15_000 })
    await expect(card.getByLabel('Hole 10 score')).toHaveCount(0)
  })

  test('an unmapped course played as 9 shows 9 holes and stores hole_count 9', async ({ page }) => {
    await createCourse(UNMAPPED, 0)
    await startPastRound(page, UNMAPPED, '9')
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel('Hole 9 score')).toBeVisible({ timeout: 15_000 })
    await expect(card.getByLabel('Hole 10 score')).toHaveCount(0)
    const roundId = page.url().match(/\/rounds\/([0-9a-f-]{36})/i)![1]
    const { data } = await admin.from('rounds').select('hole_count').eq('id', roundId).single()
    expect(data?.hole_count).toBe(9)
  })

  test('an unmapped course played as 18 keeps holes 10–18 after the front nine is saved', async ({ page }) => {
    await createCourse(UNMAPPED, 0)
    // Holes 1–9 already materialized by earlier play: the row count alone would now say 9.
    const { error } = await admin
      .from('holes')
      .insert(Array.from({ length: 9 }, (_, i) => ({ course_id: courseIds[0]!, number: i + 1, par: 4 })))
    if (error) throw error
    await startPastRound(page, UNMAPPED, '18')
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel('Hole 18 score')).toBeVisible({ timeout: 15_000 })
  })
})
