import { describe, expect, it, vi } from 'vitest'
import type { OgaSupabaseClient } from '../client'
import { setPrimaryIfNone } from './courses'

// Minimal fake covering only the chain shapes setPrimaryIfNone actually
// calls — not a general-purpose Supabase mock.
function fakeClient(existingPrimary: { id: string } | null) {
  const update = vi.fn((patch: { is_primary: boolean }) => ({
    eq: (_col: string, id: string) => ({
      select: () => ({
        single: async () => ({ data: { id, ...patch }, error: null }),
      }),
    }),
  }))
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: existingPrimary, error: null }),
          }),
        }),
      }),
      update,
    }),
  }
  return { client: client as unknown as OgaSupabaseClient, update }
}

describe('setPrimaryIfNone', () => {
  it('promotes the tee when the course has no primary yet', async () => {
    const { client, update } = fakeClient(null)
    const { data, error } = await setPrimaryIfNone(client, 'course-1', 'tee-1')
    expect(error).toBeNull()
    expect(data).toEqual({ id: 'tee-1', is_primary: true })
    expect(update).toHaveBeenCalledWith({ is_primary: true })
  })

  it('leaves the existing primary alone and does not write when one already exists', async () => {
    const { client, update } = fakeClient({ id: 'existing-tee' })
    const { data, error } = await setPrimaryIfNone(client, 'course-1', 'tee-1')
    expect(error).toBeNull()
    expect(data).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })
})
