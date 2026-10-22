import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// E2E user id (cner.smith+oga-e2e@gmail.com on the oga-dev project).
// Stable per the seed; hardcoded so afterEach can run even if the test
// never reached the point of capturing it.
const E2E_USER_ID = 'd49b00a3-0486-4c47-814f-f4d16bffed0c'
const ORIGINAL_HANDICAP = 12.4

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

test.describe('Settings: edit handicap (signed in, mutating)', () => {
  test.afterEach(async () => {
    await admin
      .from('profiles')
      .update({ handicap_index: ORIGINAL_HANDICAP })
      .eq('id', E2E_USER_ID)
  })

  test('change handicap, save, reload, persists', async ({ page }) => {
    await page.goto('/settings')
    await expect(
      page.getByRole('heading', { name: /^Settings$/i }),
    ).toBeVisible()

    const row = page.getByRole('button', { name: /^Handicap index/ })
    await expect(row).toContainText(String(ORIGINAL_HANDICAP))
    await row.click()
    await page.getByLabel('Handicap index').fill('13.5')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('button', { name: /^Handicap index/ })).toContainText('13.5')
  })
})
