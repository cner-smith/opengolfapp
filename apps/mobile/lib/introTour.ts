import { markSeenFlags, seenFlags } from './seenFlags'

// Per-account "seen the first-run tour" flag (see seenFlags). Separate from
// the server-side profiles.onboarding_completed gate (keeps it out of that
// write path) and versioned in the key so a redesigned tour can re-show
// without a migration.
const KEY = 'oga.intro-tour-seen-v1'

export async function introTourSeen(userId: string): Promise<boolean> {
  return (await seenFlags(userId, [KEY]))[0] ?? true
}
export async function markIntroTourSeen(userId: string): Promise<void> {
  await markSeenFlags(userId, [KEY])
}
