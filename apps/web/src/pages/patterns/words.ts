import {
  LIE_TYPE_LABELS,
  SHOT_CONTACT_LABELS,
  SHOT_SHAPE_LABELS,
  SHOT_START_LINE_LABELS,
  YARDS_TO_METERS,
  aimAdvice,
  clubNoun,
  type Club,
  type DispersionPoint,
  type DispersionStats,
  type DistanceUnit,
  type FlightKind,
  type RecordedTally,
  type ShotShape,
  type ShotStartLine,
} from '@oga/core'
import type { ShotExtras } from '../../hooks/useShotPatterns'
import { countWord } from './layers'

// The page's sentences, shared by the page, the charts and the share card.

export const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s)

/** A whole number in the player's unit, without the unit. */
export const num = (yd: number, unit: DistanceUnit) => Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd))
export const unitWord = (unit: DistanceUnit) => (unit === 'meters' ? 'm' : 'yd')
export const dist = (yd: number, unit: DistanceUnit) => `${num(yd, unit)} ${unitWord(unit)}`

/** Most of these shots were hit from the tee: their aim's distance is wherever
 *  the player dropped it, so the finding speaks only of width. */
export function mostlyTeeShots(points: DispersionPoint[]) {
  return points.filter((p) => p.lieType === 'tee').length * 2 > points.length
}

// "Your 7-iron finishes about 4 yd short and 5 yd right. Aim about 5 yd left
// and take a little more club." A miss is named only when it is beyond its own
// noise (core aimAdvice: twice its standard error); otherwise the pattern is
// centred and the advice is to keep the aim.
export function findingLine(stats: DispersionStats, club: Club, unit: DistanceUnit, teeShots: boolean) {
  const noun = clubNoun(club)
  const advice = aimAdvice(stats)
  const across = advice.lateral ? `${dist(stats.avgLateralOffset, unit)} ${advice.lateral}` : null
  const aim = advice.lateral ? `Aim about ${dist(stats.avgLateralOffset, unit)} ${advice.lateral === 'right' ? 'left' : 'right'}` : null
  if (teeShots) {
    const width = dist(stats.cone68.lateral * 2, unit)
    return `Two in three of your ${noun} shots finish inside ${width} side to side, centred ${across ? `about ${across} of your aim` : 'on your aim'}. ${aim ? `${aim}.` : 'That’s inside the spread; keep your aim.'}`
  }
  const along = advice.distance ? `${dist(stats.avgDistanceOffset, unit)} ${advice.distance}` : null
  if (!along && !across) {
    const deeper = stats.cone68.distance > stats.cone68.lateral * 1.25
    return `Your ${noun} finishes centred on your aim${deeper ? ', and misses more by distance than by line' : ''}. That’s inside the spread; keep your aim.`
  }
  const club_ = advice.distance === 'short' ? 'take a little more club' : advice.distance === 'long' ? 'take a little less club' : null
  const what = [along, across].filter(Boolean).join(' and ')
  const fix = [aim, club_].filter(Boolean).join(' and ')
  return `Your ${noun} finishes about ${what}${!along ? ', level with your aim' : ''}. ${cap(fix)}.`
}

/** How far a pattern of n shots can be trusted. */
export function readQuality(n: number) {
  return n < 10 ? 'an early read' : n < 30 ? 'a fair read' : 'a solid read'
}

/** "Mostly draws" / "Mixed, leans right" / "—", from core's recorded tally. */
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
  return { value: `${all ? '' : 'Mostly '}${all ? cap(word) : word}`, note: `Recorded on ${t.recorded} of ${total}` }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function shortDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return `${d} ${MONTHS[m - 1]}${y === new Date().getFullYear() ? '' : ` ${y}`}`
}

const START_PHRASE: Record<ShotStartLine, string> = { pull: 'from a pull', on_line: 'started on line', push: 'from a push' }

/** Why a flight's record doesn't add up, in the readout. */
export function conflictWords(p: DispersionPoint) {
  if (p.shape && p.startLine) {
    return `A ${SHOT_SHAPE_LABELS[p.shape as ShotShape].toLowerCase()} ${START_PHRASE[p.startLine]} can’t finish here: check this shot`
  }
  return `It finished too far off its recorded ${p.startLine ? 'start line' : 'shape'}: check this shot`
}

/** The shot readout's parts: where it finished, what was recorded (or what
 *  doesn't add up), and which round. */
export function shotParts(p: DispersionPoint, extras: ShotExtras | undefined, unit: DistanceUnit, kind?: FlightKind) {
  const d = p.distanceOffsetYards
  const l = p.lateralOffsetYards
  const along = Math.abs(d) < 1 ? 'level with the aim' : `${dist(d, unit)} ${d < 0 ? 'short' : 'long'}`
  const across = Math.abs(l) < 1 ? 'on line' : `${dist(l, unit)} ${l > 0 ? 'right' : 'left'}`
  const parts = [
    p.shape ? SHOT_SHAPE_LABELS[p.shape] : null,
    p.startLine ? SHOT_START_LINE_LABELS[p.startLine].toLowerCase() : null,
    extras?.contact ? SHOT_CONTACT_LABELS[extras.contact].toLowerCase() : null,
    p.lieType ? `from the ${LIE_TYPE_LABELS[p.lieType].toLowerCase()}` : null,
  ].filter(Boolean)
  const missing = [!p.shape && 'shape', !p.startLine && 'start line'].filter(Boolean) as string[]
  const when = [extras?.hole != null ? `Hole ${extras.hole}` : null, p.playedAt ? shortDate(p.playedAt) : null].filter(Boolean)
  return {
    where: `${cap(along)}, ${across}`,
    recorded: parts.join(' · ') || 'Nothing recorded',
    flag: kind === 'conflict' ? conflictWords(p) : missing.length ? `${cap(missing.join(' and '))} not recorded` : null,
    when: when.length ? when.join(' · ') : null,
  }
}

/** The shot readout as lines (the chart's tooltip and each shot's name). */
export function shotWords(p: DispersionPoint, extras: ShotExtras | undefined, unit: DistanceUnit, kind?: FlightKind) {
  const s = shotParts(p, extras, unit, kind)
  return [s.where, s.recorded, s.flag, s.when].filter(Boolean) as string[]
}
