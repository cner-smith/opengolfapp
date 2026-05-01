import { listPendingShots, markShotSynced, type ShotPayload } from './db'
import { supabase } from './supabase'

let inFlight = false

const CHUNK_SIZE = 50

export async function syncPendingShots(): Promise<{ synced: number; failed: number }> {
  if (inFlight) return { synced: 0, failed: 0 }
  inFlight = true
  let synced = 0
  let failed = 0
  try {
    const pending = await listPendingShots()
    for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
      const chunk = pending.slice(i, i + CHUNK_SIZE)
      const payloads: ShotPayload[] = []
      for (const row of chunk) {
        try {
          payloads.push(JSON.parse(row.payload) as ShotPayload)
        } catch {
          // Malformed pending payload — skip; the row stays pending and
          // will be retried (or hand-pruned) later.
        }
      }
      if (payloads.length === 0) {
        failed += chunk.length
        continue
      }
      const { data, error } = await supabase
        .from('shots')
        .insert(payloads)
        .select('id')
      if (error || !data || data.length !== payloads.length) {
        failed += chunk.length
        continue
      }
      // supabase-js returns inserted rows in input order, so we can map
      // each pending local_id to its remote id by index.
      for (let j = 0; j < chunk.length; j++) {
        const row = chunk[j]
        const remote = data[j]
        if (!row || !remote) {
          failed += 1
          continue
        }
        await markShotSynced(row.local_id, remote.id)
        synced += 1
      }
    }
  } finally {
    inFlight = false
  }
  return { synced, failed }
}
