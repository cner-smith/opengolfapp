import {
  calculateShotSG,
  getExpectedStrokes,
  getShotCategory,
  type ShotCategory,
} from '@oga/core'
import type { Database } from '@oga/supabase'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

export interface DetailedHoleScore extends HoleScoreRow {
  holes?: HoleRow | null
  shots?: ShotRow[] | null
}

export interface DetailedRound extends RoundRow {
  hole_scores?: DetailedHoleScore[] | null
}

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

export function haversineYards(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  const d = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return d * 1.09361
}

export function getProximityYards(
  shotEndLat: number,
  shotEndLng: number,
  holeScore: { pin_lat?: number | null; pin_lng?: number | null },
  hole: { pin_lat?: number | null; pin_lng?: number | null },
): number | null {
  const pinLat = holeScore.pin_lat ?? hole.pin_lat
  const pinLng = holeScore.pin_lng ?? hole.pin_lng
  if (pinLat == null || pinLng == null) return null
  return haversineYards(shotEndLat, shotEndLng, pinLat, pinLng)
}

// Lateral miss: signed perpendicular distance from end → aim line, in yards.
// Uses a flat-earth projection — fine for the < ~300 yd shots we care about.
function lateralMissYards(shot: {
  startLat: number
  startLng: number
  aimLat: number
  aimLng: number
  endLat: number
  endLng: number
}): number {
  const M_PER_DEG_LAT = 111320
  const refLat = ((shot.startLat * Math.PI) / 180) as number
  const M_PER_DEG_LNG = 111320 * Math.cos(refLat)
  const ax = (shot.aimLng - shot.startLng) * M_PER_DEG_LNG
  const ay = (shot.aimLat - shot.startLat) * M_PER_DEG_LAT
  const ex = (shot.endLng - shot.startLng) * M_PER_DEG_LNG
  const ey = (shot.endLat - shot.startLat) * M_PER_DEG_LAT
  const aimLen = Math.hypot(ax, ay)
  if (aimLen === 0) return 0
  // Cross product magnitude / |aim| = perpendicular distance (meters).
  const lateralMeters = Math.abs(ax * ey - ay * ex) / aimLen
  return lateralMeters * 1.09361
}

// ---------------------------------------------------------------------------
// Shape helpers
// ---------------------------------------------------------------------------

interface FlatHoleScore {
  hs: HoleScoreRow
  hole: HoleRow
  shots: ShotRow[]
}

function flatten(rounds: DetailedRound[]): FlatHoleScore[] {
  const out: FlatHoleScore[] = []
  for (const r of rounds) {
    for (const hs of r.hole_scores ?? []) {
      if (!hs.holes) continue
      out.push({
        hs,
        hole: hs.holes,
        shots: (hs.shots ?? []).slice().sort((a, b) => a.shot_number - b.shot_number),
      })
    }
  }
  return out
}

function safe(n: number): number | null {
  return Number.isFinite(n) ? n : null
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return (numerator / denominator) * 100
}

// ---------------------------------------------------------------------------
// Section 1: Strokes Gained
// ---------------------------------------------------------------------------

export interface SGAverages {
  offTee: number | null
  approach: number | null
  aroundGreen: number | null
  putting: number | null
}

export function sgAverages(rounds: DetailedRound[]): SGAverages {
  const keys: Array<['sg_off_tee' | 'sg_approach' | 'sg_around_green' | 'sg_putting', keyof SGAverages]> = [
    ['sg_off_tee', 'offTee'],
    ['sg_approach', 'approach'],
    ['sg_around_green', 'aroundGreen'],
    ['sg_putting', 'putting'],
  ]
  const out: SGAverages = { offTee: null, approach: null, aroundGreen: null, putting: null }
  for (const [col, label] of keys) {
    const values = rounds
      .map((r) => r[col])
      .filter((v): v is number => v != null)
    if (values.length === 0) {
      out[label] = null
    } else {
      out[label] = values.reduce((a, b) => a + b, 0) / values.length
    }
  }
  return out
}

export interface SGTrendPoint {
  date: string
  offTee: number
  approach: number
  aroundGreen: number
  putting: number
}

export function sgTrend(rounds: DetailedRound[]): SGTrendPoint[] {
  return [...rounds]
    .reverse()
    .filter((r) => r.sg_total != null)
    .map((r) => ({
      date: r.played_at,
      offTee: r.sg_off_tee ?? 0,
      approach: r.sg_approach ?? 0,
      aroundGreen: r.sg_around_green ?? 0,
      putting: r.sg_putting ?? 0,
    }))
}

const APPROACH_BANDS = [
  { key: 'b50_100', label: '50–100 yd', min: 50, max: 100 },
  { key: 'b100_150', label: '100–150 yd', min: 100, max: 150 },
  { key: 'b150_200', label: '150–200 yd', min: 150, max: 200 },
  { key: 'b200_plus', label: '200+ yd', min: 200, max: Infinity },
] as const

export interface ApproachBandStat {
  key: string
  label: string
  avgSg: number | null
  shots: number
}

// Per-shot SG for approach shots, bucketed by start distance to target.
// Falls back to expected-strokes interpolation using the user's handicap.
export function approachByDistance(
  rounds: DetailedRound[],
  handicap: number,
): ApproachBandStat[] {
  const buckets: Record<string, { sgSum: number; n: number }> = {}
  for (const band of APPROACH_BANDS) buckets[band.key] = { sgSum: 0, n: 0 }

  for (const { hole, shots } of flatten(rounds)) {
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i]!
      if (s.distance_to_target == null) continue
      const category = getShotCategory(
        {
          lieType: s.lie_type ?? undefined,
          distanceToTarget: s.distance_to_target,
        },
        hole.par,
        s.shot_number,
      )
      if (category !== 'approach') continue

      const band = APPROACH_BANDS.find(
        (b) => s.distance_to_target! >= b.min && s.distance_to_target! < b.max,
      )
      if (!band) continue

      const startExpected = getExpectedStrokes(
        category,
        s.distance_to_target,
        undefined,
        handicap,
      )
      if (startExpected == null) continue

      let endExpected = 0
      const next = shots[i + 1]
      if (next && (next.distance_to_target != null || next.lie_type === 'green')) {
        const nextCat = getShotCategory(
          {
            lieType: next.lie_type ?? undefined,
            distanceToTarget: next.distance_to_target ?? undefined,
          },
          hole.par,
          next.shot_number,
        )
        const nextDistFt =
          next.lie_type === 'green' ? next.putt_distance_ft ?? undefined : undefined
        const nextExpected = getExpectedStrokes(
          nextCat,
          next.distance_to_target ?? undefined,
          nextDistFt ?? undefined,
          handicap,
        )
        if (nextExpected != null) endExpected = nextExpected
      }
      const sg = calculateShotSG(startExpected, endExpected)
      const penaltyAdjust = s.penalty || s.ob ? -1 : 0
      buckets[band.key]!.sgSum += sg + penaltyAdjust
      buckets[band.key]!.n += 1
    }
  }

  return APPROACH_BANDS.map((b) => ({
    key: b.key,
    label: b.label,
    avgSg: buckets[b.key]!.n > 0 ? buckets[b.key]!.sgSum / buckets[b.key]!.n : null,
    shots: buckets[b.key]!.n,
  }))
}

// ---------------------------------------------------------------------------
// Section 2: Scoring
// ---------------------------------------------------------------------------

export interface ScoringStats {
  avgScore: number | null
  avgPar3: number | null
  avgPar4: number | null
  avgPar5: number | null
  front9Avg: number | null
  back9Avg: number | null
  bestRound: number | null
  worstRound: number | null
}

export function scoringStats(rounds: DetailedRound[]): ScoringStats {
  const totalScores = rounds
    .map((r) => r.total_score)
    .filter((v): v is number => v != null)
  const avgScore = totalScores.length
    ? totalScores.reduce((a, b) => a + b, 0) / totalScores.length
    : null

  const byPar: Record<3 | 4 | 5, number[]> = { 3: [], 4: [], 5: [] }
  const front: number[] = []
  const back: number[] = []
  for (const { hs, hole } of flatten(rounds)) {
    if (hs.score == null) continue
    if (hole.par === 3 || hole.par === 4 || hole.par === 5) {
      byPar[hole.par as 3 | 4 | 5].push(hs.score)
    }
    if (hole.number >= 1 && hole.number <= 9) front.push(hs.score)
    else if (hole.number >= 10 && hole.number <= 18) back.push(hs.score)
  }

  const avg = (xs: number[]): number | null =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null

  return {
    avgScore,
    avgPar3: avg(byPar[3]),
    avgPar4: avg(byPar[4]),
    avgPar5: avg(byPar[5]),
    front9Avg: avg(front),
    back9Avg: avg(back),
    bestRound: totalScores.length ? Math.min(...totalScores) : null,
    worstRound: totalScores.length ? Math.max(...totalScores) : null,
  }
}

export interface ScoringDistributionSlice {
  key: 'eagleOrBetter' | 'birdie' | 'par' | 'bogey' | 'double' | 'triplePlus'
  label: string
  count: number
  pct: number
  color: string
}

export function scoringDistribution(rounds: DetailedRound[]): {
  slices: ScoringDistributionSlice[]
  total: number
} {
  const counts = {
    eagleOrBetter: 0,
    birdie: 0,
    par: 0,
    bogey: 0,
    double: 0,
    triplePlus: 0,
  }
  let total = 0
  for (const { hs, hole } of flatten(rounds)) {
    if (hs.score == null) continue
    total += 1
    const d = hs.score - hole.par
    if (d <= -2) counts.eagleOrBetter += 1
    else if (d === -1) counts.birdie += 1
    else if (d === 0) counts.par += 1
    else if (d === 1) counts.bogey += 1
    else if (d === 2) counts.double += 1
    else counts.triplePlus += 1
  }
  const order: Array<{
    key: ScoringDistributionSlice['key']
    label: string
    color: string
  }> = [
    { key: 'eagleOrBetter', label: 'Eagle+', color: '#1F3D2C' },
    { key: 'birdie', label: 'Birdie', color: '#1F3D2C' },
    { key: 'par', label: 'Par', color: '#9F9580' },
    { key: 'bogey', label: 'Bogey', color: '#A66A1F' },
    { key: 'double', label: 'Double', color: '#A33A2A' },
    { key: 'triplePlus', label: 'Triple+', color: '#6E2418' },
  ]
  const slices = order.map((o) => ({
    ...o,
    count: counts[o.key],
    pct: total > 0 ? (counts[o.key] / total) * 100 : 0,
  }))
  return { slices, total }
}

// ---------------------------------------------------------------------------
// Section 3: Ball Striking
// ---------------------------------------------------------------------------

export interface BallStrikingStats {
  fairwayPct: number | null
  girPct: number | null
  drivingDistanceAvg: number | null
  drivingSampleSize: number
  proximityAvg: number | null
  proximitySampleRounds: number
}

export function ballStrikingStats(rounds: DetailedRound[]): BallStrikingStats {
  let fwHit = 0
  let fwTotal = 0
  let girTotal = 0
  let holesPlayed = 0
  for (const r of rounds) {
    fwHit += r.fairways_hit ?? 0
    fwTotal += r.fairways_total ?? 0
    girTotal += r.gir ?? 0
    holesPlayed += (r.hole_scores?.length ?? 0)
  }

  const driveDistances: number[] = []
  const proximities: number[] = []
  const roundsWithProximity = new Set<string>()

  for (const r of rounds) {
    for (const hs of r.hole_scores ?? []) {
      const hole = hs.holes
      if (!hole) continue
      const shots = (hs.shots ?? [])
        .slice()
        .sort((a, b) => a.shot_number - b.shot_number)
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i]!
        // Driver tee shots — distance from start to end (haversine).
        if (
          s.club === 'driver' &&
          s.lie_type === 'tee' &&
          s.start_lat != null &&
          s.start_lng != null &&
          s.end_lat != null &&
          s.end_lng != null
        ) {
          const d = haversineYards(s.start_lat, s.start_lng, s.end_lat, s.end_lng)
          if (d > 50 && d < 450) driveDistances.push(d)
        }

        // Approach proximity — only "approach" category shots, with end coords
        // and a pin (per-round preferred).
        const category = getShotCategory(
          {
            lieType: s.lie_type ?? undefined,
            distanceToTarget: s.distance_to_target ?? undefined,
          },
          hole.par,
          s.shot_number,
        )
        if (
          category === 'approach' &&
          s.distance_to_target != null &&
          s.distance_to_target > 30 &&
          s.end_lat != null &&
          s.end_lng != null
        ) {
          const prox = getProximityYards(s.end_lat, s.end_lng, hs, hole)
          if (prox != null && prox < 100) {
            proximities.push(prox)
            roundsWithProximity.add(r.id)
          }
        }
      }
    }
  }

  return {
    fairwayPct: pct(fwHit, fwTotal),
    girPct: holesPlayed > 0 ? pct(girTotal, holesPlayed) : null,
    drivingDistanceAvg:
      driveDistances.length > 0
        ? driveDistances.reduce((a, b) => a + b, 0) / driveDistances.length
        : null,
    drivingSampleSize: driveDistances.length,
    proximityAvg:
      proximities.length > 0
        ? proximities.reduce((a, b) => a + b, 0) / proximities.length
        : null,
    proximitySampleRounds: roundsWithProximity.size,
  }
}

// ---------------------------------------------------------------------------
// Section 4: Short Game
// ---------------------------------------------------------------------------

export interface ShortGameStats {
  puttsPerRound: number | null
  puttsPerGir: number | null
  threePuttPct: number | null
  upAndDownPct: number | null
  scramblingPct: number | null
  sandSavePct: number | null
}

const AROUND_GREEN_LIES = new Set(['sand', 'fringe', 'rough', 'recovery'])

export function shortGameStats(rounds: DetailedRound[]): ShortGameStats {
  const puttsTotals = rounds
    .map((r) => r.total_putts)
    .filter((v): v is number => v != null)

  let puttsOnGirHoles = 0
  let girHoleCount = 0
  let threePuttHoles = 0
  let totalHoles = 0
  let upDownChances = 0
  let upDownMakes = 0
  let scrambleChances = 0
  let scrambleMakes = 0
  let sandChances = 0
  let sandMakes = 0

  for (const { hs, hole, shots } of flatten(rounds)) {
    totalHoles += 1
    if (hs.gir === true) {
      girHoleCount += 1
      puttsOnGirHoles += hs.putts ?? 0
    }
    if ((hs.putts ?? 0) >= 3) threePuttHoles += 1
    if (hs.gir === false) {
      upDownChances += 1
      if (hs.score <= hole.par) upDownMakes += 1
    }
    const hadAroundGreen = shots.some((s) =>
      s.lie_type ? AROUND_GREEN_LIES.has(s.lie_type) : false,
    )
    if (hadAroundGreen) {
      scrambleChances += 1
      if (hs.score <= hole.par) scrambleMakes += 1
    }
    const hadSand = shots.some((s) => s.lie_type === 'sand')
    if (hadSand) {
      sandChances += 1
      if (hs.score <= hole.par) sandMakes += 1
    }
  }

  return {
    puttsPerRound: puttsTotals.length
      ? puttsTotals.reduce((a, b) => a + b, 0) / puttsTotals.length
      : null,
    puttsPerGir:
      girHoleCount > 0 ? puttsOnGirHoles / girHoleCount : null,
    threePuttPct: pct(threePuttHoles, totalHoles),
    upAndDownPct: pct(upDownMakes, upDownChances),
    scramblingPct: pct(scrambleMakes, scrambleChances),
    sandSavePct: pct(sandMakes, sandChances),
  }
}

// ---------------------------------------------------------------------------
// Section 5: Patterns
// ---------------------------------------------------------------------------

export interface MissTendencyEntry {
  result: string
  count: number
  pct: number
}

export function missTendency(rounds: DetailedRound[]): MissTendencyEntry[] {
  const counts = new Map<string, number>()
  let total = 0
  for (const { shots } of flatten(rounds)) {
    for (const s of shots) {
      if (!s.shot_result) continue
      total += 1
      counts.set(s.shot_result, (counts.get(s.shot_result) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([result, count]) => ({
      result,
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count)
}

const RESULT_QUALITY: Record<string, number> = {
  solid: 1,
  push_right: 0,
  pull_left: 0,
  fat: -1,
  thin: -1,
  topped: -1,
  shank: -1,
  penalty: -1,
  ob: -1,
}

export interface CostlyLieEntry {
  lie: string
  avgQuality: number
  shots: number
}

// Cheap proxy for "most costly lie" — averages a quality score over each
// shot's result. Negative numbers = costly.
export function costlyLies(rounds: DetailedRound[]): CostlyLieEntry[] {
  const buckets = new Map<string, { sum: number; n: number }>()
  for (const { shots } of flatten(rounds)) {
    for (const s of shots) {
      if (!s.lie_type || !s.shot_result) continue
      const q = RESULT_QUALITY[s.shot_result] ?? 0
      const b = buckets.get(s.lie_type) ?? { sum: 0, n: 0 }
      b.sum += q
      b.n += 1
      buckets.set(s.lie_type, b)
    }
  }
  return [...buckets.entries()]
    .filter(([, b]) => b.n >= 5)
    .map(([lie, b]) => ({ lie, avgQuality: b.sum / b.n, shots: b.n }))
    .sort((a, b) => a.avgQuality - b.avgQuality)
}

export interface ClubAccuracyEntry {
  club: string
  avgLateralYards: number
  shots: number
}

export function clubAccuracy(rounds: DetailedRound[]): ClubAccuracyEntry[] {
  const buckets = new Map<string, { sum: number; n: number }>()
  for (const { shots } of flatten(rounds)) {
    for (const s of shots) {
      if (!s.club) continue
      if (
        s.start_lat == null ||
        s.start_lng == null ||
        s.aim_lat == null ||
        s.aim_lng == null ||
        s.end_lat == null ||
        s.end_lng == null
      ) {
        continue
      }
      const lateral = lateralMissYards({
        startLat: s.start_lat,
        startLng: s.start_lng,
        aimLat: s.aim_lat,
        aimLng: s.aim_lng,
        endLat: s.end_lat,
        endLng: s.end_lng,
      })
      if (!Number.isFinite(lateral)) continue
      const b = buckets.get(s.club) ?? { sum: 0, n: 0 }
      b.sum += lateral
      b.n += 1
      buckets.set(s.club, b)
    }
  }
  return [...buckets.entries()]
    .filter(([, b]) => b.n >= 3)
    .map(([club, b]) => ({ club, avgLateralYards: b.sum / b.n, shots: b.n }))
    .sort((a, b) => a.avgLateralYards - b.avgLateralYards)
}

export interface RecoveryRateStat {
  recoveryPct: number | null
  totalRoughShots: number
}

export function recoveryFromRough(rounds: DetailedRound[]): RecoveryRateStat {
  let total = 0
  let recovered = 0
  for (const { shots } of flatten(rounds)) {
    for (let i = 0; i < shots.length; i++) {
      const s = shots[i]!
      if (s.lie_type !== 'rough') continue
      total += 1
      const next = shots[i + 1]
      if (!next) continue
      if (next.lie_type === 'green' || next.lie_type === 'fairway') {
        recovered += 1
      }
    }
  }
  return {
    recoveryPct: pct(recovered, total),
    totalRoughShots: total,
  }
}

// ---------------------------------------------------------------------------
// Combined entry point
// ---------------------------------------------------------------------------

export interface DetailedStats {
  rounds: number
  holesPlayed: number
  sg: SGAverages
  sgTrend: SGTrendPoint[]
  approachByDistance: ApproachBandStat[]
  scoring: ScoringStats
  scoringDistribution: ReturnType<typeof scoringDistribution>
  ballStriking: BallStrikingStats
  shortGame: ShortGameStats
  missTendency: MissTendencyEntry[]
  costlyLies: CostlyLieEntry[]
  clubAccuracy: ClubAccuracyEntry[]
  recovery: RecoveryRateStat
}

export function computeDetailedStats(
  rounds: DetailedRound[],
  handicap: number,
): DetailedStats {
  const holesPlayed = rounds.reduce(
    (sum, r) => sum + (r.hole_scores?.length ?? 0),
    0,
  )
  return {
    rounds: rounds.length,
    holesPlayed,
    sg: sgAverages(rounds),
    sgTrend: sgTrend(rounds),
    approachByDistance: approachByDistance(rounds, handicap),
    scoring: scoringStats(rounds),
    scoringDistribution: scoringDistribution(rounds),
    ballStriking: ballStrikingStats(rounds),
    shortGame: shortGameStats(rounds),
    missTendency: missTendency(rounds),
    costlyLies: costlyLies(rounds),
    clubAccuracy: clubAccuracy(rounds),
    recovery: recoveryFromRough(rounds),
  }
}

// Re-export so consumers can import the shape constants.
export const APPROACH_BAND_KEYS = APPROACH_BANDS.map((b) => b.key)
export type { ShotCategory }
export { safe }
