import { AppState, type AppStateStatus } from 'react-native'
import { uuid } from 'expo-modules-core'
import * as SQLite from 'expo-sqlite'
import type { Database } from '@oga/supabase'

export type ShotPayload = Database['public']['Tables']['shots']['Insert']

export interface PendingShot {
  local_id: number
  remote_id: string | null
  // 'broken' = quarantined so sync stops retrying it forever: either
  // JSON.parse(payload) failed (#292) or the server deterministically
  // rejects the row — constraint/data-class errors that no retry can
  // fix (#652). All reads filter `WHERE status = 'pending'` so broken
  // rows become invisible to consumers. There's intentionally no CHECK
  // constraint on this column — CREATE TABLE IF NOT EXISTS skips on
  // existing installs, so a CHECK can't be retro-applied. The
  // TypeScript union is the gate.
  status: 'pending' | 'synced' | 'broken'
  payload: string
  created_at: number
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null

function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('oga.db')
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_shots (
          local_id INTEGER PRIMARY KEY AUTOINCREMENT,
          remote_id TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `)
      // Purge rows that finished syncing in a previous session — nothing
      // ever deleted them, so the table grew unbounded (#652). Synced rows
      // are only read back within a session (setPendingShotEnd patches a
      // just-synced shot's end coords via remote_id), and that path keys
      // off an in-memory ref that doesn't survive a restart, so rows from
      // prior sessions are pure dead weight. 'broken' rows are kept as
      // diagnostic evidence; they're rare by construction.
      await db.runAsync(`DELETE FROM pending_shots WHERE status = 'synced'`)
      return db
    })()
  }
  return dbPromise
}

export async function insertPendingShot(payload: ShotPayload): Promise<number> {
  const db = await getDb()
  // Client-generated PK (#652). The shots table defaults to
  // gen_random_uuid(), but a server-assigned id means a retried insert
  // whose first attempt committed with a lost response creates a
  // duplicate shot. Baking the id in at creation makes every sync
  // attempt for this row idempotent — and keeps it stable through
  // setPendingShotEnd's payload rewrites.
  const withId: ShotPayload = payload.id ? payload : { ...payload, id: uuid.v4() }
  const result = await db.runAsync(
    `INSERT INTO pending_shots (status, payload, created_at) VALUES ('pending', ?, ?)`,
    JSON.stringify(withId),
    Date.now(),
  )
  return result.lastInsertRowId
}

export async function listPendingShots(): Promise<PendingShot[]> {
  const db = await getDb()
  return db.getAllAsync<PendingShot>(
    `SELECT * FROM pending_shots WHERE status = 'pending' ORDER BY created_at ASC`,
  )
}

export async function markShotSynced(localId: number, remoteId: string): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE pending_shots SET status = 'synced', remote_id = ? WHERE local_id = ?`,
    remoteId,
    localId,
  )
}

// Quarantine a poisoned pending row so sync stops retrying it forever.
// Set when JSON.parse(row.payload) throws (#292) or when the server
// permanently rejects the row — constraint/data-class errors a retry
// can never fix (#652). The `WHERE status = 'pending'` filter on every
// read keeps broken rows out of subsequent passes. Internally
// try/catch'd so callers (which are already inside a failure path)
// can't have the real failure masked by a downstream marker-write
// failure — the original error log is what actually surfaces what went
// wrong.
export async function markShotBroken(localId: number): Promise<void> {
  try {
    const db = await getDb()
    await db.runAsync(
      `UPDATE pending_shots SET status = 'broken' WHERE local_id = ?`,
      localId,
    )
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[db/markShotBroken]', e)
  }
}

// Rewrites a pending row's payload in place. Sync uses this to persist a
// backfilled client id onto rows queued before insertPendingShot started
// generating ids (#652) — without the write-back, each sync pass would
// mint a fresh id and defeat the idempotency it exists to provide.
export async function updatePendingShotPayload(
  localId: number,
  payload: string,
): Promise<void> {
  const db = await getDb()
  await db.runAsync(
    `UPDATE pending_shots SET payload = ? WHERE local_id = ?`,
    payload,
    localId,
  )
}

export async function pendingCount(): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_shots WHERE status = 'pending'`,
  )
  return row?.count ?? 0
}

/**
 * Fills in `end_lat`/`end_lng` on a previously-saved shot. Used when
 * the player marks the ball for shot N+1 — that position is the
 * landing of shot N. Returns the row's sync state so the caller can
 * also patch the remote row when it has already been synced.
 */
export async function setPendingShotEnd(
  localId: number,
  lat: number,
  lng: number,
): Promise<{ status: 'pending' | 'synced'; remote_id: string | null } | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<PendingShot>(
    `SELECT * FROM pending_shots WHERE local_id = ?`,
    localId,
  )
  if (!row) return null
  // Quarantined rows (set by an earlier parse-fail in this fn or by
  // sync.ts) carry corrupt data; caller has nothing meaningful to do
  // with them. Treat as "not found".
  if (row.status === 'broken') return null
  if (row.status === 'pending') {
    let payload: ShotPayload
    try {
      payload = JSON.parse(row.payload)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(
        '[db/payload-corrupt] local_id=%d msg=%s',
        localId,
        (e as Error).message,
      )
      await markShotBroken(localId)
      return null
    }
    payload.end_lat = lat
    payload.end_lng = lng
    await db.runAsync(
      `UPDATE pending_shots SET payload = ? WHERE local_id = ?`,
      JSON.stringify(payload),
      localId,
    )
  }
  return { status: row.status, remote_id: row.remote_id }
}

// Flush WAL frames to the main DB file when the app moves to the
// background. expo-sqlite 14 keeps writes in -wal until checkpointed,
// and a long-running session can grow the WAL file unbounded — frames
// are also at risk if the OS kills the process before the next implicit
// checkpoint. PASSIVE skips when readers hold the lock so a backgrounded
// app can't stall a foregrounded one.
//
// globalThis guard so Metro Fast Refresh / bundle reload doesn't stack
// duplicate listeners across the dev session. Module-scoped flags reset
// on bundle eval; globalThis survives.
declare global {
  // eslint-disable-next-line no-var
  var __ogaWalCheckpointInstalled: boolean | undefined
}
if (!globalThis.__ogaWalCheckpointInstalled) {
  globalThis.__ogaWalCheckpointInstalled = true
  AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState !== 'background' && nextState !== 'inactive') return
    void (async () => {
      try {
        const db = await getDb()
        await db.execAsync('PRAGMA wal_checkpoint(PASSIVE);')
      } catch (e) {
        // PASSIVE returns SQLITE_LOCKED if another statement on the
        // connection is mid-execution at the moment AppState fires.
        // Expected and recoverable — the next AppState transition or
        // the implicit auto-checkpoint will flush. Don't log the noise.
        if ((e as Error)?.message?.includes('locked')) return
        // eslint-disable-next-line no-console
        console.error('[db/wal_checkpoint]', e)
      }
    })()
  })
}

export async function pendingShotsForHoleScore(holeScoreId: string): Promise<PendingShot[]> {
  const db = await getDb()
  // Push the hole-score filter into SQLite via json_extract — previously
  // every call pulled the entire pending queue and JS-filtered, which
  // re-parsed every payload on every hole change.
  return db.getAllAsync<PendingShot>(
    `SELECT * FROM pending_shots
     WHERE status = 'pending'
       AND json_extract(payload, '$.hole_score_id') = ?
     ORDER BY created_at ASC`,
    holeScoreId,
  )
}
