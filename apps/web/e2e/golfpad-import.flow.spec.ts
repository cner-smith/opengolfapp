import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Invented Golf Pad export (fixtures/golfpad, Windows-1252 like the real thing): three rounds on
// "Pine Ridge Golf Club" (matches a DEV course by name), "Whistling Straits - Straits Course" (no
// match until searched) and "Nowhere Municipal" (skipped).
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/golfpad')
const FILES = ['rounds.csv', 'holes.csv', 'shots.csv'].map((f) => path.join(dir, f))
const CODES = ['GPE2E1', 'GPE2E2', 'GPE2E3']

const cleanup = () => admin.from('rounds').delete().in('import_id', CODES)

test.describe('Golf Pad import (signed in, mutating)', () => {
  test.beforeEach(cleanup)
  test.afterEach(cleanup)

  test('drop the export → confirm, change and skip courses → rounds land with SG', async ({ page }) => {
    await page.goto('/rounds/import')
    await page.getByRole('button', { name: 'Golf Pad' }).click()
    await page.getByLabel('Golf Pad export files').setInputFiles(FILES)

    const pine = page.getByRole('region', { name: 'Pine Ridge Golf Club' })
    await expect(pine.getByText(/Match: Pine Ridge Golf Club/)).toBeVisible({ timeout: 15_000 })
    await pine.getByRole('button', { name: 'Use this course' }).click()

    const straits = page.getByRole('region', { name: 'Whistling Straits - Straits Course' })
    await expect(straits.getByText('No match found')).toBeVisible()
    await straits.getByRole('button', { name: 'Choose a course' }).click()
    await straits.getByPlaceholder('Search courses').fill('Whistling Straits')
    await straits.getByRole('button', { name: /Whistling Straits/ }).first().click()

    const importButton = page.getByRole('button', { name: /^Import \d+ rounds?$/ })
    await expect(importButton).toBeDisabled()
    await page.getByRole('region', { name: 'Nowhere Municipal' }).getByRole('button', { name: 'Skip' }).click()

    await expect(importButton).toHaveText('Import 2 rounds')
    await importButton.click()
    await expect(page.getByText('Imported 2 rounds')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Nowhere Municipal.*course skipped/)).toBeVisible()

    const { data: rounds } = await admin
      .from('rounds')
      .select('import_id, completed_at, sg_total, courses(name), hole_scores(score, par, holes(number), shots(shot_number, club, putt_distance_ft))')
      .in('import_id', CODES)
      .order('import_id')
    expect(rounds?.map((r) => [r.import_id, (r.courses as { name: string } | null)?.name])).toEqual([
      ['GPE2E1', 'Pine Ridge Golf Club'],
      ['GPE2E2', 'Whistling Straits'],
    ])
    for (const r of rounds ?? []) {
      expect(r.completed_at).toEqual(expect.any(String))
      expect(r.sg_total).toEqual(expect.any(Number))
    }
    type Hs = { score: number; holes: { number: number } | null; shots: { shot_number: number; club: string | null; putt_distance_ft: number | null }[] }
    const pineHoles = (rounds![0]!.hole_scores as Hs[]).sort((a, b) => a.holes!.number - b.holes!.number)
    expect(pineHoles.map((h) => [h.holes!.number, h.score, h.shots.length])).toEqual([
      [1, 4, 4],
      [2, 5, 0], // two shot rows for a score of 5: scores only
    ])
    const shots = pineHoles[0]!.shots.sort((a, b) => a.shot_number - b.shot_number)
    // "52° wedge" survives the Windows-1252 file; putts read in feet.
    expect(shots.map((s) => [s.club, s.putt_distance_ft])).toEqual([
      ['driver', null],
      ['gw', null],
      ['putter', 30],
      ['putter', 3],
    ])
  })
})
