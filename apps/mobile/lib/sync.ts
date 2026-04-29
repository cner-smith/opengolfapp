import { createShot } from '@oga/supabase'
import { listPendingShots, markShotSynced, type ShotPayload } from './db'
import { supabase } from './supabase'

let inFlight = false

export async function syncPendingShots(): Promise<{ synced: number; failed: number }> {
  if (inFlight) return { synced: 0, failed: 0 }
  inFlight = true
  let synced = 0
  let failed = 0
  try {
    const pending = await listPendingShots()
    for (const row of pending) {
      const payload = JSON.parse(row.payload) as ShotPayload
      const { data, error } = await createShot(supabase, payload)
      if (error || !data) {
        failed += 1
        continue
      }
      await markShotSynced(row.local_id, data.id)
      synced += 1
    }
  } finally {
    inFlight = false
  }
  return { synced, failed }
}
