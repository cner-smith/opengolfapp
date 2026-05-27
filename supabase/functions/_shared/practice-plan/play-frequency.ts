import type { PlayFrequency } from './types.ts'

const SESSIONS: Record<PlayFrequency, number> = {
  monthly: 1,
  weekly: 2,
  multi_weekly: 3,
  daily: 4,
}

/** Sessions/week + the plan validity window (D1, D5). Window is fixed 7 days. */
export function playFrequencyPlan(
  freq: PlayFrequency | null | undefined,
): { sessionCount: number; validityDays: number } {
  return { sessionCount: freq != null ? (SESSIONS[freq] ?? 2) : 2, validityDays: 7 }
}
