import * as SQLite from 'expo-sqlite'
import type { Database } from '@oga/supabase'

export type ShotPayload = Database['public']['Tables']['shots']['Insert']

export interface PendingShot {
  local_id: number
  remote_id: string | null
  status: 'pending' | 'synced'
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
      return db
    })()
  }
  return dbPromise
}

export async function insertPendingShot(payload: ShotPayload): Promise<number> {
  const db = await getDb()
  const result = await db.runAsync(
    `INSERT INTO pending_shots (status, payload, created_at) VALUES ('pending', ?, ?)`,
    JSON.stringify(payload),
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

export async function deletePendingShot(localId: number): Promise<void> {
  const db = await getDb()
  await db.runAsync(`DELETE FROM pending_shots WHERE local_id = ?`, localId)
}

export async function pendingCount(): Promise<number> {
  const db = await getDb()
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM pending_shots WHERE status = 'pending'`,
  )
  return row?.count ?? 0
}

export async function pendingShotsForHoleScore(holeScoreId: string): Promise<PendingShot[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<PendingShot>(
    `SELECT * FROM pending_shots WHERE status = 'pending' ORDER BY created_at ASC`,
  )
  return rows.filter((r) => {
    try {
      const p = JSON.parse(r.payload) as ShotPayload
      return p.hole_score_id === holeScoreId
    } catch {
      return false
    }
  })
}
