import { clubNoun } from './constants'
import type { ClubTypicalDistance, DistanceRange } from './shot-patterns'
import { distanceUnitAbbr, wholeDistance } from './shot-pattern-words'
import type { DistanceUnit } from './types'

// My Bag's gapping ladder: the step from each club to the next, where the bag
// has a hole or two clubs overlap, and the one sentence that leads the screen.

/** An empty stretch this wide (yards) between two neighbouring clubs is a hole.
 *  Yards in every unit, so a metres player sees the same holes. */
export const HOLE_YARDS = 20

export interface BagClub {
  clubType: string
  /** clubTypicalDistance's answer: the median of its shots or the player's
   *  estimate (source says which); null = no number yet. */
  typical: ClubTypicalDistance | null
  /** clubDistanceRange's answer; null when the club has too few shots. */
  range: DistanceRange | null
}

export interface BagGap<T extends BagClub = BagClub> {
  /** The neighbour with the bigger typical distance (the first on a tie). */
  longer: T
  shorter: T
  /** Typical distance minus typical distance, yards. */
  yards: number
  /**
   * Each club reaches from its range's bottom to its top, or only its typical
   * distance at an end with no range. 'hole': the shorter club's top is
   * HOLE_YARDS or more below the longer club's bottom. 'overlap': it is above
   * it. 'step': anything between. 'not measured': clubs with no number sit
   * between the two, so the ladder there is unknown, whatever the reaches say.
   */
  kind: 'hole' | 'overlap' | 'step' | 'not measured'
  /** Yards. A hole's empty stretch, an overlap's shared one, or the empty
   *  stretch of a not-measured gap; null for a step and for a not-measured
   *  gap whose reaches meet. */
  span: DistanceRange | null
  /** The clubs with no number between the two, in bag order. */
  unmeasured: T[]
}

export interface BagGaps<T extends BagClub = BagClub> {
  /** Every club passed in, in bag order, without the putter. */
  rungs: T[]
  /** One per pair of neighbours that both have a number, skipping the clubs
   *  without one (they go in the gap's `unmeasured`). */
  gaps: BagGap<T>[]
  /** The biggest typical-to-typical gap, not counting not-measured ones (the
   *  first on a tie); null when there is none. */
  widest: BagGap<T> | null
  /** Every rung with no number, in bag order. */
  unmeasured: T[]
  /** The lead sentence; null with fewer than two numbered clubs. */
  headline: string | null
}

/**
 * The bag's gaps, from its in-bag clubs in the player's order. The headline
 * is the first that applies: the biggest empty stretch of HOLE_YARDS or more
 * ("33 yd hole between your 7-iron and pitching wedge.", naming any clubs
 * with no number inside it), else the widest gap when it is HOLE_YARDS or
 * more ("47 yd between …, the widest gap in the bag."), else the bag's reach
 * ("Your driver to your lob wedge, 245 to 60 yd, with every gap under 20 yd.").
 */
export function bagGaps<T extends BagClub>(clubs: readonly T[], unit: DistanceUnit): BagGaps<T> {
  const rungs = clubs.filter((c) => c.clubType !== 'putter')
  const gaps: BagGap<T>[] = []
  let previous: T | null = null
  let between: T[] = []
  for (const c of rungs) {
    if (!c.typical) {
      between.push(c)
      continue
    }
    if (previous) gaps.push(gapBetween(previous, c, between))
    previous = c
    between = []
  }

  let widest: BagGap<T> | null = null
  for (const g of gaps) {
    if (g.kind !== 'not measured' && (!widest || g.yards > widest.yards)) widest = g
  }

  return {
    rungs,
    gaps,
    widest,
    unmeasured: rungs.filter((c) => !c.typical),
    headline: headline(rungs, gaps, widest, unit),
  }
}

function gapBetween<T extends BagClub>(a: T, b: T, unmeasured: T[]): BagGap<T> {
  const [longer, shorter] = b.typical!.yards > a.typical!.yards ? [b, a] : [a, b]
  const bottom = longer.range?.low ?? longer.typical!.yards
  const top = shorter.range?.high ?? shorter.typical!.yards
  const empty = bottom - top
  const kind: BagGap['kind'] =
    unmeasured.length > 0 ? 'not measured' : empty >= HOLE_YARDS ? 'hole' : empty < 0 ? 'overlap' : 'step'
  const span =
    kind === 'overlap'
      ? { low: bottom, high: top }
      : kind === 'hole' || (kind === 'not measured' && empty > 0)
        ? { low: top, high: bottom }
        : null
  return { longer, shorter, yards: longer.typical!.yards - shorter.typical!.yards, kind, span, unmeasured }
}

function headline<T extends BagClub>(
  rungs: T[],
  gaps: BagGap<T>[],
  widest: BagGap<T> | null,
  unit: DistanceUnit,
): string | null {
  if (gaps.length === 0) return null
  const u = distanceUnitAbbr(unit)
  const d = (yd: number) => wholeDistance(yd, unit)
  const pair = (g: BagGap<T>) => `your ${clubNoun(g.longer.clubType)} and ${clubNoun(g.shorter.clubType)}`

  let hole: BagGap<T> | null = null
  for (const g of gaps) {
    const size = g.span && g.kind !== 'overlap' ? g.span.high - g.span.low : 0
    if (size >= HOLE_YARDS && (!hole || size > hole.span!.high - hole.span!.low)) hole = g
  }
  if (hole) {
    const n = hole.unmeasured.length
    const where =
      n > 0 ? `, where your ${listWords(hole.unmeasured.map((c) => clubNoun(c.clubType)))} ${n === 1 ? 'has' : 'have'} no number yet` : ''
    return `${d(hole.span!.high - hole.span!.low)} ${u} hole between ${pair(hole)}${where}.`
  }
  if (widest && widest.yards >= HOLE_YARDS) {
    return `${d(widest.yards)} ${u} between ${pair(widest)}, the widest gap in the bag.`
  }
  const numbered = rungs.filter((c) => c.typical)
  let longest = numbered[0]!
  let shortest = numbered[0]!
  for (const c of numbered) {
    if (c.typical!.yards > longest.typical!.yards) longest = c
    if (c.typical!.yards < shortest.typical!.yards) shortest = c
  }
  return `Your ${clubNoun(longest.clubType)} to your ${clubNoun(shortest.clubType)}, ${d(longest.typical!.yards)} to ${d(shortest.typical!.yards)} ${u}, with every gap under ${d(HOLE_YARDS)} ${u}.`
}

/** "5-wood", "5-wood and 5-iron", "5-wood, 5-hybrid and 5-iron". */
function listWords(words: string[]): string {
  return words.length < 2 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}
