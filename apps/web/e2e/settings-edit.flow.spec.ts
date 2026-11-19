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
      page.getByRole('heading', { level: 1, name: 'Profile' }),
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

test.describe('Settings: a plus handicap (signed in, mutating)', () => {
  test.afterEach(async () => {
    await admin
      .from('profiles')
      .update({ handicap_index: ORIGINAL_HANDICAP })
      .eq('id', E2E_USER_ID)
  })

  const storedIndex = async () => {
    const { data } = await admin
      .from('profiles')
      .select('handicap_index')
      .eq('id', E2E_USER_ID)
      .single()
    return data?.handicap_index
  }

  test('the toggle asks first, then saves a plus 2 that reads back as +2.0', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^Handicap index/ }).click()
    const toggle = page.getByRole('button', { name: 'Plus handicap' })
    const question = page.getByRole('group', { name: 'Turn on plus handicap?' })

    // A regular handicap: the first turn-on asks, and Cancel leaves it off.
    await toggle.click()
    await expect(question).toContainText('better than scratch')
    await question.getByRole('button', { name: 'Cancel' }).click()
    await expect(question).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')

    await toggle.click()
    await question.getByRole('button', { name: 'Turn on' }).click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.getByLabel('Handicap index').fill('2')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    expect(await storedIndex()).toBe(-2)

    await page.reload()
    const row = page.getByRole('button', { name: /^Handicap index/ })
    await expect(row).toContainText('+2.0')
    await row.click()
    await expect(page.getByLabel('Handicap index')).toHaveValue('2.0')
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // Already a plus handicap: off and on again does not ask.
    await toggle.click()
    await toggle.click()
    await expect(question).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  })

  test('a typed "+" asks through the same question and keeps the number alone', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^Handicap index/ }).click()
    const field = page.getByLabel('Handicap index')
    await field.fill('+3')
    await expect(field).toHaveValue('3')
    const question = page.getByRole('group', { name: 'Turn on plus handicap?' })
    await question.getByRole('button', { name: 'Turn on' }).click()
    await expect(page.getByRole('button', { name: 'Plus handicap' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved.', { exact: true })).toBeVisible()
    expect(await storedIndex()).toBe(-3)
  })
})
