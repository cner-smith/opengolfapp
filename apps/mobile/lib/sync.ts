import { AppState } from 'react-native'
import { uuid } from 'expo-modules-core'
import NetInfo from '@react-native-community/netinfo'
import {
  listPendingShots,
  markShotBroken,
  markShotSynced,
  updatePendingShotPayload,
  type PendingShot,
  type ShotPayload,
} from './db'
import { supabase } from './supabase'

// Module-scope lock: the promise of the active run IS the lock. It
// prevents two concurrent runs from racing the same SQLite rows, and a
// second caller JOINS the in-flight run instead of getting a silent
// { synced: 0, failed: 0 } no-op — completeRound used to read that
// no-op as "queue drained" and finalize totals/SG over shots the
// concurrent save-triggered background sync was still inserting (#651).
// The timestamp + TTL guards against joining a zombie run (e.g. a fetch
// hung without a timeout): past the TTL a fresh run starts instead —
// same recovery the old boolean lock had.
let activeRun: Promise<SyncResult> | null = null
let activeRunSince = 0
const LOCK_TTL_MS = 30_000
const CHUNK_SIZE = 50
const RETRY_DELAY_MS = 2_000

type SyncResult = { synced: number; failed: number }

// Upsert on the client-generated PK (#652): a retry whose first attempt
// committed server-side but lost the response (course LTE) re-sends the
// same ids and lands on DO UPDATE instead of duplicating shots. The local
// payload is always the freshest copy of the row while it's pending, so
// the conflict-update path is a safe no-op-or-refresh. Shots RLS is a
// single FOR-ALL-own-rows policy, so the update arm passes.
async function insertChunk(payloads: ShotPayload[]) {
  return supabase.from('shots').upsert(payloads, { onConflict: 'id' }).select('id')
}

// Postgres class 22 (data exception) and 23 (integrity constraint —
// 23505 unique violation, 23503 FK violation) rejections are
// deterministic: the same payload gets the same refusal on every retry,
// so retrying forever just blocks the queue. Everything else — network
// drop (empty code), 5xx, expired-JWT PGRST301 — is treated as transient
// and stays pending; quarantining rows on an auth hiccup would eat the
// whole queue.
function isPermanentError(error: { code?: string } | null | undefined): boolean {
  const code = error?.code ?? ''
  return code.startsWith('22') || code.startsWith('23')
}

// Per-row fallback for a chunk the server permanently rejected (#652).
// Chunks insert atomically, so one poison row (e.g. 23505 on
// unique(hole_score_id, shot_number), FK gone after a web-side delete)
// used to fail all ≤50 rows — and every future sync pass — forever.
// Inserting one row at a time isolates the poison: deterministic
// rejections are quarantined, everything else syncs or stays pending.
async function syncRowsIndividually(
  rows: PendingShot[],
  payloads: ShotPayload[],
): Promise<{ synced: number; failed: number }> {
  let synced = 0
  let failed = 0
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j]
    const payload = payloads[j]
    if (!row || !payload?.id) {
      failed += 1
      continue
    }
    const { data, error } = await insertChunk([payload])
    if (!error && data && data.length === 1) {
      await markShotSynced(row.local_id, payload.id)
      synced += 1
    } else if (isPermanentError(error)) {
      // eslint-disable-next-line no-console
      console.error(
        '[sync/poison] quarantining local_id=%d code=%s msg=%s',
        row.local_id,
        error?.code,
        error?.message,
      )
      await markShotBroken(row.local_id)
      failed += 1
    } else {
      // Transient mid-fallback — leave pending for the next trigger.
      failed += 1
    }
  }
  return { synced, failed }
}

export function syncPendingShots(): Promise<SyncResult> {
  if (activeRun && Date.now() - activeRunSince <= LOCK_TTL_MS) {
    return activeRun
  }
  if (activeRun) {
    // eslint-disable-next-line no-console
    console.warn('[sync] stale run detected, starting fresh')
  }
  const run = runSync().finally(() => {
    // Only clear if a stale-run replacement hasn't already taken over.
    if (activeRun === run) activeRun = null
  })
  activeRun = run
  activeRunSince = Date.now()
  return run
}

async function runSync(): Promise<SyncResult> {
  let synced = 0
  let failed = 0
  const pending = await listPendingShots()
  for (let i = 0; i < pending.length; i += CHUNK_SIZE) {
    const chunk = pending.slice(i, i + CHUNK_SIZE)
    // Parallel arrays: payloads[j] parsed from validRows[j]. The
    // success loop below must map against validRows, NOT chunk — a
    // corrupt row skipped here would otherwise shift every later row
    // onto the wrong remote id (#652).
    const validRows: PendingShot[] = []
    const payloads: ShotPayload[] = []
    for (const row of chunk) {
      let payload: ShotPayload
      try {
        payload = JSON.parse(row.payload) as ShotPayload
      } catch (e) {
        // Malformed pending payload — quarantine so sync stops retrying
        // it forever on every reconnect (#292).
        // eslint-disable-next-line no-console
        console.error(
          '[db/payload-corrupt] local_id=%d msg=%s',
          row.local_id,
          (e as Error).message,
        )
        void markShotBroken(row.local_id)
        failed += 1
        continue
      }
      if (!payload.id) {
        // Rows queued before insertPendingShot started generating
        // client ids (#652): assign one and persist it so every future
        // retry re-sends the same PK instead of minting a fresh id.
        payload.id = uuid.v4()
        await updatePendingShotPayload(row.local_id, JSON.stringify(payload))
      }
      validRows.push(row)
      payloads.push(payload)
    }
    if (payloads.length === 0) continue
    let { data, error } = await insertChunk(payloads)
    if (error && !isPermanentError(error)) {
      // Single retry after a short delay. Transient network/server
      // hiccups (intermittent connectivity, brief 5xx) are common
      // mid-round; one retry covers most without burning bandwidth.
      // On second failure the chunk stays in the pending queue —
      // markShotSynced never runs, so rows will be picked up by the
      // next NetInfo reconnect / AppState foreground / manual call.
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
      const retry = await insertChunk(payloads)
      data = retry.data
      error = retry.error
    }
    if (error && isPermanentError(error)) {
      const perRow = await syncRowsIndividually(validRows, payloads)
      synced += perRow.synced
      failed += perRow.failed
      continue
    }
    if (error || !data) {
      // eslint-disable-next-line no-console
      console.warn('[sync] chunk failed after retry, leaving pending:', error?.message ?? 'no data')
      failed += validRows.length
      continue
    }
    // Reconcile by the client-generated id rather than trusting
    // response ordering — every payload carries its id by this point.
    const returnedIds = new Set(data.map((r) => r.id))
    for (let j = 0; j < validRows.length; j++) {
      const row = validRows[j]
      const payload = payloads[j]
      if (row && payload?.id && returnedIds.has(payload.id)) {
        await markShotSynced(row.local_id, payload.id)
        synced += 1
      } else {
        failed += 1
      }
    }
  }
  return { synced, failed }
}

// Auto-trigger sync on network reconnect and app foreground. Failures
// previously stayed in the pending queue forever with no automatic
// retry — a player who finished a round on a flaky connection would
// see "synced" never tick up. Listeners are global singletons; the
// guard lives on globalThis (not module scope) so Metro Fast Refresh
// / bundle reload doesn't stack duplicate listeners. Mirrors the
// db.ts WAL-checkpoint pattern.
declare global {
  // eslint-disable-next-line no-var
  var __ogaSyncInstalled: boolean | undefined
}

function fireAndForget() {
  syncPendingShots().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[sync] background trigger failed:', err)
  })
}

export function installAutoSync(): void {
  if (globalThis.__ogaSyncInstalled) return
  globalThis.__ogaSyncInstalled = true

  NetInfo.addEventListener((state) => {
    if (state.isConnected && state.isInternetReachable) {
      fireAndForget()
    }
  })

  AppState.addEventListener('change', (next) => {
    if (next === 'active') {
      fireAndForget()
    }
  })
}

installAutoSync()
