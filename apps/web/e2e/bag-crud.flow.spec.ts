import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const E2E_USER_ID = 'd49b00a3-0486-4c47-814f-f4d16bffed0c'

const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

// Pick a stable known club from the seeded default bag to delete and
// then restore. Lob Wedge is last in DEFAULT_BAG (sort_order 12) and
// uniquely typed, so we can identify it without ambiguity.
const TARGET = {
  club_type: 'lw',
  name: 'Lob Wedge',
  sort_order: 12,
}

test.describe('Bag: delete then restore (signed in, mutating)', () => {
  test.afterEach(async () => {
    // Best-effort restore — covers happy path and failed-mid-test path.
    await admin
      .from('user_clubs')
      .delete()
      .eq('user_id', E2E_USER_ID)
      .eq('club_type', TARGET.club_type)
    await admin.from('user_clubs').insert({
      user_id: E2E_USER_ID,
      club_type: TARGET.club_type,
      name: TARGET.name,
      sort_order: TARGET.sort_order,
      in_bag: true,
    })
  })

  test('delete a club via row delete button + confirm dialog', async ({
    page,
  }) => {
    await page.goto('/settings/bag')

    // Sanity: 14 drag handles before delete.
    const dragHandles = page.getByRole('button', { name: /Drag to reorder/i })
    await expect(dragHandles).toHaveCount(14)

    // Per-row delete uses aria-label "Delete {name}".
    await page.getByRole('button', { name: 'Delete Lob Wedge' }).click()

    // ConfirmDialog opens with title "Delete Lob Wedge?". Confirm
    // button text in destructive mode is exactly the confirmLabel,
    // which BagPage sets to "Delete".
    await expect(
      page.getByRole('dialog').getByRole('heading'),
    ).toHaveCount(0) // dialog uses font-serif div, not <h*>
    await expect(page.getByText('Delete Lob Wedge?')).toBeVisible()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^Delete$/i })
      .click()

    // Row removed; count drops to 13.
    await expect(dragHandles).toHaveCount(13)
  })
})
