import { clubNoun, type ShotShape, type ShotStartLine } from './constants'
import { startLineAngleDeg, teeBreakYards, type FlightPoint } from './shot-flight'
import { NOT_RECORDED, distanceUnitAbbr, type ColourBy } from './shot-pattern-words'
import { shapeTally, startLineTally, type DispersionPoint, type DispersionStats } from './shot-patterns'
import type { DistanceUnit } from './types'

// The Patterns charts' geometry, shared by web and the app. Yards in the aim
// frame (x right, y along); `yardsPerUnit` is yards per display unit (1 for
// yards, 1/0.9144 for metres), as teeBreakYards takes it. Pixel layout (the
// plot box) belongs to each app; the rules for what fits, where the break
// falls and how the axes step live here.

/** The 95% spread a chart must hold: the average finish ± cone95. */
export type RingSpread = Pick<DispersionStats, 'avgLateralOffset' | 'avgDistanceOffset' | 'cone95'>

/** Room either side and beyond the farthest mark. */
const PAD_ACROSS = 1.08
const PAD_BEYOND_UNITS = 4
const MIN_HALF_WIDTH_YD = 10
/** Steeper than this and the shortened stretch leaves the tee flat: every
 *  flight would start sideways. */
const MAX_POWER = 3
/** With no break, the start-line wedge runs to this share of the aim. */
const WEDGE_SHARE = 0.35

/** Where the tee view's shortened stretch ends, yards from the tee: short of
 *  the nearest finish, the 95% ring's near edge and the aim (teeBreakYards). */
export function teeBreakFor(points: readonly DispersionPoint[], stats: RingSpread | null, avgAim: number, yardsPerUnit: number): number {
  const ys = points.map((p) => avgAim + p.distanceOffsetYards)
  if (stats) ys.push(avgAim + stats.avgDistanceOffset - stats.cone95.distance)
  return teeBreakYards([...ys, avgAim], yardsPerUnit)
}

/** The tee view's plot in px: its left and right edges, the top of the drawn
 *  area, the tee's y, and the least height the shortened band may have. */
export interface TeePlotBox {
  left: number
  right: number
  top: number
  teeY: number
  minBandPx: number
}

export interface TeeView {
  /** The break, yards from the tee (0 = nothing shortened). */
  brk: number
  /** The far end of the plot, yards. */
  maxY: number
  /** The lateral yards drawn at the middle of the plot. */
  centre: number
  /** px per yard above the break, across and along. */
  scale: number
  /** The shortened band's height in px. */
  comp: number
  x: (lateral: number) => number
  y: (distance: number) => number
  /** The straight push / pull wedge: half-width `x` at `d` yards out. */
  wedge: { x: number; d: number }
}

/**
 * The tee view's projection. Above the break one true scale (across = along);
 * below it a power curve comp·(d/brk)^r with r = scale·brk/comp, which meets
 * the true scale at the break with the same slope, so no flight kinks. The
 * plot holds every finish, both 95% rings (the stats and the ghost), the
 * flights past the break and the wedge, so a layer toggle never rescales it.
 */
export function teeView(
  input: {
    /** Every finish drawn, older ones included. */
    points: readonly DispersionPoint[]
    /** Every flight drawn, sampled, tee frame yards. */
    flights: readonly (readonly FlightPoint[])[]
    stats: RingSpread | null
    ghost: RingSpread | null
    avgAim: number
    yardsPerUnit: number
  },
  box: TeePlotBox,
): TeeView {
  const { points, flights, stats, ghost, avgAim, yardsPerUnit } = input
  const brk = teeBreakFor(points, stats, avgAim, yardsPerUnit)
  const rings = [stats, ghost].filter((s): s is RingSpread => s != null)
  const ys = [
    ...points.map((p) => avgAim + p.distanceOffsetYards),
    ...rings.map((s) => avgAim + s.avgDistanceOffset + s.cone95.distance),
    avgAim,
  ]
  const maxY = Math.max(...ys) + PAD_BEYOND_UNITS * yardsPerUnit

  const wedgeD = brk || avgAim * WEDGE_SHARE
  // The wedge is symmetric (± the push angle), so the hand doesn't matter.
  const wedgeX = Math.tan((Math.abs(startLineAngleDeg('push', false)) * Math.PI) / 180) * wedgeD
  const xs = [
    0,
    -wedgeX,
    wedgeX,
    ...flights.flatMap((path) => path.filter((q) => q.y >= brk).map((q) => q.x)),
    ...points.map((p) => p.lateralOffsetYards),
    ...rings.flatMap((s) => [s.avgLateralOffset - s.cone95.lateral, s.avgLateralOffset + s.cone95.lateral]),
  ]
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const halfW = Math.max((hi - lo) / 2, MIN_HALF_WIDTH_YD) * PAD_ACROSS
  const centre = (lo + hi) / 2

  // The band is at least minBandPx tall, and tall enough that its power stays
  // at or under MAX_POWER.
  const H = box.teeY - box.top
  const wide = (box.right - box.left) / 2 / halfW
  const steep = Math.min(H / (maxY - brk + brk / MAX_POWER), wide)
  const comp = brk > 0 ? Math.max(box.minBandPx, (steep * brk) / MAX_POWER) : 0
  const scale = Math.min((H - comp) / (maxY - brk), wide)

  const midX = (box.left + box.right) / 2
  const r = brk > 0 ? (scale * brk) / comp : 1
  return {
    brk,
    maxY,
    centre,
    scale,
    comp,
    x: (l) => midX + (l - centre) * scale,
    y: (d) => (d <= brk ? box.teeY - (brk > 0 ? Math.pow(Math.max(d, 0) / brk, r) * comp : 0) : box.teeY - comp - (d - brk) * scale),
    wedge: { x: wedgeX, d: wedgeD },
  }
}

/**
 * The tee view's distance rules, in display units: a rule every 5, 10 or 25,
 * labelled every 10, 25 or 50, from the first step past the break to maxY, and
 * a 10 or 25 scale bar. Each step is the smallest that still leaves room
 * (14 / 12 px between rules, 26 px between labels, a 30 px bar).
 */
export function teeAxis(scale: number, brk: number, maxY: number, yardsPerUnit: number) {
  const px = (units: number) => units * yardsPerUnit * scale
  const ruleStep = px(5) >= 14 ? 5 : px(10) >= 12 ? 10 : 25
  const labelStep = px(10) >= 26 ? 10 : px(25) >= 26 ? 25 : 50
  const barStep = px(10) >= 30 ? 10 : 25
  const rules: { d: number; label: boolean }[] = []
  const end = maxY / yardsPerUnit + 1e-9
  for (let d = Math.ceil((brk / yardsPerUnit + 1) / ruleStep) * ruleStep; d <= end; d += ruleStep) {
    rules.push({ d, label: d % labelStep === 0 })
  }
  return { ruleStep, labelStep, barStep, rules }
}

/**
 * The aim view's square grid. Its half-width (rounded up to 5 display units)
 * holds every shot and both 95% rings, the stats and the ghost, so a layer
 * toggle never rescales it. Squares of 5 units, or 10 under 14 px; rules on
 * multiples of the square from the aim lines out to the edge, heavy every 10
 * units, labelled on every rule or every other one under 19 px, never on the
 * aim lines or the edge.
 */
export function aimGrid(
  points: readonly DispersionPoint[],
  stats: RingSpread | null,
  ghost: RingSpread | null,
  yardsPerUnit: number,
  areaPx: number,
) {
  const reachOf = (s: RingSpread) => [
    Math.abs(s.avgLateralOffset) + s.cone95.lateral,
    Math.abs(s.avgDistanceOffset) + s.cone95.distance,
  ]
  const reach = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
    ...(stats ? reachOf(stats) : []),
    ...(ghost ? reachOf(ghost) : []),
    10 * yardsPerUnit,
  )
  const halfUnits = Math.ceil(((reach / yardsPerUnit) * PAD_ACROSS) / 5) * 5
  const half = halfUnits * yardsPerUnit
  const scale = areaPx / 2 / half
  const step = 5 * yardsPerUnit * scale >= 14 ? 5 : 10
  const labelEvery = step * yardsPerUnit * scale >= 19 ? step : step * 2
  const rules: { v: number; major: boolean; label: boolean }[] = []
  const n = Math.floor(halfUnits / step)
  for (let k = -n; k <= n; k++) {
    const v = k * step
    rules.push({ v, major: v % 10 === 0, label: v !== 0 && Math.abs(v) !== halfUnits && v % labelEvery === 0 })
  }
  return { half, halfUnits, scale, step, rules }
}

/** The aim view's pencil brackets in px: the average ± the 68% half-width and
 *  half-depth, which is the upright box round the tilted ring. */
export function ringBracket(
  stats: Pick<DispersionStats, 'avgLateralOffset' | 'avgDistanceOffset' | 'cone68'>,
  px: (lateral: number) => number,
  py: (distance: number) => number,
) {
  return {
    l: px(stats.avgLateralOffset - stats.cone68.lateral),
    r: px(stats.avgLateralOffset + stats.cone68.lateral),
    t: py(stats.avgDistanceOffset + stats.cone68.distance),
    b: py(stats.avgDistanceOffset - stats.cone68.distance),
  }
}

/** Where the bracket words go: the middle of each bracket, kept clear of the
 *  grid's corners (`area` = the square's left, top and side in px). */
export function bracketLabelAt(
  box: { l: number; r: number; t: number; b: number },
  area: { left: number; top: number; size: number },
) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    acrossX: clamp((box.l + box.r) / 2, area.left + 48, area.left + area.size - 48),
    deepY: clamp((box.t + box.b) / 2, area.top + 14, area.top + area.size - 16),
  }
}

/** A group needs this many shots before the tee view draws its typical flight. */
export const MIN_SHOTS_FOR_TYPICAL_FLIGHT = 3

export interface TypicalFlight {
  /** The group's mean finish in the tee frame (x right, y from the tee). */
  end: FlightPoint
  startLine: ShotStartLine | null
  shape: ShotShape | null
}

/**
 * One group's typical flight on the tee view (drawn over 40 shots, one per
 * group): its mean finish, aimed at `avgAim`, leaving on the start line and
 * bending by the shape that the group's verdicts name (startLineTally /
 * shapeTally: the commonest holds half of 5+ recorded, so the line never says
 * more than the numbers do). A group coloured by start line or shape passes
 * its own value in `fixed`. Null under MIN_SHOTS_FOR_TYPICAL_FLIGHT shots.
 */
export function typicalFlight(
  points: readonly DispersionPoint[],
  avgAim: number,
  leftHanded: boolean,
  fixed: { startLine?: ShotStartLine; shape?: ShotShape } = {},
): TypicalFlight | null {
  if (points.length < MIN_SHOTS_FOR_TYPICAL_FLIGHT) return null
  const mean = (f: (p: DispersionPoint) => number) => points.reduce((a, p) => a + f(p), 0) / points.length
  const named = <K extends string>(v: K | 'mixed' | null): K | null => (v == null || v === 'mixed' ? null : v)
  return {
    end: { x: mean((p) => p.lateralOffsetYards), y: avgAim + mean((p) => p.distanceOffsetYards) },
    startLine: fixed.startLine ?? named(startLineTally([...points], leftHanded).verdict),
    shape: fixed.shape ?? named(shapeTally([...points], leftHanded).verdict),
  }
}

/** What a coloured group's typical flight keeps as its own: a start-line
 *  group its start line, a shape group its shape. The "not recorded" group and
 *  the other colourings keep nothing, so their verdicts decide. */
export function typicalFlightFixed(colourBy: ColourBy, key: string): { startLine?: ShotStartLine; shape?: ShotShape } {
  if (key === NOT_RECORDED) return {}
  if (colourBy === 'start') return { startLine: key as ShotStartLine }
  if (colourBy === 'shape') return { shape: key as ShotShape }
  return {}
}

/** A dot a tap can pick on a chart; `older` = a pencil dot under Latest. */
export interface PickableDot {
  id: string
  x: number
  y: number
  older?: boolean
}

/**
 * The dot a tap at (x, y) picks: the nearest within `radius`, but a latest
 * dot within reach always beats an older (pencil) one, so an older shot under
 * the pattern never takes a latest shot's tap (the web stacks the latest dots
 * on top for the same reason). Null when nothing is within reach.
 */
export function pickDot<T extends PickableDot>(dots: readonly T[], x: number, y: number, radius: number): T | null {
  let best: T | null = null
  let bestD = Infinity
  for (const d of dots) {
    const dist = Math.hypot(d.x - x, d.y - y)
    if (dist > radius) continue
    const beats = best == null || (best.older && !d.older) || (!!best.older === !!d.older && dist <= bestD)
    if (beats) {
      best = d
      bestD = dist
    }
  }
  return best
}

/** The widest gap note shows past this many display units (yards or metres). */
const WIDE_GAP_UNITS = 25

/**
 * The Patterns club ladder's notes. `typical` is each club's typical distance
 * in the player's unit (null without a number). `key` explains the small gap
 * numbers once two neighbouring clubs both have one; `widest` names the
 * biggest step between numbered clubs (skipping clubs without a number, never
 * the putter) when it is over 25 units.
 */
export function clubLadderNotes<C extends string>(
  clubs: readonly C[],
  typical: (club: C) => number | null,
  unit: DistanceUnit,
): { key: string | null; widest: string | null } {
  const numbered = clubs.filter((c) => c !== 'putter' && typical(c) != null)
  let widest: { from: C; to: C; size: number } | null = null
  for (let i = 1; i < numbered.length; i++) {
    const size = typical(numbered[i - 1]!)! - typical(numbered[i]!)!
    if (!widest || size > widest.size) widest = { from: numbered[i - 1]!, to: numbered[i]!, size }
  }
  const neighbours = clubs.some((c, j) => j > 0 && c !== 'putter' && typical(c) != null && typical(clubs[j - 1]!) != null)
  return {
    key: neighbours ? 'The small number on each rule is the gap between clubs.' : null,
    widest:
      widest && widest.size > WIDE_GAP_UNITS
        ? `${widest.size} ${distanceUnitAbbr(unit)} between your ${clubNoun(widest.from)} and ${clubNoun(widest.to)}, the widest gap in the bag.`
        : null,
  }
}
