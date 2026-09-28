import AsyncStorage from '@react-native-async-storage/async-storage'

// Persistent read cache for reopening the app without signal (#993). The
// SQLite queue (lib/db.ts) covers writes; this covers the reads a cold start
// needs to get back into a live round: the profile gate, the Home resume
// banner, and the live round's loadAll + per-hole shots. Consumers fall back
// to it ONLY on a network failure — a real error (RLS, missing row, 5xx)
// still surfaces.
//
// Every key carries the user id, so another account on the same device never
// reads it. Size: one active round (≈18 holes + scores + tees + a few shots
// per hole) is tens of KB, well under AsyncStorage's 6 MB Android default;
// dropRoundCaches keeps it to that one round.
export const offlineKeys = {
  onboarded: (userId: string) => `oga.onboarded.${userId}`,
  activeRound: (userId: string) => `oga.activeRound.${userId}`,
  round: (userId: string, roundId: string) => `oga.roundData.${userId}.${roundId}`,
  holeShots: (userId: string, roundId: string, holeScoreId: string) =>
    `oga.holeShots.${userId}.${roundId}.${holeScoreId}`,
}

// postgrest-js resolves a failed fetch in-band as status 0 with message
// `${err.name}: ${err.message}` — RN's fetch rejects with "TypeError: Network
// request failed" (or "... timed out"); an aborted request is "AbortError: …".
// Thrown fetch errors carry the same text in .message.
export function isNetworkFailure(err: unknown, status?: number): boolean {
  if (status === 0) return true
  const message = (err as { message?: unknown } | null)?.message
  return typeof message === 'string' && /Network request (failed|timed out)|^AbortError/.test(message)
}

export async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export async function writeCache(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* a failed cache write only costs the offline fallback */
  }
}

// Drops the cached round data (loadAll payload + hole shots) and the cached
// resume banner for every round of this user that `drop` selects.
export async function dropRoundCaches(
  userId: string,
  drop: (roundId: string) => boolean,
): Promise<void> {
  try {
    const prefixes = [`oga.roundData.${userId}.`, `oga.holeShots.${userId}.`]
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => {
      const prefix = prefixes.find((p) => k.startsWith(p))
      return prefix != null && drop(k.slice(prefix.length).split('.')[0] ?? '')
    })
    const active = await readCache<{ id: string }>(offlineKeys.activeRound(userId))
    if (active && drop(active.id)) keys.push(offlineKeys.activeRound(userId))
    if (keys.length) await AsyncStorage.multiRemove(keys)
  } catch {
    /* noop */
  }
}
