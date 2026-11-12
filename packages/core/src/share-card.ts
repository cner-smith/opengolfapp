import type { Database } from '@oga/supabase'
import { formatHandicapIndex, formatWholeHandicap } from './handicap'
import { SG_AREAS } from './home-summary'
import { formatLocation } from './opengolfapi'
import { ordinal } from './plan-intro'
import { roundHolesPlayed, scoredTotals, type ScoredTotals } from './round'
import type { SGBreakdownKey } from './stats'
import { parseLocalDate } from './units'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']

// Everything the five round share card styles print (#1437), so each style is
// a renderer only. Light/dark is the renderer's. Facts only, never advice.

export interface ShareCardInput {
  round: Pick<
    RoundRow,
    'played_at' | 'tee_color' | 'hole_count' | 'sg_total' | 'sg_off_tee' | 'sg_approach' | 'sg_around_green' | 'sg_putting'
  >
  course: { name: string | null; city?: string | null; state?: string | null } | null
  /** The played tee (resolveCourseTee), for yardage and rating / slope. */
  tee: Pick<CourseTeeRow, 'total_yards' | 'course_rating' | 'slope_rating'> | null
  /** The player's handicap index, for the strokes-gained sentence. */
  handicapIndex: number | null
  /** Every hole the course has: par already resolved (resolveHole), and its
   *  hole_scores row, if any. */
  holes: readonly {
    number: number
    par: number
    score: Pick<
      HoleScoreRow,
      'score' | 'putts' | 'fairway_hit' | 'gir' | 'penalties' | 'sg_off_tee' | 'sg_approach' | 'sg_around_green' | 'sg_putting'
    > | null
  }[]
}

export interface ShareCardHole {
  number: number
  par: number
  score: number
  /** score − par; the pencil mark is marksFor(toPar, number). */
  toPar: number
  /** To par after this hole, over the holes played (style 3's line). */
  runningToPar: number
  putts: number | null
  /** The hole's four SG columns summed; null when none is stored. */
  sg: number | null
}

export interface ShareCardNine {
  label: 'Out' | 'In'
  holes: ShareCardHole[]
  par: number
  score: number
  /** null when no hole in the nine has putts recorded. */
  putts: number | null
}

export interface ShareCardNote {
  number: number
  text: string
}

export interface ShareCardSG {
  total: number
  areas: { key: SGBreakdownKey; label: string; value: number | null }[]
  /** "3.1 strokes better than a typical 12 handicap" */
  headline: string
  /** "Strokes gained per hole, against a 12.4 handicap index" */
  basis: string
  /** Most SG gained on a hole, "4 on a par 5"; null when no hole gained. */
  best: ShareCardNote | null
  /** Most SG lost, "8 on a par 4, a penalty"; null when no hole lost. */
  worst: ShareCardNote | null
}

export interface ShareCardModel {
  /** "Sat 31 Oct 2026 · Hilton Head Island, SC" */
  dateline: string
  course: string
  /** "White tees · 6,162 yd · 71.5 / 132"; parts the round lacks are left out. */
  teeLine: string | null
  /** The holes played (score > 0), by number. */
  holes: ShareCardHole[]
  /** Out (1–9) and In (10–18), only those with a hole played. */
  nines: ShareCardNine[]
  totals: ScoredTotals
  /** The round's hole count (#727). */
  holeCount: number
  /** "9 of 18 holes" for a round ended early; null for a whole round. */
  partialLabel: string | null
  /** A partial 18 that played exactly one nine: 'front' (1–9) or 'back' (10–18). */
  playedNine: 'front' | 'back' | null
  facts: {
    putts: number | null
    /** Hit of the par 4s and 5s played; null when none has fairway recorded. */
    fairways: { hit: number; of: number } | null
    /** Of the holes played; null when no hole has GIR recorded. */
    gir: { hit: number; of: number } | null
    penalties: number
    /** "1 penalty, on the 3rd"; null when none. */
    penaltyNote: string | null
  }
  /** Style 3's handwritten notes. */
  highlights: {
    /** "8 on the 3rd": the hole furthest over par; null when none was over. */
    worst: ShareCardNote | null
    /** "birdie on the 7th": the first hole under par; null when none was. */
    firstUnderPar: ShareCardNote | null
  }
  /** Style 5 is offered only when this is set. */
  sg: ShareCardSG | null
}

/** null when no hole was played: there is nothing to draw. */
export function shareCardModel(input: ShareCardInput): ShareCardModel | null {
  const holes = playedHoles(input.holes)
  if (holes.length === 0) return null
  const count = roundHolesPlayed(
    input.holes.map((h) => ({ score: h.score?.score ?? null, holes: { number: h.number } })),
    input.round.hole_count,
  )!
  const partial = count.played < count.of
  return {
    dateline: dateline(input.round.played_at, input.course),
    course: input.course?.name ?? 'Round',
    teeLine: teeLine(input.round.tee_color, input.tee),
    holes: holes.map((h) => h.card),
    nines: nines(holes.map((h) => h.card)),
    totals: scoredTotals(holes.map((h) => h.card)),
    holeCount: count.of,
    partialLabel: partial ? `${count.played} of ${count.of} holes` : null,
    playedNine: partial && count.of === 18 ? playedNine(holes.map((h) => h.number)) : null,
    facts: facts(holes),
    highlights: highlights(holes.map((h) => h.card)),
    sg: roundSG(input.round, input.handicapIndex, holes),
  }
}

type PlayedHole = {
  number: number
  card: ShareCardHole
  row: NonNullable<ShareCardInput['holes'][number]['score']>
}

function playedHoles(holes: ShareCardInput['holes']): PlayedHole[] {
  let running = 0
  return [...holes]
    .filter((h) => h.score != null && h.score.score > 0)
    .sort((a, b) => a.number - b.number)
    .map((h) => {
      const row = h.score!
      running += row.score - h.par
      return {
        number: h.number,
        row,
        card: {
          number: h.number,
          par: h.par,
          score: row.score,
          toPar: row.score - h.par,
          runningToPar: running,
          putts: row.putts,
          sg: holeSG(row),
        },
      }
    })
}

function holeSG(row: PlayedHole['row']): number | null {
  const parts = [row.sg_off_tee, row.sg_approach, row.sg_around_green, row.sg_putting].filter(
    (v): v is number => v != null,
  )
  return parts.length === 0 ? null : parts.reduce((a, b) => a + b, 0)
}

// Sums a nullable column: null when every value is null.
function sumKnown(values: readonly (number | null)[]): number | null {
  const known = values.filter((v): v is number => v != null)
  return known.length === 0 ? null : known.reduce((a, b) => a + b, 0)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Spelled out by hand, not toLocaleDateString: Hermes' Intl varies by platform.
function dateline(playedAt: string, course: ShareCardInput['course']): string {
  const d = parseLocalDate(playedAt)
  const date = `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  const place = formatLocation({ city: course?.city ?? undefined, state: course?.state ?? undefined })
  return place ? `${date} · ${place}` : date
}

function teeLine(teeColor: string | null, tee: ShareCardInput['tee']): string | null {
  const parts: string[] = []
  if (teeColor) parts.push(`${teeColor[0]!.toUpperCase()}${teeColor.slice(1)} tees`)
  if (tee?.total_yards != null) parts.push(`${String(tee.total_yards).replace(/\B(?=(\d{3})+$)/g, ',')} yd`)
  if (tee?.course_rating != null && tee.slope_rating != null) {
    parts.push(`${tee.course_rating.toFixed(1)} / ${tee.slope_rating}`)
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

function nines(holes: readonly ShareCardHole[]): ShareCardNine[] {
  const halves: [ShareCardNine['label'], ShareCardHole[]][] = [
    ['Out', holes.filter((h) => h.number <= 9)],
    ['In', holes.filter((h) => h.number > 9)],
  ]
  return halves
    .filter(([, hs]) => hs.length > 0)
    .map(([label, hs]) => {
      const t = scoredTotals(hs)
      return { label, holes: hs, par: t.par, score: t.score, putts: sumKnown(hs.map((h) => h.putts)) }
    })
}

function playedNine(numbers: readonly number[]): 'front' | 'back' | null {
  const key = numbers.join(',')
  if (key === '1,2,3,4,5,6,7,8,9') return 'front'
  if (key === '10,11,12,13,14,15,16,17,18') return 'back'
  return null
}

// Fairways: of the par 4s and 5s played (as the round save counts them).
function facts(holes: readonly PlayedHole[]): ShareCardModel['facts'] {
  const fairwayHoles = holes.filter((h) => h.card.par > 3)
  const fairwaysKnown = fairwayHoles.some((h) => h.row.fairway_hit != null)
  const girKnown = holes.some((h) => h.row.gir != null)
  const penaltyHoles = holes.filter((h) => h.row.penalties > 0)
  const penalties = penaltyHoles.reduce((n, h) => n + h.row.penalties, 0)
  return {
    putts: sumKnown(holes.map((h) => h.row.putts)),
    fairways: fairwaysKnown
      ? { hit: fairwayHoles.filter((h) => h.row.fairway_hit === true).length, of: fairwayHoles.length }
      : null,
    gir: girKnown ? { hit: holes.filter((h) => h.row.gir === true).length, of: holes.length } : null,
    penalties,
    penaltyNote:
      penalties === 0
        ? null
        : `${penalties} ${penalties === 1 ? 'penalty' : 'penalties'}, on the ${listOrdinals(penaltyHoles.map((h) => h.number))}`,
  }
}

// "3rd", "3rd and 11th", "3rd, 7th and 11th".
function listOrdinals(numbers: readonly number[]): string {
  const words = numbers.map(ordinal)
  return words.length === 1 ? words[0]! : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

// Ties go to the earlier hole.
function extreme<T>(items: readonly T[], value: (t: T) => number, better: (a: number, b: number) => boolean): T {
  return items.reduce((a, b) => (better(value(b), value(a)) ? b : a))
}

function highlights(holes: readonly ShareCardHole[]): ShareCardModel['highlights'] {
  const worst = extreme(holes, (h) => h.toPar, (a, b) => a > b)
  const under = holes.find((h) => h.toPar < 0)
  return {
    worst: worst.toPar > 0 ? { number: worst.number, text: `${worst.score} on the ${ordinal(worst.number)}` } : null,
    firstUnderPar: under ? { number: under.number, text: `${underParName(under)} on the ${ordinal(under.number)}` } : null,
  }
}

function underParName(h: ShareCardHole): string {
  if (h.score === 1) return 'hole in one'
  return h.toPar === -1 ? 'birdie' : h.toPar === -2 ? 'eagle' : 'albatross'
}

// Style 5 needs per-hole SG to draw: a round whose holes stored none (a round
// with no valued shot saves sg_total null, #1436) has no SG to share.
function roundSG(
  round: ShareCardInput['round'],
  handicapIndex: number | null,
  holes: readonly PlayedHole[],
): ShareCardSG | null {
  if (round.sg_total == null) return null
  const withSG = holes.filter((h) => h.card.sg != null)
  if (withSG.length === 0) return null
  const best = extreme(withSG, (h) => h.card.sg!, (a, b) => a > b)
  const worst = extreme(withSG, (h) => h.card.sg!, (a, b) => a < b)
  return {
    total: round.sg_total,
    areas: SG_AREAS.map(({ key, label }) => ({ key, label, value: round[key] })),
    headline: sgHeadline(round.sg_total, handicapIndex),
    basis:
      handicapIndex == null
        ? 'Strokes gained per hole'
        : `Strokes gained per hole, against a ${formatHandicapIndex(handicapIndex)} handicap index`,
    best: best.card.sg! > 0 ? { number: best.number, text: `${best.card.score} on a par ${best.card.par}` } : null,
    worst: worst.card.sg! < 0 ? { number: worst.number, text: sgWorstText(worst) } : null,
  }
}

function sgWorstText(h: PlayedHole): string {
  const pen = h.row.penalties
  const tail = pen === 0 ? '' : pen === 1 ? ', a penalty' : `, ${pen} penalties`
  return `${h.card.score} on a par ${h.card.par}${tail}`
}

// To the tenth, as the card prints SG.
function sgHeadline(total: number, handicapIndex: number | null): string {
  const tenths = Number(Math.abs(total).toFixed(1))
  const strokes = tenths.toFixed(1)
  if (handicapIndex == null) {
    if (tenths === 0) return 'Level on strokes gained'
    return `${strokes} strokes ${total > 0 ? 'gained' : 'lost'}`
  }
  const who = `a typical ${formatWholeHandicap(handicapIndex)} handicap`
  if (tenths === 0) return `Level with ${who}`
  return `${strokes} strokes ${total > 0 ? 'better' : 'worse'} than ${who}`
}
