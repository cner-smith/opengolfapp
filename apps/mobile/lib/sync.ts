import { listPendingShots, markShotSynced, type ShotPayload } from './db'
import { supabase } from './supabase'

// Module-scope lock that survives a Fast Refresh and prevents two
// concurrent syncPendingShots() calls from racing the same SQLite rows.
// A timestamp + TTL guards against the lock getting stuck `true` after a
// crash mid-flight: if the current process can't have been holding it
// for that long, we know it's stale and reset.
let inFlight = false
let inFlightSince: number | null = null
const LOCK_TTL_MS = 30_000
const CHUNK_SIZE = 50

function acquireLock(): boolean {
  if (inFlight) {
    if (inFlightSince != null && Date.now() - inFlightSince > LOCK_TTL_MS) {
      // eslint-disable-next-line no-console
      console.warn('[sync] stale lock detected, resetting')
      inFlight = false
      inFlightSince = null
    } else {
      return false
    }
  }
  inFlight = true
  inFlightSince = Date.now()
  return true
}

function releaseLock(): void {
  inFlight = false
  inFlightSince = null
}

export async function syncPendingShots(): Promise<{ synced: number; failed: number }> {
  if (!acquireLock()) return { synced: 0, failed: 0 }
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
    releaseLock()
  }
  return { synced, failed }
}
