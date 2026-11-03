import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Throwaway DEV courses (#727), created per test and deleted after with their rounds.
const MAPPED_NINE = 'Oga E2e Nine Hole Mapped 727'
const UNMAPPED = 'Oga E2e Nine Hole Unmapped 727'
const RATED = 'Oga E2e Rated Short Course 727'
const MAPPED_EIGHTEEN = 'Oga E2e Eighteen Hole Mapped 727'

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
  return data.id
}

async function startPastRound(page: Page, name: string, holes?: string, other?: string) {
  await page.goto('/rounds/new')
  await page.getByRole('radio', { name: /After the fact/i }).click()
  await page.getByPlaceholder('Search courses').fill(name)
  await page.getByRole('button', { name: new RegExp(name, 'i') }).first().click()
  await expect(page.getByRole('region', { name: 'Course' }).getByText(name, { exact: true })).toBeVisible()
  const keys = page.getByRole('radiogroup', { name: 'Holes' })
  if (holes) await keys.getByRole('radio', { name: holes, exact: true }).click()
  if (other) await page.getByLabel('Number of holes').fill(other)
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

  test('6 on a course with 18 holes on file shows only holes 1–6', async ({ page }) => {
    await createCourse(MAPPED_EIGHTEEN, 18)
    await startPastRound(page, MAPPED_EIGHTEEN, '6')
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel('Hole 6 score')).toBeVisible({ timeout: 15_000 })
    await expect(card.getByLabel('Hole 7 score')).toHaveCount(0)
  })

  test('Other takes any count: 5 holes shows exactly 5', async ({ page }) => {
    await createCourse(UNMAPPED, 0)
    await startPastRound(page, UNMAPPED, 'Other', '5')
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel('Hole 5 score')).toBeVisible({ timeout: 15_000 })
    await expect(card.getByLabel('Hole 6 score')).toHaveCount(0)
    const roundId = page.url().match(/\/rounds\/([0-9a-f-]{36})/i)![1]
    const { data } = await admin.from('rounds').select('hole_count').eq('id', roundId).single()
    expect(data?.hole_count).toBe(5)
  })

  // A rated white tee (the round's default colour) so a whole 9 or 18 gets a differential.
  async function playRated(page: Page, holes: number, key?: string, opts: { rows?: number; scored?: number } = {}) {
    const id = await createCourse(RATED, opts.rows ?? 0)
    const { error } = await admin
      .from('course_tees')
      .insert({ course_id: id, tee_color: 'white', par: 4 * holes, course_rating: 4 * holes - 1, slope_rating: 113 })
    if (error) throw error
    await startPastRound(page, RATED, key)
    const card = page.getByRole('region', { name: 'Your card' })
    await expect(card.getByLabel(`Hole ${holes} score`)).toBeVisible({ timeout: 15_000 })
    await expect(card.getByLabel(`Hole ${holes + 1} score`)).toHaveCount(0)
    const scored = opts.scored ?? holes
    for (let n = 1; n <= scored; n++) {
      await card.getByLabel(`Hole ${n} score`).fill('5')
      await card.getByLabel(`Hole ${n} score`).blur()
      await expect(card.getByLabel(`Hole ${n} par 4, click to change`)).toBeVisible()
    }
    const roundId = page.url().match(/\/rounds\/([0-9a-f-]{36})/i)![1]
    // Every score saved before the round is finished.
    await expect
      .poll(async () => {
        const { data } = await admin.from('hole_scores').select('score').eq('round_id', roundId).gt('score', 0)
        return data?.length
      }, { timeout: 15_000 })
      .toBe(scored)
    await page.getByRole('button', { name: /^(Save SG|Recalculate SG)$/ }).first().click()
    await expect
      .poll(async () => {
        const { data } = await admin.from('rounds').select('completed_at').eq('id', roundId).single()
        return data?.completed_at != null
      }, { timeout: 15_000 })
      .toBe(true)
    const { data } = await admin
      .from('rounds')
      .select('hole_count, total_score, score_differential')
      .eq('id', roundId)
      .single()
    return data!
  }

  test('a whole 9 on a rated tee gets a handicap differential (control)', async ({ page }) => {
    const r = await playRated(page, 9)
    expect(r).toMatchObject({ hole_count: 9, total_score: 45 })
    expect(r.score_differential).not.toBeNull()
  })

  test('a 6-hole round shows exactly 6, finishes with its total, and gets no differential', async ({ page }) => {
    const r = await playRated(page, 6, '6')
    expect(r).toMatchObject({ hole_count: 6, total_score: 30, score_differential: null })
  })

  test('an 18 ended after nine gets no differential, though the course has only those nine rows', async ({ page }) => {
    // Before #727 the gate read the course's rows (9) and took nine holes as a whole round.
    const r = await playRated(page, 18, '18', { rows: 9, scored: 9 })
    expect(r).toMatchObject({ hole_count: 18, total_score: 45, score_differential: null })
  })
})
