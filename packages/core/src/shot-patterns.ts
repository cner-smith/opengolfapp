import type {
  LieSlope,
  LieSlopeForward,
  LieSlopeSide,
  LieType,
  ShotResult,
  ShotShape,
  ShotStartLine,
} from './constants'
import { SHOT_SHAPES, SHOT_START_LINES } from './constants'
import type { Shot } from './types'
import { bearingDegrees, toRadians } from './units'

export interface DispersionPoint {
  /** Source shot id — used as a stable React key when rendering the
   *  dispersion plot, and lets a click handler trace back to the row. */
  id: string
  /** Yards right of aim (negative = left) */
  lateralOffsetYards: number
  /** Yards long of aim (negative = short) */
  distanceOffsetYards: number
  /** Start position long of aim (negative = short). Undefined when the
   *  shot has no recorded start. */
  startDistanceOffsetYards?: number
  shotResult?: ShotResult
  /** @deprecated populated from legacy rows; new code uses lieSlopeForward + lieSlopeSide. */
  lieSlope?: LieSlope
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  lieType?: LieType
  shape?: ShotShape | null
  startLine?: ShotStartLine | null
  /** The round's played date (ISO), when known. */
  playedAt?: string
}

/** A containment ring in the aim frame (x = right, y = long; y up). `rx` is
 *  the semi-axis along the lateral axis turned by `rotationDeg`
 *  (counter-clockwise, towards long; within ±45°), `ry` the one across it.
 *  In SVG, where y points down, rotate by −rotationDeg. */
export interface DispersionRing {
  cx: number
  cy: number
  rx: number
  ry: number
  rotationDeg: number
}

export interface DispersionStats {
  avgLateralOffset: number
  avgDistanceOffset: number
  stdLateral: number
  stdDistance: number
  cone68: { lateral: number; distance: number }
  cone95: { lateral: number; distance: number }
  /** The side of the average miss when it is beyond its own uncertainty
   *  (see aimAdvice), else 'straight'. */
  dominantMiss: 'left' | 'right' | 'straight'
  /** The recorded shape's verdict (shapeTally); null = too few recorded. */
  shape: ShotShape | 'mixed' | null
  /** Rings tilted by the pattern's covariance; same k-factors as the cones. */
  ring68: DispersionRing
  ring95: DispersionRing
  /** Average start-to-aim distance over shots with a start, yards. */
  avgAimDistance: number | null
  sampleSize: number
}

const YARDS_PER_DEG_LAT = 121_000

function yardsPerDegLng(latDeg: number): number {
  return YARDS_PER_DEG_LAT * Math.cos((latDeg * Math.PI) / 180)
}

function isFiniteNumber(n: number | null | undefined): n is number {
  return n !== null && n !== undefined && Number.isFinite(n)
}

/** True only when start, aim, AND end coords are all finite — the minimum
 *  needed to derive the intended (start→aim) line and frame the shot to it. */
function hasAimGeometry(
  s: Shot,
): s is Shot &
  Record<
    'startLat' | 'startLng' | 'aimLat' | 'aimLng' | 'endLat' | 'endLng',
    number
  > {
  return (
    isFiniteNumber(s.startLat) &&
    isFiniteNumber(s.startLng) &&
    isFiniteNumber(s.aimLat) &&
    isFiniteNumber(s.aimLng) &&
    isFiniteNumber(s.endLat) &&
    isFiniteNumber(s.endLng)
  )
}

/**
 * Rotate a (target − aim) displacement into the aim-relative frame given the
 * intended-line bearing θ (radians, CW from N). `alongYards` = past the aim
 * point along the line; `perpYards` = right of the line. Scale deg→yards
 * BEFORE rotating — 1° lng ≠ 1° lat in distance.
 */
function rotateAroundAim(
  targetLat: number,
  targetLng: number,
  aimLat: number,
  aimLng: number,
  θ: number,
): { alongYards: number; perpYards: number } {
  const north = (targetLat - aimLat) * YARDS_PER_DEG_LAT
  const east = (targetLng - aimLng) * yardsPerDegLng(aimLat)
  return {
    alongYards: north * Math.cos(θ) + east * Math.sin(θ),
    perpYards: -north * Math.sin(θ) + east * Math.cos(θ),
  }
}

export function computeDispersion(shots: Shot[]): DispersionPoint[] {
  const points: DispersionPoint[] = []
  for (const s of shots) {
    // Aim-relative framing needs the start→aim line, so skip shots missing
    // start (compass-framing them and mixing bearings smears the pattern — #464).
    if (!hasAimGeometry(s)) continue
    const θ = toRadians(bearingDegrees(s.startLat, s.startLng, s.aimLat, s.aimLng))
    const end = rotateAroundAim(s.endLat, s.endLng, s.aimLat, s.aimLng, θ)
    const start = rotateAroundAim(s.startLat, s.startLng, s.aimLat, s.aimLng, θ)
    points.push({
      id: s.id,
      lateralOffsetYards: end.perpYards,
      distanceOffsetYards: end.alongYards,
      // Start projected onto the aim line (negative = behind aim = the distance to aim).
      startDistanceOffsetYards: start.alongYards,
      shotResult: s.shotResult,
      lieSlope: s.lieSlope,
      lieSlopeForward: s.lieSlopeForward,
      lieSlopeSide: s.lieSlopeSide,
      lieType: s.lieType,
      shape: s.shape,
      startLine: s.startLine,
      playedAt: s.playedAt,
    })
  }
  return points
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdDev(xs: number[], avg: number): number {
  const variance = xs.reduce((a, b) => a + (b - avg) ** 2, 0) / xs.length
  return Math.sqrt(variance)
}

const DOMINANT_MISS_THRESHOLD_YARDS = 2
/** Shots a club needs before its pattern (and its measured typical distance)
 *  counts. Below this the live wheel shows "N more". */
export const MIN_SAMPLES_FOR_STATS = 5
// 2D containment radii. The fraction of a bivariate-normal scatter inside an
// axis-scaled ellipse is 1 − e^(−k²/2), so 68% / 95% containment needs
// k = √(−2·ln(1−p)) — NOT the 1-D 1σ / 1.96σ rule, which here would enclose
// only ~39% / ~85% of shots.
const CONE_68_K = 1.5096 // √(−2 ln 0.32)
const CONE_95_K = 2.4477 // √(−2 ln 0.05)

export function computeDispersionStats(points: DispersionPoint[]): DispersionStats | null {
  if (points.length < MIN_SAMPLES_FOR_STATS) return null

  const laterals = points.map((p) => p.lateralOffsetYards)
  const distances = points.map((p) => p.distanceOffsetYards)
  const avgLat = mean(laterals)
  const avgDist = mean(distances)
  const stdLat = stdDev(laterals, avgLat)
  const stdDist = stdDev(distances, avgDist)
  const n = points.length
  const lateralMiss = beyondNoise(avgLat, stdLat, n)

  const aimDistances = points.flatMap((p) =>
    p.startDistanceOffsetYards === undefined ? [] : [-p.startDistanceOffsetYards],
  )
  const ring = covarianceRing(points, avgLat, avgDist)
  const scaled = (k: number): DispersionRing => ({ ...ring, rx: ring.rx * k, ry: ring.ry * k })

  return {
    avgLateralOffset: avgLat,
    avgDistanceOffset: avgDist,
    stdLateral: stdLat,
    stdDistance: stdDist,
    cone68: { lateral: stdLat * CONE_68_K, distance: stdDist * CONE_68_K },
    cone95: { lateral: stdLat * CONE_95_K, distance: stdDist * CONE_95_K },
    dominantMiss: lateralMiss === 0 ? 'straight' : lateralMiss > 0 ? 'right' : 'left',
    shape: shapeTally(points, false).verdict, // the verdict word doesn't depend on hand
    ring68: scaled(CONE_68_K),
    ring95: scaled(CONE_95_K),
    avgAimDistance: aimDistances.length ? mean(aimDistances) : null,
    sampleSize: n,
  }
}

/** The 1σ ellipse of the points' 2×2 covariance, on its eigenvectors. */
function covarianceRing(points: DispersionPoint[], cx: number, cy: number): DispersionRing {
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (const p of points) {
    const dx = p.lateralOffsetYards - cx
    const dy = p.distanceOffsetYards - cy
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  sxx /= points.length
  syy /= points.length
  sxy /= points.length
  // One eigenvector lies at ½·atan2(2σxy, σxx − σyy); the other is 90° on.
  // Take whichever is within ±45° so an untilted pattern keeps rx lateral.
  let θ = Math.atan2(2 * sxy, sxx - syy) / 2
  if (θ > Math.PI / 4) θ -= Math.PI / 2
  else if (θ <= -Math.PI / 4) θ += Math.PI / 2
  const c = Math.cos(θ)
  const s = Math.sin(θ)
  const along = sxx * c * c + 2 * sxy * s * c + syy * s * s
  const across = sxx * s * s - 2 * sxy * s * c + syy * c * c
  return {
    cx,
    cy,
    rx: Math.sqrt(Math.max(0, along)),
    ry: Math.sqrt(Math.max(0, across)),
    rotationDeg: (θ * 180) / Math.PI,
  }
}

/** Sign of the average miss when it is beyond its own uncertainty, else 0.
 *  Rule: |mean| > 2·SE, SE = s/√n with the sample standard deviation s,
 *  which is σ/√(n−1) for the population σ; and |mean| ≥ the 2 yd floor, so a
 *  tight pattern isn't told to move a yard. */
function beyondNoise(avg: number, popStd: number, n: number): -1 | 0 | 1 {
  const se = popStd / Math.sqrt(n - 1)
  if (Math.abs(avg) < DOMINANT_MISS_THRESHOLD_YARDS || Math.abs(avg) <= 2 * se) return 0
  return avg > 0 ? 1 : -1
}

export interface AimAdvice {
  /** Side of the average miss; move the aim the other way by |avgLateralOffset|. */
  lateral: 'left' | 'right' | null
  /** Short or long on average; null = level with the aim, within the spread. */
  distance: 'short' | 'long' | null
}

/** Which average misses are worth acting on (see beyondNoise for the rule). */
export function aimAdvice(stats: DispersionStats): AimAdvice {
  const n = stats.sampleSize
  const lat = beyondNoise(stats.avgLateralOffset, stats.stdLateral, n)
  const dist = beyondNoise(stats.avgDistanceOffset, stats.stdDistance, n)
  return {
    lateral: lat === 0 ? null : lat > 0 ? 'right' : 'left',
    distance: dist === 0 ? null : dist > 0 ? 'long' : 'short',
  }
}

export interface RecordedTally<K extends string> {
  counts: Record<K, number>
  recorded: number
  notRecorded: number
  /** A value holding at least half of MIN_SAMPLES_FOR_STATS or more recorded
   *  shots (and more than any other); 'mixed' otherwise; null under five. */
  verdict: K | 'mixed' | null
  /** Which side of the screen has more: curving (shape) or starting (start
   *  line) left vs right, mirrored for a left-hander. Null when even. */
  lean: 'left' | 'right' | null
}

function tally<K extends string>(
  keys: readonly K[],
  values: (K | null | undefined)[],
  left: readonly K[],
  right: readonly K[],
): RecordedTally<K> {
  const counts = Object.fromEntries(keys.map((k) => [k, 0])) as Record<K, number>
  let notRecorded = 0
  for (const v of values) {
    if (v == null) notRecorded++
    else counts[v]++
  }
  const recorded = values.length - notRecorded
  const ranked = [...keys].sort((a, b) => counts[b] - counts[a])
  const top = ranked[0]!
  const holdsHalf = 2 * counts[top] >= recorded && counts[top] > counts[ranked[1]!]
  const sum = (ks: readonly K[]) => ks.reduce((a, k) => a + counts[k], 0)
  const l = sum(left)
  const r = sum(right)
  return {
    counts,
    recorded,
    notRecorded,
    verdict: recorded < MIN_SAMPLES_FOR_STATS ? null : holdsHalf ? top : 'mixed',
    lean: l > r ? 'left' : r > l ? 'right' : null,
  }
}

const CURVES_LEFT: readonly ShotShape[] = ['hook', 'draw']
const CURVES_RIGHT: readonly ShotShape[] = ['fade', 'slice']

/** Recorded shapes only (WEB-11); a right-hander's hook and draw curve left. */
export function shapeTally(points: DispersionPoint[], leftHanded: boolean): RecordedTally<ShotShape> {
  const [l, r] = leftHanded ? [CURVES_RIGHT, CURVES_LEFT] : [CURVES_LEFT, CURVES_RIGHT]
  return tally(SHOT_SHAPES, points.map((p) => p.shape), l, r)
}

/** Recorded start lines only; a right-hander's pull starts left. */
export function startLineTally(points: DispersionPoint[], leftHanded: boolean): RecordedTally<ShotStartLine> {
  const [l, r]: [ShotStartLine, ShotStartLine] = leftHanded ? ['push', 'pull'] : ['pull', 'push']
  return tally(SHOT_START_LINES, points.map((p) => p.startLine), [l], [r])
}

/** Finishes short / long and left / right of the aim; level counts neither. */
export function missTally(points: DispersionPoint[]): {
  short: number
  long: number
  left: number
  right: number
} {
  const t = { short: 0, long: 0, left: 0, right: 0 }
  for (const p of points) {
    if (p.distanceOffsetYards < 0) t.short++
    else if (p.distanceOffsetYards > 0) t.long++
    if (p.lateralOffsetYards < 0) t.left++
    else if (p.lateralOffsetYards > 0) t.right++
  }
  return t
}

/**
 * The side most shots finish on, when it's lopsided enough to say so even if
 * the average sits inside the noise: at least 70% of five or more shots.
 * Level shots count in the total.
 */
export function missLean(points: DispersionPoint[]): {
  distance: 'short' | 'long' | null
  lateral: 'left' | 'right' | null
} {
  const n = points.length
  const t = missTally(points)
  const side = <K extends string>(a: number, ka: K, b: number, kb: K): K | null => {
    if (n < 5) return null
    if (a / n >= 0.7) return ka
    if (b / n >= 0.7) return kb
    return null
  }
  return {
    distance: side(t.short, 'short', t.long, 'long'),
    lateral: side(t.left, 'left', t.right, 'right'),
  }
}

export interface StartShapeMatrix {
  counts: Record<ShotStartLine, Record<ShotShape, number>>
  /** Shots with both start line and shape recorded. */
  total: number
  /** The single commonest cell; null when empty or tied. */
  commonest: { startLine: ShotStartLine; shape: ShotShape; count: number } | null
}

/** Start line × shape counts (push-fade, pull-hook…) from shots with both. */
export function startShapeMatrix(points: DispersionPoint[]): StartShapeMatrix {
  const counts = Object.fromEntries(
    SHOT_START_LINES.map((sl) => [sl, Object.fromEntries(SHOT_SHAPES.map((sh) => [sh, 0]))]),
  ) as StartShapeMatrix['counts']
  let total = 0
  for (const p of points) {
    if (p.startLine == null || p.shape == null) continue
    counts[p.startLine][p.shape]++
    total++
  }
  let commonest: StartShapeMatrix['commonest'] = null
  let tied = false
  for (const startLine of SHOT_START_LINES) {
    for (const shape of SHOT_SHAPES) {
      const count = counts[startLine][shape]
      if (count === 0) continue
      if (!commonest || count > commonest.count) {
        commonest = { startLine, shape, count }
        tied = false
      } else if (count === commonest.count) tied = true
    }
  }
  return { counts, total, commonest: tied ? null : commonest }
}

export interface RecentVsAll {
  recent: DispersionStats
  all: DispersionStats
  /** Recent 68% width minus the all-time one, yards (negative = tighter now). */
  width68Change: number
}

/** The most recent `count` shots by played date (undated count as oldest)
 *  against all of them. Null when there are no older shots to compare. */
export function recentVsAll(points: DispersionPoint[], count = 20): RecentVsAll | null {
  if (points.length <= count) return null
  const newestFirst = [...points].sort((a, b) =>
    (b.playedAt ?? '') < (a.playedAt ?? '') ? -1 : (b.playedAt ?? '') > (a.playedAt ?? '') ? 1 : 0,
  )
  const recent = computeDispersionStats(newestFirst.slice(0, count))
  const all = computeDispersionStats(points)
  if (!recent || !all) return null
  return { recent, all, width68Change: 2 * (recent.cone68.lateral - all.cone68.lateral) }
}

/**
 * One shot's end position expressed in the AIM-RELATIVE frame:
 * `alongYards` long of aim (+ = past the aim point), `perpYards` right of
 * the aim line (+ = right). Rotates by the shot's intended (start→aim) line so
 * spreads read correctly on a hole at any bearing. This is the lightweight
 * along/perp pair (used by the live-round overlay); `computeDispersion` shares
 * the same `rotateAroundAim` core but returns full DispersionPoints. Returns
 * null unless start, aim, AND end coords are all finite — start+aim are needed
 * to derive the bearing.
 */
export function aimRelativeOffsets(
  shot: Shot,
): { alongYards: number; perpYards: number } | null {
  if (!hasAimGeometry(shot)) return null
  // Bearing of the intended line (start → aim), compass degrees CW from N.
  const θ = toRadians(bearingDegrees(shot.startLat, shot.startLng, shot.aimLat, shot.aimLng))
  return rotateAroundAim(shot.endLat, shot.endLng, shot.aimLat, shot.aimLng, θ)
}

export interface AimRelativeDispersion {
  /** Mean long offset of the pattern (+ = long), yards. */
  alongMean: number
  /** Mean lateral offset (+ = right of aim) — the player's bias, yards. */
  perpMean: number
  /** 68% / 95% containment half-widths (radii) along each axis, yards. */
  along68: number
  along95: number
  perp68: number
  perp95: number
  /** Surviving aim-relative points (start+aim+end present). */
  points: { alongYards: number; perpYards: number }[]
  /** Count of surviving points — NOT the input length. */
  sampleSize: number
}

/**
 * Aim-relative dispersion across a set of shots (one club's worth, ideally).
 * Skips shots missing start/aim/end; returns null below MIN_SAMPLES_FOR_STATS.
 * Cones use the same 2D containment k-factors as computeDispersionStats.
 */
export function computeAimRelativeDispersion(shots: Shot[]): AimRelativeDispersion | null {
  const points: { alongYards: number; perpYards: number }[] = []
  for (const s of shots) {
    const o = aimRelativeOffsets(s)
    if (o) points.push(o)
  }
  if (points.length < MIN_SAMPLES_FOR_STATS) return null
  const alongs = points.map((p) => p.alongYards)
  const perps = points.map((p) => p.perpYards)
  const alongMean = mean(alongs)
  const perpMean = mean(perps)
  const alongStd = stdDev(alongs, alongMean)
  const perpStd = stdDev(perps, perpMean)
  return {
    alongMean,
    perpMean,
    along68: alongStd * CONE_68_K,
    along95: alongStd * CONE_95_K,
    perp68: perpStd * CONE_68_K,
    perp95: perpStd * CONE_95_K,
    points,
    sampleSize: points.length,
  }
}

export interface ClubTypicalDistance {
  yards: number
  /** 'shots': the median of the player's own shots. 'estimate': the distance
   *  typed in My Bag, used until the club has enough shots. */
  source: 'shots' | 'estimate'
}

/**
 * The one typical distance per club that My Bag, the live club wheel and the
 * review sheet's club guess all show (#1052). The measured median wins once
 * the club has MIN_SAMPLES_FOR_STATS usable shots (the wheel's rule); below
 * that the typed distance stands in as an estimate. Null when neither exists.
 */
export function clubTypicalDistance(
  medianYards: number | null | undefined,
  shots: number,
  typedYards: number | null | undefined,
): ClubTypicalDistance | null {
  if (shots >= MIN_SAMPLES_FOR_STATS && medianYards != null) {
    return { yards: medianYards, source: 'shots' }
  }
  if (typedYards != null) return { yards: typedYards, source: 'estimate' }
  return null
}

export interface DispersionFilter {
  lieType?: LieType
  lieSlopeForward?: LieSlopeForward
  lieSlopeSide?: LieSlopeSide
  /** @deprecated legacy single-slope filter (matches either axis). Prefer
   *  lieSlopeForward / lieSlopeSide. */
  lieSlope?: LieSlope
}

export function filterDispersionByLie(
  points: DispersionPoint[],
  filter: DispersionFilter = {},
): DispersionPoint[] {
  return points.filter((p) => {
    if (filter.lieType && p.lieType !== filter.lieType) return false
    if (
      filter.lieSlopeForward &&
      p.lieSlopeForward !== filter.lieSlopeForward
    ) {
      return false
    }
    if (filter.lieSlopeSide && p.lieSlopeSide !== filter.lieSlopeSide) {
      return false
    }
    if (
      filter.lieSlope &&
      p.lieSlope !== filter.lieSlope &&
      p.lieSlopeForward !== filter.lieSlope &&
      p.lieSlopeSide !== filter.lieSlope
    ) {
      return false
    }
    return true
  })
}

export function getAimCorrection(
  stats: DispersionStats,
  unit: 'yards' | 'meters' = 'yards',
): string {
  const lateralYards = Math.abs(stats.avgLateralOffset)
  if (
    stats.dominantMiss === 'straight' ||
    lateralYards < DOMINANT_MISS_THRESHOLD_YARDS
  ) {
    return 'Your pattern is centered on your aim.'
  }
  const value =
    unit === 'meters'
      ? Math.round(lateralYards * 0.9144)
      : Math.round(lateralYards)
  const singular = unit === 'meters' ? 'metre' : 'yard'
  const plural = unit === 'meters' ? 'metres' : 'yards'
  const noun = value === 1 ? singular : plural
  const oppDir = stats.dominantMiss === 'right' ? 'left' : 'right'
  return `Move your aim ${value} ${noun} ${oppDir} to center your pattern.`
}

// One-line plain-language verdict from the recorded shape + dominant miss.
// Lives here (not in an app) so the web and mobile share cards share one copy.
// Without a shape verdict (too few recorded, or mixed) it speaks only the miss.
export function dispersionVerdict(stats: DispersionStats): string {
  const { shape, dominantMiss } = stats
  if (shape === null || shape === 'mixed') {
    return dominantMiss === 'straight' ? 'Centered on your aim' : `Misses ${dominantMiss}`
  }
  if (shape === 'straight' && dominantMiss === 'straight') return 'Dead straight'
  if (dominantMiss === 'straight') return `A consistent ${shape}`
  if (shape === 'straight') return `Straight, missing ${dominantMiss}`
  return `A ${shape} that leaks ${dominantMiss}`
}
