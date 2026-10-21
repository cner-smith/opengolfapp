import {
  LIE_TYPE_LABELS,
  SHOT_CONTACTS,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPES,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINES,
  SHOT_START_LINE_LABELS,
  clubNoun,
  type Club,
  type ShotContact,
  type ShotStartLine,
} from './constants'
import type { FlightKind } from './shot-flight'
import { aimAdvice, missLean, type DispersionPoint, type DispersionStats, type RecordedTally } from './shot-patterns'
import type { DistanceUnit } from './types'
import { YARDS_TO_METERS } from './units'

// The Shot patterns screen's sentences and shot groups, one copy for the web
// page and the app. Colours and glyphs stay with each app.

/** What a pattern point doesn't carry itself but the readout shows. */
export interface ShotExtras {
  contact: ShotContact | null
  hole: number | null
  roundId: string | null
  course: string | null
}

export const capFirst = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/** A whole number in the player's unit, without the unit (always positive). */
export const wholeDistance = (yd: number, unit: DistanceUnit) =>
  Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd))
export const distanceUnitAbbr = (unit: DistanceUnit) => (unit === 'meters' ? 'm' : 'yd')
/** "12 yd", "11 m": the size of an offset, never its sign. */
export const distanceText = (yd: number, unit: DistanceUnit) => `${wholeDistance(yd, unit)} ${distanceUnitAbbr(unit)}`

/** Most of these shots were hit from the tee: their aim's distance is wherever
 *  the player dropped it, so the finding speaks only of width. */
export function mostlyTeeShots(points: DispersionPoint[]): boolean {
  return points.filter((p) => p.lieType === 'tee').length * 2 > points.length
}

/**
 * "Your 7-iron finishes about 4 yd short and 5 yd right. Aim about 5 yd left
 * and take a little more club." A miss is named only when it is beyond its own
 * noise (aimAdvice: twice its standard error); otherwise the pattern is
 * centred and the advice is to keep the aim. When the average is inside the
 * noise but most shots still finish on one side (missLean), the sentence says
 * so, so it never reads against the short/long and left/right counts.
 */
export function findingLine(
  stats: DispersionStats,
  points: DispersionPoint[],
  club: Club,
  unit: DistanceUnit,
  teeShots: boolean,
): string {
  const noun = clubNoun(club)
  const advice = aimAdvice(stats)
  const lean = missLean(points)
  const across = advice.lateral ? `${distanceText(stats.avgLateralOffset, unit)} ${advice.lateral}` : null
  const aim = advice.lateral
    ? `Aim about ${distanceText(stats.avgLateralOffset, unit)} ${advice.lateral === 'right' ? 'left' : 'right'}`
    : null
  const keep = 'That’s inside the spread; keep your aim.'
  if (teeShots) {
    const width = distanceText(stats.cone68.lateral * 2, unit)
    const tilt = !across && lean.lateral ? `, though most finish ${lean.lateral}` : ''
    return `Two in three of your ${noun} shots finish inside ${width} side to side, centred ${across ? `about ${across} of your aim` : `on your aim${tilt}`}. ${aim ? `${aim}.` : keep}`
  }
  const along = advice.distance ? `${distanceText(stats.avgDistanceOffset, unit)} ${advice.distance}` : null
  if (!along && !across) {
    if (lean.distance || lean.lateral) {
      const side =
        lean.distance && lean.lateral ? `${lean.distance} and ${lean.lateral}` : lean.distance ? `a little ${lean.distance}` : lean.lateral
      return `Your ${noun} finishes centred on your aim, though most finish ${side}. ${keep}`
    }
    const deeper = stats.cone68.distance > stats.cone68.lateral * 1.25
    return `Your ${noun} finishes centred on your aim${deeper ? ', and misses more by distance than by line' : ''}. ${keep}`
  }
  const moreClub =
    advice.distance === 'short' ? 'take a little more club' : advice.distance === 'long' ? 'take a little less club' : null
  const what = [along, across].filter(Boolean).join(' and ')
  const fix = [aim, moreClub].filter(Boolean).join(' and ')
  // The axis inside the noise: level, unless most shots still lean one way.
  const rest = !along
    ? lean.distance
      ? `, though most finish a little ${lean.distance}`
      : ', level with your aim'
    : !across && lean.lateral
      ? `, though most finish ${lean.lateral}`
      : ''
  return `Your ${noun} finishes about ${what}${rest}. ${capFirst(fix)}.`
}

/** How far a pattern of n shots can be trusted. */
export function readQuality(n: number): string {
  return n < 10 ? 'an early read' : n < 30 ? 'a fair read' : 'a solid read'
}

/** "Mostly draws" / "Mixed, leans right" / "—", from a recorded tally. */
export function tallyWords<K extends string>(
  t: RecordedTally<K>,
  labels: Record<K, string>,
  total: number,
): { value: string; note: string } {
  if (t.recorded === 0) return { value: '—', note: `Not recorded on any of these ${total} shots yet` }
  if (t.verdict === null) return { value: '—', note: `Recorded on ${t.recorded} of ${total}; five needed` }
  if (t.verdict === 'mixed') {
    return { value: t.lean ? `Mixed, leans ${t.lean}` : 'Mixed', note: `Recorded on ${t.recorded} of ${total}` }
  }
  const k = t.verdict
  const all = t.counts[k] === t.recorded
  const word = countWord(k, labels[k], 2).replace(/^2 /, '')
  return { value: all ? capFirst(word) : `Mostly ${word}`, note: `Recorded on ${t.recorded} of ${total}` }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Oct 12" this year, "Oct 12, 2025" otherwise; null for a bad date. Reads
 *  the date part only, so no time zone moves it a day. */
export function shortDate(iso: string): string | null {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return `${MONTHS[m - 1]} ${d}${y === new Date().getFullYear() ? '' : `, ${y}`}`
}

const START_PHRASE: Record<ShotStartLine, string> = { pull: 'from a pull', on_line: 'started on line', push: 'from a push' }

/** Why a flight's record doesn't add up, in the readout. */
export function conflictWords(p: DispersionPoint): string {
  if (p.shape && p.startLine) {
    return `A ${SHOT_SHAPE_LABELS[p.shape].toLowerCase()} ${START_PHRASE[p.startLine]} can’t finish here: check this shot`
  }
  return `It finished too far off its recorded ${p.startLine ? 'start line' : 'shape'}: check this shot`
}

/** The shot readout's parts: where it finished, what was recorded (or what
 *  doesn't add up), and which round ("Hole 7 · Oct 12 · Pine Valley"). */
export function shotParts(
  p: DispersionPoint,
  extras: ShotExtras | undefined,
  unit: DistanceUnit,
  kind?: FlightKind,
): { where: string; recorded: string; flag: string | null; when: string | null } {
  const d = p.distanceOffsetYards
  const l = p.lateralOffsetYards
  const along = Math.abs(d) < 1 ? 'level with the aim' : `${distanceText(d, unit)} ${d < 0 ? 'short' : 'long'}`
  const across = Math.abs(l) < 1 ? 'on line' : `${distanceText(l, unit)} ${l > 0 ? 'right' : 'left'}`
  const parts = [
    p.shape ? SHOT_SHAPE_LABELS[p.shape] : null,
    p.startLine ? SHOT_START_LINE_LABELS[p.startLine].toLowerCase() : null,
    extras?.contact ? SHOT_CONTACT_LABELS[extras.contact].toLowerCase() : null,
    p.lieType ? `from the ${LIE_TYPE_LABELS[p.lieType].toLowerCase()}` : null,
  ].filter(Boolean)
  const missing = [!p.shape && 'shape', !p.startLine && 'start line'].filter(Boolean) as string[]
  const when = [
    extras?.hole != null ? `Hole ${extras.hole}` : null,
    p.playedAt ? shortDate(p.playedAt) : null,
    extras?.course ?? null,
  ].filter(Boolean)
  return {
    where: `${capFirst(along)}, ${across}`,
    recorded: parts.join(' · ') || 'Nothing recorded',
    flag: kind === 'conflict' ? conflictWords(p) : missing.length ? `${capFirst(missing.join(' and '))} not recorded` : null,
    when: when.length ? when.join(' · ') : null,
  }
}

/** The shot readout as lines (the chart's tooltip and each shot's name). */
export function shotWords(p: DispersionPoint, extras: ShotExtras | undefined, unit: DistanceUnit, kind?: FlightKind): string[] {
  const s = shotParts(p, extras, unit, kind)
  return [s.where, s.recorded, s.flag, s.when].filter(Boolean) as string[]
}

/* ------------------------------------------------------- shot groups */

/** What the chart's marks can be grouped by. */
export type ColourBy = 'none' | 'shape' | 'start' | 'contact'
/** The group of a shot with nothing recorded on the chosen axis. */
export const NOT_RECORDED = 'none'

/** The groups in screen order (left to right), without "not recorded". A
 *  left-hander's are mirrored, so their slice (curves left) is on the left. */
export function categoriesFor(by: ColourBy, leftHanded: boolean): { key: string; label: string }[] {
  if (by === 'shape') {
    const order = leftHanded ? [...SHOT_SHAPES].reverse() : SHOT_SHAPES
    return order.map((s) => ({ key: s, label: SHOT_SHAPE_LABELS[s] }))
  }
  if (by === 'start') {
    const order = leftHanded ? [...SHOT_START_LINES].reverse() : SHOT_START_LINES
    return order.map((s) => ({ key: s, label: SHOT_START_LINE_LABELS[s] }))
  }
  if (by === 'contact') return SHOT_CONTACTS.map((c) => ({ key: c, label: SHOT_CONTACT_LABELS[c] }))
  return []
}

export function categoryOf(p: DispersionPoint, extras: ShotExtras | undefined, by: ColourBy): string {
  const v = by === 'shape' ? p.shape : by === 'start' ? p.startLine : by === 'contact' ? extras?.contact : null
  return v ?? NOT_RECORDED
}

const INVARIANT = new Set(['straight', 'on_line', 'solid', 'fat', 'thin', 'topped'])
/** "3 draws", "2 straight", "5 pushes". */
export function countWord(key: string, label: string, n: number): string {
  const w = label.toLowerCase()
  if (n === 1 || INVARIANT.has(key)) return `${n} ${w}`
  return `${n} ${w.endsWith('sh') ? `${w}es` : `${w}s`}`
}

const AXIS_WORD: Record<Exclude<ColourBy, 'none'>, string> = { shape: 'shape', start: 'start line', contact: 'contact' }

/** The note under the legend: "Shape recorded on 7 of 13.", or how to record
 *  it when no shot has it. */
export function recordedNote(
  by: Exclude<ColourBy, 'none'>,
  points: DispersionPoint[],
  extras: Record<string, ShotExtras>,
  noun: string,
): { recorded: number; note: string } {
  const recorded = points.filter((p) => categoryOf(p, extras[p.id], by) !== NOT_RECORDED).length
  const word = AXIS_WORD[by]
  return {
    recorded,
    note:
      recorded === 0
        ? `No ${noun} shot here has its ${word} recorded yet. Set it in a shot’s result after the hole.`
        : `${capFirst(word)} recorded on ${recorded} of ${points.length}.`,
  }
}
