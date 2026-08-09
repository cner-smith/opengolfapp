import AsyncStorage from '@react-native-async-storage/async-storage'

// On-device "seen the first-run tour" flag. Separate from the server-side
// profiles.onboarding_completed gate (keeps it out of that write path) and
// versioned in the key so a redesigned tour can re-show without a migration.
const KEY = 'oga.intro-tour-seen-v1'

export async function introTourSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1'
  } catch {
    return true // on storage error, don't nag
  }
}
export async function markIntroTourSeen(): Promise<void> {
  try { await AsyncStorage.setItem(KEY, '1') } catch { /* noop */ }
}
