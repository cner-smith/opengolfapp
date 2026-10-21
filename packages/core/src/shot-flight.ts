import type { ShotShape, ShotStartLine } from './constants'

// A shot's flight seen from above, rebuilt from its start, finish and the
// recorded start line + shape. Aim frame in yards: x = right of the aim line,
// y = along it. Angles are degrees from the aim line, + = right; direction φ is
// the unit vector (sin φ, cos φ).
//
// The flight is a circular arc (constant side spin gives a near-constant bend)
// drawn as a cubic Bézier S → p1 → p2 → E. An arc that leaves at φ0 and
// reaches E has its chord bisect the end tangents, so the half-turn is
// β = φC − φ0 and the end tangent is φC + β.

export interface FlightPoint {
  x: number
  y: number
}

/** agree: start line and shape both recorded and the finish fits them.
 *  conflict: the record can't happen (or bends more than MAX_BEND_DEG).
 *  start-only / shape-only: one tag recorded. none: neither, the chord. */
export type FlightKind = 'agree' | 'conflict' | 'start-only' | 'shape-only' | 'none'

export interface FlightControls {
  p1: FlightPoint
  p2: FlightPoint
  kind: FlightKind
}

const START_DEG: Record<ShotStartLine, number> = { pull: -4, on_line: 0, push: 4 }
// The start line is a category, not a measurement: each tag covers a band.
const START_BAND: Record<ShotStartLine, [number, number]> = {
  pull: [-12, -1.5],
  on_line: [-1.5, 1.5],
  push: [1.5, 12],
}
// Which way the ball curves for a right-hander (+1 right) and how much the
// half-turn β is: 2.5° bends a 150 yd fade about 6.5 yd off its start line.
const CURVE: Record<ShotShape, number> = { hook: -1, draw: -1, straight: 0, fade: 1, slice: 1 }
const HALF_TURN_DEG: Record<ShotShape, number> = { hook: 6, draw: 2.5, straight: 0, fade: 2.5, slice: 6 }
/** A straight shot may still bend this much and agree. */
const STRAIGHT_TOLERANCE_DEG = 1.5
/** Beyond this half-turn a shot is a recovery or a bad record: draw the chord. */
const MAX_BEND_DEG = 15

const rad = (deg: number) => (deg * Math.PI) / 180
const dir = (deg: number): FlightPoint => ({ x: Math.sin(rad(deg)), y: Math.cos(rad(deg)) })
const clamp = (v: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, v))

/** The nominal start angle for a start-line tag (pull −4°, on line 0°,
 *  push +4°), mirrored for a left-hander. Also the protractor's rays. */
export function startLineAngleDeg(startLine: ShotStartLine, leftHanded: boolean): number {
  return (leftHanded ? -1 : 1) * START_DEG[startLine]
}

/** The recorded start angle φ0 and the kind, before the bend limit. */
function chooseStart(
  chordDeg: number,
  startLine: ShotStartLine | null,
  shape: ShotShape | null,
  h: number,
): { startDeg: number; kind: FlightKind } {
  const c = shape ? h * CURVE[shape] : 0
  const expectedBend = shape ? c * HALF_TURN_DEG[shape] : 0
  if (startLine && shape) {
    const [lo, hi] = START_BAND[startLine]
    const band: [number, number] = h > 0 ? [lo, hi] : [-hi, -lo]
    // Move the start within its band so the arc bends by about the recorded
    // amount. If it still bends the wrong way (or a straight bends), the record
    // doesn't add up; it is drawn from the clamped start all the same.
    const startDeg = clamp(chordDeg - expectedBend, band)
    const bend = chordDeg - startDeg
    const agrees = c === 0 ? Math.abs(bend) <= STRAIGHT_TOLERANCE_DEG : Math.sign(bend) === c
    return { startDeg, kind: agrees ? 'agree' : 'conflict' }
  }
  if (startLine) return { startDeg: h * START_DEG[startLine], kind: 'start-only' }
  if (shape) return { startDeg: chordDeg - expectedBend, kind: 'shape-only' }
  return { startDeg: chordDeg, kind: 'none' }
}

/**
 * The cubic Bézier controls of a shot's flight from `start` to `finish`. p1
 * leaves exactly on the start angle, p2 arrives along the arc's end tangent,
 * and the curve always ends on `finish`. Tags are mirrored for a left-hander;
 * the geometry never is.
 */
export function flightControls(
  start: FlightPoint,
  finish: FlightPoint,
  startLine: ShotStartLine | null,
  shape: ShotShape | null,
  leftHanded: boolean,
): FlightControls {
  const dx = finish.x - start.x
  const dy = finish.y - start.y
  const L = Math.hypot(dx, dy)
  const chordDeg = (Math.atan2(dx, dy) * 180) / Math.PI
  const chosen = chooseStart(chordDeg, startLine, shape, leftHanded ? -1 : 1)
  let { startDeg, kind } = chosen
  let bend = chordDeg - startDeg
  if (Math.abs(bend) > MAX_BEND_DEG) {
    startDeg = chordDeg
    bend = 0
    if (kind !== 'none') kind = 'conflict'
  }
  // Exact circular-arc handle; tends to L/3 as the bend goes to zero.
  const k =
    Math.abs(bend) < 0.1 ? L / 3 : ((2 * L) / 3) * (Math.tan(rad(bend / 2)) / Math.sin(rad(bend)))
  const u0 = dir(startDeg)
  const uE = dir(chordDeg + bend)
  return {
    p1: { x: start.x + k * u0.x, y: start.y + k * u0.y },
    p2: { x: finish.x - k * uE.x, y: finish.y - k * uE.y },
    kind,
  }
}

/** The cubic Bézier start → p1 → p2 → end sampled at n + 1 evenly spaced t. */
export function cubic(start: FlightPoint, p1: FlightPoint, p2: FlightPoint, end: FlightPoint, n = 48): FlightPoint[] {
  const out: FlightPoint[] = []
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const a = (1 - t) ** 3
    const b = 3 * (1 - t) ** 2 * t
    const c = 3 * (1 - t) * t * t
    const d = t ** 3
    out.push({ x: a * start.x + b * p1.x + c * p2.x + d * end.x, y: a * start.y + b * p1.y + c * p2.y + d * end.y })
  }
  return out
}

/**
 * Where the tee view's shortened stretch ends, yards from the tee: a round
 * 25 in the display unit (`yardsPerUnit` yards each) at about 82% of the
 * nearest of `ys` (finishes, ring edges). 0 when that is inside 90 yd, so a
 * short pattern isn't shortened.
 */
export function teeBreakYards(ys: number[], yardsPerUnit = 1): number {
  const lowY = Math.min(...ys)
  return lowY > 90 ? Math.floor(((lowY / yardsPerUnit) * 0.82) / 25) * 25 * yardsPerUnit : 0
}
