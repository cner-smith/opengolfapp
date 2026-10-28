import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Invented scorecards (fixtures/scorecard): an 18-hole and a 9-hole round on "Whistling Straits" (one
// DEV course by that name: pre-filled), then a blank line and a row with a bad score on line 5.
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/scorecard/scorecards.csv')
const IDS = ['scorecard:2024-03-02:whistling-straits', 'scorecard:2024-03-16:whistling-straits']

const cleanup = () => admin.from('rounds').delete().in('import_id', IDS)

async function chooseFileAndCourse(page: Page) {
  await page.getByRole('radio', { name: /^Scorecard CSV/ }).click()
  await page.getByLabel('Scorecard CSV file').setInputFiles(FILE)
  const straits = page.getByRole('region', { name: 'Whistling Straits' })
  await expect(straits.getByText(/Match: Whistling Straits · Sheboygan, WI/)).toBeVisible({ timeout: 15_000 })
  await straits.getByRole('button', { name: 'Use this course' }).click()
}

test.describe('Scorecard CSV import (signed in, mutating)', () => {
  test.beforeEach(cleanup)
  test.afterEach(cleanup)

  test('choose the file → the bad line is listed → confirm the course → the scores land', async ({ page }) => {
    await page.goto('/rounds/import')
    await page.getByRole('radio', { name: /^Scorecard CSV/ }).click()
    await page.getByLabel('Scorecard CSV file').setInputFiles(FILE)

    await expect(page.getByRole('heading', { name: '2 rounds found' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Lines not imported' }).getByRole('listitem')).toHaveText([
      'Line 5 · hole 2: “x” isn’t a score (a whole number from 1 to 20)',
    ])

    const straits = page.getByRole('region', { name: 'Whistling Straits' })
    await expect(straits.getByText('· 2 rounds')).toBeVisible()
    await expect(straits.getByText(/Match: Whistling Straits · Sheboygan, WI/)).toBeVisible({ timeout: 15_000 })
    const importButton = page.getByRole('button', { name: /^Import \d+ rounds?$/ })
    await expect(importButton).toBeDisabled()
    await straits.getByRole('button', { name: 'Use this course' }).click()
    await expect(importButton).toHaveText('Import 2 rounds')
    await importButton.click()

    await expect(page.getByRole('heading', { name: 'Imported 2 rounds' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Whistling Straits · 2024-03-02', { exact: true })).toBeVisible()
    await expect(page.getByText('Whistling Straits · 2024-03-16', { exact: true })).toBeVisible()

    const { data: rounds } = await admin
      .from('rounds')
      .select('import_id, played_at, tee_color, total_score, completed_at, courses(name), hole_scores(score, gir, putts, holes(number), shots(id))')
      .in('import_id', IDS)
      .order('import_id')
    type Hs = { score: number; gir: boolean | null; putts: number | null; holes: { number: number } | null; shots: { id: string }[] }
    expect(
      rounds?.map((r) => {
        const holes = (r.hole_scores as Hs[]).sort((a, b) => a.holes!.number - b.holes!.number)
        return {
          id: r.import_id,
          course: (r.courses as { name: string } | null)?.name,
          played_at: r.played_at,
          tee: r.tee_color,
          total: r.total_score,
          ended: typeof r.completed_at,
          scores: holes.map((h) => h.score).join(''),
          holes: holes.map((h) => h.holes!.number).join(','),
          // Scores only: nothing else is made up.
          extras: holes.filter((h) => h.gir != null || h.putts != null || h.shots.length > 0).length,
        }
      }),
    ).toEqual([
      {
        id: IDS[0], course: 'Whistling Straits', played_at: '2024-03-02', tee: 'white', total: 73, ended: 'string',
        scores: '453445345443544354', holes: '1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18', extras: 0,
      },
      {
        id: IDS[1], course: 'Whistling Straits', played_at: '2024-03-16', tee: 'white', total: 39, ended: 'string',
        scores: '544354464', holes: '1,2,3,4,5,6,7,8,9', extras: 0,
      },
    ])
  })

  test('importing the same file again skips both rounds as already imported and writes nothing', async ({ page }) => {
    await page.goto('/rounds/import')
    await chooseFileAndCourse(page)
    await page.getByRole('button', { name: 'Import 2 rounds' }).click()
    await expect(page.getByRole('heading', { name: 'Imported 2 rounds' })).toBeVisible({ timeout: 30_000 })
    const count = async () => {
      const { data } = await admin.from('rounds').select('id, hole_scores(id)').in('import_id', IDS)
      return [data?.length, data?.flatMap((r) => r.hole_scores).length]
    }
    expect(await count()).toEqual([2, 27])

    await page.getByLabel('Scorecard CSV file').setInputFiles(FILE)
    const straits = page.getByRole('region', { name: 'Whistling Straits' })
    await expect(straits.getByText(/Match: Whistling Straits · Sheboygan, WI/)).toBeVisible({ timeout: 15_000 })
    await straits.getByRole('button', { name: 'Use this course' }).click()
    await page.getByRole('button', { name: 'Import 2 rounds' }).click()
    await expect(page.getByRole('heading', { name: 'Imported 0 rounds' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Whistling Straits · 2024-03-02 — already imported')).toBeVisible()
    await expect(page.getByText('Whistling Straits · 2024-03-16 — already imported')).toBeVisible()
    expect(await count()).toEqual([2, 27])
  })

  test('the template downloads with its header and two example rows', async ({ page }) => {
    await page.goto('/rounds/import')
    await page.getByRole('radio', { name: /^Scorecard CSV/ }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download the template' }).click(),
    ])
    expect(download.suggestedFilename()).toBe('oga-scorecard-template.csv')
    const lines = (await readFile((await download.path())!, 'utf8')).trim().split('\n')
    expect(lines[0]).toBe('date,course,tee,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,total')
    expect(lines.slice(1).map((l) => l.split(',')[1])).toEqual([
      'Example Golf Club - delete this row',
      'Example Golf Club - delete this row',
    ])
  })
})
