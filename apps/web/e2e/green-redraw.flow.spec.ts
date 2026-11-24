import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { encodePolyline } from '@oga/core'

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const E2E_USER_ID = 'd49b00a3-0486-4c47-814f-f4d16bffed0c'

// Fix this green on the web (#1504): a throwaway one-hole course with our
// outline (a 30 m square around the pin, no survey), a round on it, and the
// player's redraw. Deleting the course takes the hole, green_maps and
// player_green_outlines rows with it; rounds go first (no cascade).
const PIN = { lat: 35.5, lng: -97.5 }
const D = 15 / 111_320
const DX = D / Math.cos((PIN.lat * Math.PI) / 180)
const ours = [
  { lat: PIN.lat - D, lng: PIN.lng - DX },
  { lat: PIN.lat - D, lng: PIN.lng + DX },
  { lat: PIN.lat + D, lng: PIN.lng + DX },
  { lat: PIN.lat + D, lng: PIN.lng - DX },
  { lat: PIN.lat - D, lng: PIN.lng - DX },
]

let courseId: string | null = null
let holeId = ''

async function openRedraw(page: Page) {
  const { data: c, error } = await admin.from('courses').insert({ name: 'Oga E2e Green Redraw 1504' }).select('id').single()
  if (error || !c) throw error ?? new Error('no course')
  courseId = c.id
  const { data: h, error: he } = await admin
    .from('holes')
    .insert({ course_id: c.id, number: 1, par: 4, pin_lat: PIN.lat, pin_lng: PIN.lng, tee_lat: PIN.lat - 0.003, tee_lng: PIN.lng })
    .select('id')
    .single()
  if (he || !h) throw he ?? new Error('no hole')
  holeId = h.id
  const { error: ge } = await admin
    .from('green_maps')
    .insert({ hole_id: h.id, outline: encodePolyline(ours), area_m2: 900, outline_source: 'osm' })
  if (ge) throw ge
  const { data: r, error: re } = await admin
    .from('rounds')
    .insert({ user_id: E2E_USER_ID, course_id: c.id, played_at: new Date().toISOString().slice(0, 10) })
    .select('id')
    .single()
  if (re || !r) throw re ?? new Error('no round')
  await page.goto(`/rounds/${r.id}?view=map`)
  await page.getByTestId('green-panel').getByRole('button', { name: /Look off\? Fix it/ }).click()
  const redraw = page.getByTestId('green-redraw')
  await expect(redraw.getByText('Click around the edge')).toBeVisible({ timeout: 15_000 })
  // The map fits our square; wait for its canvas before clicking.
  const canvas = redraw.locator('canvas.mapboxgl-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  await page.waitForTimeout(1500)
  const box = (await canvas.boundingBox())!
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  // Points in pixels from the map's centre (the pin).
  const click = async (pts: [number, number][]) => {
    for (const [x, y] of pts) {
      await page.mouse.click(cx + x, cy + y)
      await page.waitForTimeout(150)
    }
  }
  return { redraw, click }
}

test.describe('Fix this green on the web (signed in, mutating)', () => {
  test.afterEach(async () => {
    if (!courseId) return
    await admin.from('rounds').delete().eq('course_id', courseId)
    await admin.from('courses').delete().eq('id', courseId)
    courseId = null
  })

  test('four clicks and Enter save the player their own outline', async ({ page }) => {
    const { redraw, click } = await openRedraw(page)
    const save = redraw.getByRole('button', { name: /^Save/ })
    await click([[-60, -40], [60, -40], [60, 40]])
    await expect(save).toHaveText('Save (1 more)')
    await expect(save).toBeDisabled()
    await click([[-60, 40]])
    await expect(save).toBeEnabled()
    await page.keyboard.press('Enter')
    await expect(redraw.getByText('Yours now', { exact: false })).toBeVisible({ timeout: 15_000 })
    const { data } = await admin.from('player_green_outlines').select('user_id, outline').eq('hole_id', holeId)
    expect(data).toHaveLength(1)
    expect(data![0]!.user_id).toBe(E2E_USER_ID)
    await redraw.getByRole('button', { name: 'Back to the green' }).click()
    await expect(redraw).toHaveCount(0)
    await expect(page.getByTestId('green-panel').getByText('your outline', { exact: false })).toBeVisible()
  })

  test('a shape that crosses itself cannot be saved; Z undoes, Esc cancels', async ({ page }) => {
    const { redraw, click } = await openRedraw(page)
    const save = redraw.getByRole('button', { name: /^Save/ })
    // A bow-tie: top-left, bottom-right, top-right, bottom-left.
    await click([[-60, -40], [60, 40], [60, -40], [-60, 40]])
    await expect(redraw.getByText('It crosses itself · drag a point to fix it')).toBeVisible()
    await expect(save).toBeDisabled()
    await page.keyboard.press('Enter')
    await expect(redraw.getByText('Yours now', { exact: false })).toHaveCount(0)
    await page.keyboard.press('z')
    await expect(save).toHaveText('Save (1 more)')
    await expect(redraw.getByText('It crosses itself', { exact: false })).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(redraw).toHaveCount(0)
    const { data } = await admin.from('player_green_outlines').select('hole_id').eq('hole_id', holeId)
    expect(data).toHaveLength(0)
  })
})
