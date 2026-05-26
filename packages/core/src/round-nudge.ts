import type { ShotCategory } from './constants'

/** The four strokes-gained categories the nudge can target (subset of ShotCategory). */
export type NudgeCategory = 'off_tee' | 'approach' | 'around_green' | 'putting'

export interface RoundFocus {
  category: NudgeCategory
  /** The (negative) SG value for that category this round. */
  sgDelta: number
}

/** Minimal round shape: only the per-category SG columns. */
export interface RoundFocusInput {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
}

// Only nudge when a category is a clear leak — avoids nagging on a balanced
// round ("cost you 0.2 strokes" is noise). Product choice; tune freely.
const NUDGE_THRESHOLD = -0.5

// Order = tie-break priority (first wins an exact tie): cheapest strokes to
// recover first.
const NUDGE_COLUMNS = [
  { key: 'sg_putting', category: 'putting' },
  { key: 'sg_approach', category: 'approach' },
  { key: 'sg_around_green', category: 'around_green' },
  { key: 'sg_off_tee', category: 'off_tee' },
] as const satisfies ReadonlyArray<{ key: keyof RoundFocusInput; category: NudgeCategory }>

export function pickRoundFocus(round: RoundFocusInput): RoundFocus | null {
  let worst: RoundFocus | null = null
  for (const { key, category } of NUDGE_COLUMNS) {
    const v = round[key]
    if (v == null) continue
    if (worst === null || v < worst.sgDelta) worst = { category, sgDelta: v }
  }
  if (worst === null || worst.sgDelta > NUDGE_THRESHOLD) return null
  return worst
}

const FOCUS_LABEL: Record<NudgeCategory, string> = {
  off_tee: 'Off the tee',
  approach: 'Approach',
  around_green: 'Around the green',
  putting: 'Putting',
}

export function roundFocusHeadline(focus: RoundFocus): string {
  const strokes = Math.abs(focus.sgDelta).toFixed(1)
  return `${FOCUS_LABEL[focus.category]} cost you about ${strokes} strokes this round.`
}

/** Keep drills doable at the player's facilities (empty facility = anywhere), cap at `limit`. */
export function selectNudgeDrills<T extends { facility: string[] | null }>(
  drills: T[],
  facilities: string[],
  limit = 2,
): T[] {
  return drills
    .filter(
      (drill) =>
        !drill.facility ||
        drill.facility.length === 0 ||
        drill.facility.some((f) => facilities.includes(f)),
    )
    .slice(0, limit)
}

// Compile-time check that every NudgeCategory is a real ShotCategory.
const _categoryCheck: Record<NudgeCategory, ShotCategory> = {
  off_tee: 'off_tee',
  approach: 'approach',
  around_green: 'around_green',
  putting: 'putting',
}
void _categoryCheck
