import type { ShotShape } from './constants'
import { clubNoun } from './constants'
import {
  aimAdvice,
  clubDistanceRange,
  computeDispersion,
  computeDispersionStats,
  median,
  shapeTally,
  type DispersionStats,
} from './shot-patterns'
import { clubShotYards } from './stats'
import type { DistanceUnit, Shot } from './types'
import { parseLocalDate, YARDS_TO_METERS } from './units'

/** A period under this many shots is drawn hollow and kept out of callouts. */
export const CLUB_HISTORY_THIN = 8
/** A callout needs this many shots in both periods it compares. */
const CALLOUT_MIN_SHOTS = 10
/** …and a change of at least this many yards. */
const CALLOUT_MIN_YARDS = 3

/** One of the player's shots with this club, as the club-history query returns it. */
export interface ClubHistoryRow {
  id: string
  club: string | null
  lie_type: string | null
  start_lat: number | null
  start_lng: number | null
  end_lat: number | null
  end_lng: number | null
  aim_lat: number | null
  aim_lng: number | null
  shape: ShotShape | null
  hole_scores: { round_id: string; rounds: { played_at: string } | null } | null
}

export type ClubHistoryPeriodKind = 'month' | { rounds: number }

export interface ClubHistoryPeriod {
  /** Axis label: "Jul" by month, the last round's date ("Jul 12") by rounds;
   *  the year is added when it isn't the latest period's year. */
  label: string
  /** First and last day the period covers, YYYY-MM-DD. */
  from: string
  to: string
  /** Shots with a start and a finish (the Club distances rule). */
  distanceShots: number
  /** Median start→finish yards; null without distance shots. */
  typical: number | null
  /** Two in three finish between p16 and p84 (clubDistanceRange); null under 5. */
  p16: number | null
  p84: number | null
  /** Sample standard deviation of the distances; null under 2. */
  distanceSd: number | null
  /** Shots with a start, an aim and a finish. */
  aimedShots: number
  /** Two-in-three ring (cone68), full width × depth in yards; null under 5 aimed. */
  ring: { width: number; depth: number } | null
  /** Average finish from the aim: + right, + long. Null under 5 aimed. */
  avgMiss: { lateral: number; distance: number } | null
  dispersion: DispersionStats | null
  /** Recorded shapes on the aimed shots; hook folds into draw, slice into fade. */
  shape: { draw: number; straight: number; fade: number }
  /** Under CLUB_HISTORY_THIN distance shots. */
  thin: boolean
  /** Under CLUB_HISTORY_THIN aimed shots. */
  ringThin: boolean
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (n: number) => String(n).padStart(2, '0')

/** The played date as a local calendar day, YYYY-MM-DD. */
function localDay(playedAt: string): string {
  const d = parseLocalDate(playedAt)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function toShot(r: ClubHistoryRow): Shot {
  return {
    id: r.id,
    holeScoreId: '',
    userId: '',
    shotNumber: 0,
    startLat: r.start_lat ?? undefined,
    startLng: r.start_lng ?? undefined,
    aimLat: r.aim_lat ?? undefined,
    aimLng: r.aim_lng ?? undefined,
    endLat: r.end_lat ?? undefined,
    endLng: r.end_lng ?? undefined,
    shape: r.shape,
  }
}

function sampleSd(xs: number[]): number | null {
  if (xs.length < 2) return null
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1))
}

function summarise(rows: ClubHistoryRow[], label: string, from: string, to: string): ClubHistoryPeriod {
  const distances = rows.flatMap((r) => {
    const d = clubShotYards(r)
    return d == null ? [] : [d]
  })
  const points = computeDispersion(rows.map(toShot))
  const dispersion = computeDispersionStats(points)
  const range = clubDistanceRange(distances)
  const t = shapeTally(points, false).counts
  return {
    label,
    from,
    to,
    distanceShots: distances.length,
    typical: median(distances),
    p16: range?.low ?? null,
    p84: range?.high ?? null,
    distanceSd: sampleSd(distances),
    aimedShots: points.length,
    ring: dispersion && { width: 2 * dispersion.cone68.lateral, depth: 2 * dispersion.cone68.distance },
    avgMiss: dispersion && { lateral: dispersion.avgLateralOffset, distance: dispersion.avgDistanceOffset },
    dispersion,
    shape: { draw: t.hook + t.draw, straight: t.straight, fade: t.fade + t.slice },
    thin: distances.length < CLUB_HISTORY_THIN,
    ringThin: points.length < CLUB_HISTORY_THIN,
  }
}

const shortDay = (day: string) => `${MONTHS[Number(day.slice(5, 7)) - 1]} ${Number(day.slice(8, 10))}`

/**
 * One club over time: an entry per calendar month that has a shot (by the
 * round's played date, local time), or per window of `rounds` rounds counted
 * back from the newest (so the latest window is full and the oldest may be
 * short). Only rounds with a shot of this club count. Oldest first.
 */
export function clubHistory(
  rows: readonly ClubHistoryRow[],
  club: string,
  opts: { period: ClubHistoryPeriodKind },
): ClubHistoryPeriod[] {
  const dated = rows.flatMap((r) => {
    const playedAt = r.hole_scores?.rounds?.played_at
    return r.club === club && playedAt ? [{ r, day: localDay(playedAt), roundId: r.hole_scores!.round_id }] : []
  })
  if (dated.length === 0) return []

  const groups: { rows: ClubHistoryRow[]; from: string; to: string; short: string }[] = []
  if (opts.period === 'month') {
    const byMonth = new Map<string, ClubHistoryRow[]>()
    for (const d of dated) {
      const k = d.day.slice(0, 7)
      byMonth.set(k, [...(byMonth.get(k) ?? []), d.r])
    }
    for (const k of [...byMonth.keys()].sort()) {
      const [y, m] = k.split('-').map(Number) as [number, number]
      const last = new Date(y, m, 0).getDate()
      groups.push({ rows: byMonth.get(k)!, from: `${k}-01`, to: `${k}-${pad(last)}`, short: MONTHS[m - 1]! })
    }
  } else {
    const size = opts.period.rounds
    const rounds = new Map<string, { day: string; rows: ClubHistoryRow[] }>()
    for (const d of dated) {
      const g = rounds.get(d.roundId) ?? { day: d.day, rows: [] }
      g.rows.push(d.r)
      rounds.set(d.roundId, g)
    }
    const ordered = [...rounds.entries()]
      .sort(([ia, a], [ib, b]) => (a.day < b.day ? -1 : a.day > b.day ? 1 : ia < ib ? -1 : 1))
      .map(([, g]) => g)
    for (let end = ordered.length; end > 0; end -= size) {
      const win = ordered.slice(Math.max(0, end - size), end)
      const to = win[win.length - 1]!.day
      groups.unshift({ rows: win.flatMap((g) => g.rows), from: win[0]!.day, to, short: shortDay(to) })
    }
  }
  const latestYear = groups[groups.length - 1]!.to.slice(0, 4)
  return groups.map((g) =>
    summarise(g.rows, g.to.slice(0, 4) === latestYear ? g.short : `${g.short} ${g.to.slice(0, 4)}`, g.from, g.to),
  )
}

export interface ClubChangeCallouts {
  /** At most two sentences; empty when no change passes the guard. */
  sentences: string[]
  /** The two periods compared: the earliest and the latest with 10+ distance
   *  shots. Null when fewer than two have that many. */
  first: ClubHistoryPeriod | null
  last: ClubHistoryPeriod | null
}

/**
 * Plain sentences for what changed between the earliest and the latest period
 * with 10+ distance shots. A change is said only when it beats the noise:
 * typical distance when |Δ| > 2·√(s₁²/n₁ + s₂²/n₂) and ≥ 3 yd; ring width the
 * same, with each width's standard error w/√(2(n−1)) and 10+ aimed shots both
 * sides; the miss only when its side, as aimAdvice reads it, flipped, appeared
 * or went away.
 */
export function clubChangeCallouts(
  periods: readonly ClubHistoryPeriod[],
  opts: { club: string; unit: DistanceUnit },
): ClubChangeCallouts {
  const eligible = periods.filter((p) => !p.thin && p.distanceShots >= CALLOUT_MIN_SHOTS)
  if (eligible.length < 2) return { sentences: [], first: null, last: null }
  const first = eligible[0]!
  const last = eligible[eligible.length - 1]!
  const noun = clubNoun(opts.club)
  const amount = (yd: number) =>
    opts.unit === 'meters' ? `${Math.round(Math.abs(yd) * YARDS_TO_METERS)} m` : `${Math.round(Math.abs(yd))} yd`

  let distance: number | null = null
  if (first.typical != null && last.typical != null && first.distanceSd != null && last.distanceSd != null) {
    const d = last.typical - first.typical
    const se = Math.sqrt(first.distanceSd ** 2 / first.distanceShots + last.distanceSd ** 2 / last.distanceShots)
    if (Math.abs(d) >= CALLOUT_MIN_YARDS && Math.abs(d) > 2 * se) distance = d
  }

  let ring: number | null = null
  const aimedBoth = first.aimedShots >= CALLOUT_MIN_SHOTS && last.aimedShots >= CALLOUT_MIN_SHOTS
  if (aimedBoth && first.ring && last.ring) {
    const w = last.ring.width - first.ring.width
    const seOf = (p: ClubHistoryPeriod) => p.ring!.width / Math.sqrt(2 * (p.aimedShots - 1))
    const se = Math.hypot(seOf(first), seOf(last))
    if (Math.abs(w) >= CALLOUT_MIN_YARDS && Math.abs(w) > 2 * se) ring = w
  }

  const sentences: string[] = []
  const since = `than in ${first.label}`
  if (distance != null) {
    const goes = `Your ${noun} goes ${amount(distance)} ${distance > 0 ? 'farther' : 'shorter'} ${since}`
    sentences.push(ring != null ? `${goes}, and the ring is ${ring < 0 ? 'tighter' : 'wider'}.` : `${goes}.`)
  } else if (ring != null) {
    sentences.push(`Your ${noun}'s ring is ${amount(ring)} ${ring < 0 ? 'narrower' : 'wider'} ${since}.`)
  }

  if (aimedBoth && first.dispersion && last.dispersion) {
    const a = aimAdvice(first.dispersion)
    const b = aimAdvice(last.dispersion)
    const miss = (was: string | null, now: string | null) =>
      was === now
        ? null
        : was && now
          ? `Your miss has moved from ${was} to ${now} of your aim since ${first.label}.`
          : now
            ? `Your ${noun} now finishes ${now} of your aim; in ${first.label} it didn't.`
            : `Your ${noun} no longer finishes ${was} of your aim.`
    const line = miss(a.lateral, b.lateral) ?? miss(a.distance, b.distance)
    if (line) sentences.push(line)
  }

  return { sentences: sentences.slice(0, 2), first, last }
}
