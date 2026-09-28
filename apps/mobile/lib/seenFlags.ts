import AsyncStorage from '@react-native-async-storage/async-storage'

// First-run "seen" flags (intro tour, coach marks, aim hint) are per account,
// so a second player signing in on the same phone still gets the tour and
// tips. Stored key = `<legacy key>.<userId>`.
//
// Migration: these flags used to be device-wide (the bare legacy key). The
// first account to read a legacy '1' inherits it — an existing player isn't
// re-shown tips after the update — and the legacy key is then removed, so
// no other account on the device inherits it too.
//
// Storage errors read as "seen" (don't nag).
export async function seenFlags(userId: string, keys: string[]): Promise<boolean[]> {
  try {
    const own = keys.map((k) => `${k}.${userId}`)
    const got = await AsyncStorage.multiGet([...own, ...keys])
    const legacy = keys.filter((_, i) => got[keys.length + i]?.[1] === '1')
    if (legacy.length) {
      await AsyncStorage.multiSet(legacy.map((k) => [`${k}.${userId}`, '1']))
      await AsyncStorage.multiRemove(legacy)
    }
    return keys.map((_, i) => got[i]?.[1] === '1' || got[keys.length + i]?.[1] === '1')
  } catch {
    return keys.map(() => true)
  }
}

export async function markSeenFlags(userId: string, keys: string[]): Promise<void> {
  try {
    await AsyncStorage.multiSet(keys.map((k) => [`${k}.${userId}`, '1']))
  } catch {
    /* noop */
  }
}
