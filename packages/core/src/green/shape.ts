// Green shape (#1378, reworded #1402): the second line under the tilt.
// Rules, on the interior (collar excluded):
// - two tiers: along the plane's fall line in 1 m bins, one steep band
//   (≥ 4% and ≥ 2.2× the median) in the middle 20–80%, ≤ 30% of the length,
//   flatter on both sides, and a step of ≥ 30 cm. Checked first.
// - ridge or swale: a quadratic explains ≥ 20 points more than the plane, one
//   curvature is past ±K0 with ≥ 6 cm of relief and the other is near 0.
//   Both bent opposite ways past K0 is a saddle: mixed, no words.
// - otherwise the high and low spots of the heights averaged over 4.5 m
//   squares. A low spot ≥ 6 cm below every rim cell is a hollow ("Low in the
//   middle · rises to every edge"). Else, if the fall arrows mostly agree (their resultant is
//   ≥ 0.9 of their summed length) the green is a plain tilt and line 1 says
//   it all. Else the high spot: where it is and the edges the ground falls to.
// Shifted crowns and plain tilts can't be told apart by curvature; the spread
// of the fall directions can (#1402, checked on 33 hand-labelled greens).
import { median } from '../shot-patterns'
import type { DistanceUnit } from '../types'
import { GREEN_CELL_M, type GreenGrid } from './codec'
import { greenCollar } from './slope'
import { endAt, greenHeightWords } from './words'

const MIN_CELLS = 200
const QUADRATIC_GAIN = 0.2
/** Curvature, 1/m: bends 0.5·K0·(10 m)² = 20 cm over a 10 m radius. */
const K0 = 0.004
const RELIEF_MIN_CM = 6
const TIER_STEP_CM = 30
/** Heights are averaged over a square this far either side of each cell. */
const SMOOTH_M = 2
/** A hollow's low spot sits at least this far below every rim cell. */
const HOLLOW_CM = 6
/** Fall arrows this aligned (resultant over summed length) make a plain tilt. */
const ONE_WAY = 0.9
/** An edge counts when it is this far below the high (above the low)… */
const EDGE_MIN_CM = 10
/** …and at least this share of the biggest edge's. */
const EDGE_SHARE = 0.5
/** A spot within this share of the way from the centre to the rim is in the middle. */
const MIDDLE = 0.35
const RIM_BINS = 36

export interface GreenSpot {
  /** Compass bearing from the green's centre. */
  bearingDeg: number
  middle: boolean
}

export type GreenShape =
  /** One-way fall, or too little relief: line 1 says it all. */
  | { kind: 'plain' }
  | { kind: 'two-tiers'; stepCm: number; atM: number }
  | { kind: 'ridge' | 'swale'; axisDeg: number }
  /** A saddle: no single high or low to name. */
  | { kind: 'mixed' }
  /**
   * The high (or low) spot, and the rim's drop below it (rise above it), cm,
   * in 10° compass bins from the green's centre; NaN where no rim cell falls.
   */
  | { kind: 'high' | 'low'; spot: GreenSpot; rimCm: number[] }

function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]!])
  for (let c = 0; c < n; c++) {
    let p = c
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[p]![c]!)) p = r
    if (Math.abs(M[p]![c]!) < 1e-12) return null
    ;[M[c], M[p]] = [M[p]!, M[c]!]
    for (let r = c + 1; r < n; r++) {
      const f = M[r]![c]! / M[c]![c]!
      for (let k = c; k <= n; k++) M[r]![k]! -= f * M[c]![k]!
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r]![n]!
    for (let k = r + 1; k < n; k++) s -= M[r]![k]! * x[k]!
    x[r] = s / M[r]![r]!
  }
  return x
}

function leastSquares(cols: Float64Array[], z: Float64Array): { coef: number[]; residualVar: number } | null {
  const p = cols.length
  const A = cols.map((a) => cols.map((b) => a.reduce((s, v, i) => s + v * b[i]!, 0)))
  const coef = solve(A, cols.map((a) => a.reduce((s, v, i) => s + v * z[i]!, 0)))
  if (!coef) return null
  let sum = 0
  let sum2 = 0
  for (let i = 0; i < z.length; i++) {
    let r = z[i]!
    for (let k = 0; k < p; k++) r -= coef[k]! * cols[k]![i]!
    sum += r
    sum2 += r * r
  }
  return { coef, residualVar: sum2 / z.length - (sum / z.length) ** 2 }
}

function variance(z: Float64Array): number {
  const m = z.reduce((a, b) => a + b, 0) / z.length
  return z.reduce((a, b) => a + (b - m) ** 2, 0) / z.length
}

// numpy.gradient: central differences inside, one-sided at the ends; NaN spreads.
function gradient(p: number[]): number[] {
  return p.map((_, i) => (i === 0 ? p[1]! - p[0]! : i === p.length - 1 ? p[i]! - p[i - 1]! : (p[i + 1]! - p[i - 1]!) / 2))
}

function nanMean(xs: number[]): number {
  const f = xs.filter(Number.isFinite)
  return f.length ? f.reduce((a, b) => a + b, 0) / f.length : NaN
}

function findTier(x: Float64Array, y: Float64Array, z: Float64Array, ux: number, uy: number): { stepCm: number; atM: number } | null {
  const t = x.map((v, i) => v * ux + y[i]! * uy)
  let tMin = Infinity
  let tMax = -Infinity
  for (const v of t) {
    tMin = Math.min(tMin, v)
    tMax = Math.max(tMax, v)
  }
  const nb = Math.ceil(tMax + 1 - tMin) - 1
  if (nb < 2) return null
  const bins: number[][] = Array.from({ length: nb }, () => [])
  t.forEach((v, i) => {
    const k = Math.floor(v - tMin)
    if (k < nb) bins[k]!.push(z[i]!)
  })
  const prof = bins.map((b) => (b.length > 5 ? median(b)! : NaN))
  const sl = gradient(prof).map((v) => 100 * v)
  const good = sl.map(Number.isFinite)
  if (good.filter(Boolean).length <= 12) return null
  const med = median(sl.filter(Number.isFinite).map(Math.abs))!
  const steep = sl.map((v, i) => good[i]! && Math.abs(v) >= Math.max(4, 2.2 * med))
  // The longest run of steep bins (the first, on a tie).
  let a = -1
  let b = -1
  for (let i = 0; i < nb; ) {
    if (!steep[i]) {
      i++
      continue
    }
    let j = i
    while (j + 1 < nb && steep[j + 1]) j++
    if (j - i > b - a) [a, b] = [i, j]
    i = j + 1
  }
  if (a < 0) return null
  const w = b - a + 1
  if (w > 0.3 * nb || a < 0.2 * nb || b > 0.8 * nb) return null
  const lo = sl.slice(0, a).filter(Number.isFinite).map(Math.abs)
  const hi = sl.slice(b + 1).filter(Number.isFinite).map(Math.abs)
  const band = median(sl.slice(a, b + 1).map(Math.abs))!
  const step = Math.abs(nanMean(prof.slice(b + 1, b + 4)) - nanMean(prof.slice(Math.max(a - 3, 0), a))) * 100
  if (lo.length <= 3 || hi.length <= 3 || !(median(lo)! < 0.6 * band) || !(median(hi)! < 0.6 * band) || !(step >= TIER_STEP_CM)) return null
  return { stepCm: Math.round(step), atM: Math.round((a + w / 2) * 10) / 10 }
}

export function greenShape(g: GreenGrid): GreenShape | null {
  const collar = greenCollar(g)
  const { width: W, mask, heightsMm } = g
  const inside = new Uint8Array(mask.length)
  const idx: number[] = []
  for (let j = 0; j < mask.length; j++)
    if (mask[j] && !collar[j]) {
      inside[j] = 1
      idx.push(j)
    }
  if (idx.length < MIN_CELLS) return null

  const n = idx.length
  const x = new Float64Array(n)
  const y = new Float64Array(n)
  const z = new Float64Array(n)
  idx.forEach((j, i) => {
    x[i] = (j % W) * GREEN_CELL_M
    y[i] = -Math.floor(j / W) * GREEN_CELL_M
    z[i] = heightsMm[j]! / 1000
  })
  const cx = x.reduce((a, b) => a + b, 0) / n
  const cy = y.reduce((a, b) => a + b, 0) / n
  for (let i = 0; i < n; i++) {
    x[i]! -= cx
    y[i]! -= cy
  }
  const v = variance(z)
  if (!(v > 0)) return { kind: 'plain' }

  const one = new Float64Array(n).fill(1)
  const plane = leastSquares([one, x, y], z)
  const quad = leastSquares([one, x, y, x.map((a) => a * a), x.map((a, i) => a * y[i]!), y.map((a) => a * a)], z)
  if (!plane || !quad) return { kind: 'plain' }
  const [, e, north] = plane.coef as [number, number, number]
  if (100 * Math.hypot(e, north) > 0.5) {
    const tier = findTier(x, y, z, e / Math.hypot(e, north), north / Math.hypot(e, north))
    if (tier) return { kind: 'two-tiers', ...tier }
  }

  if (plane.residualVar - quad.residualVar >= QUADRATIC_GAIN * v) {
    // Hessian [[p, q], [q, s]] of the quadratic; eigenvalues k0 ≤ k1.
    const [, , , c3, c4, c5] = quad.coef as [number, number, number, number, number, number]
    const p = 2 * c3
    const q = c4
    const s = 2 * c5
    const mid = (p + s) / 2
    const rad = Math.hypot((p - s) / 2, q)
    const k0 = mid - rad
    const k1 = mid + rad
    const L2 = (n * GREEN_CELL_M * GREEN_CELL_M) / Math.PI
    // A ridge's spine runs along k1's eigenvector (the direction that doesn't bend); a swale's along k0's.
    const axis = (k: number, alongX: boolean) => {
      const [ex, ny] = Math.abs(q) > 1e-12 ? [q, k - p] : alongX ? [1, 0] : [0, 1]
      return ((((Math.atan2(ex, ny) * 180) / Math.PI) % 180) + 180) % 180
    }
    if (k0 < -K0 && Math.abs(k1) < K0 / 2 && 50 * -k0 * L2 >= RELIEF_MIN_CM) return { kind: 'ridge', axisDeg: axis(k1, p >= s) }
    if (k1 > K0 && Math.abs(k0) < K0 / 2 && 50 * k1 * L2 >= RELIEF_MIN_CM) return { kind: 'swale', axisDeg: axis(k0, p <= s) }
    if (k0 < -K0 && k1 > K0) return { kind: 'mixed' }
  }
  return spotShape(g, inside)
}

/** Each inside cell's mean height over the inside cells of the square 2 m around it; NaN elsewhere. */
function smoothed(g: GreenGrid, inside: Uint8Array): Float64Array {
  const { width: W, height: H, heightsMm } = g
  // Summed-area tables of height and count, (W + 1) × (H + 1), so the cost doesn't grow with the square.
  const W1 = W + 1
  const sz = new Float64Array(W1 * (H + 1))
  const sn = new Float64Array(W1 * (H + 1))
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const j = r * W + c
      const k = (r + 1) * W1 + c + 1
      sz[k] = (inside[j] ? heightsMm[j]! : 0) + sz[k - 1]! + sz[k - W1]! - sz[k - W1 - 1]!
      sn[k] = inside[j]! + sn[k - 1]! + sn[k - W1]! - sn[k - W1 - 1]!
    }
  const h = Math.round(SMOOTH_M / GREEN_CELL_M)
  const out = new Float64Array(W * H).fill(NaN)
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      if (!inside[r * W + c]) continue
      const a = Math.max(r - h, 0) * W1 + Math.max(c - h, 0)
      const b = Math.max(r - h, 0) * W1 + Math.min(c + h + 1, W)
      const d = Math.min(r + h + 1, H) * W1 + Math.max(c - h, 0)
      const e = Math.min(r + h + 1, H) * W1 + Math.min(c + h + 1, W)
      out[r * W + c] = (sz[e]! - sz[b]! - sz[d]! + sz[a]!) / (sn[e]! - sn[b]! - sn[d]! + sn[a]!)
    }
  return out
}

function spotShape(g: GreenGrid, inside: Uint8Array): GreenShape {
  const { width: W, height: H } = g
  const z = smoothed(g, inside)
  let cx = 0
  let cy = 0
  let m = 0
  let hi = -1
  let lo = -1
  const rim: number[] = []
  // Fall arrows: downhill per cell (mm per cell east, north). Keep their vector sum and their total length.
  let fe = 0
  let fn = 0
  let fLen = 0
  for (let j = 0; j < W * H; j++) {
    if (!inside[j]) continue
    const c = j % W
    const r = (j - c) / W
    cx += c
    cy += r
    m++
    if (hi < 0 || z[j]! > z[hi]!) hi = j
    if (lo < 0 || z[j]! < z[lo]!) lo = j
    if (!(c > 0 && inside[j - 1] && c < W - 1 && inside[j + 1] && r > 0 && inside[j - W] && r < H - 1 && inside[j + W])) {
      rim.push(j)
      continue
    }
    const de = (z[j - 1]! - z[j + 1]!) / 2
    const dn = (z[j + W]! - z[j - W]!) / 2
    fe += de
    fn += dn
    fLen += Math.hypot(de, dn)
  }
  cx /= m
  cy /= m
  let rimLo = Infinity
  for (const j of rim) rimLo = Math.min(rimLo, z[j]!)
  const hollow = rimLo - z[lo]! >= HOLLOW_CM * 10
  if (!hollow && !(fLen > 0 && Math.hypot(fe, fn) < ONE_WAY * fLen)) return { kind: 'plain' }

  const at = hollow ? lo : hi
  const bearing = (j: number) => ((Math.atan2((j % W) - cx, cy - Math.floor(j / W)) * 180) / Math.PI + 360) % 360
  const dist = (j: number) => Math.hypot((j % W) - cx, Math.floor(j / W) - cy)
  const b = bearing(at)
  // How far the green reaches that way: the farthest rim cell within 22.5°.
  let reach = 0
  const bins: number[][] = Array.from({ length: RIM_BINS }, () => [])
  for (const j of rim) {
    const bj = bearing(j)
    if (Math.abs(((bj - b + 540) % 360) - 180) <= 22.5) reach = Math.max(reach, dist(j))
    bins[Math.floor(bj / (360 / RIM_BINS)) % RIM_BINS]!.push(z[j]!)
  }
  const sign = hollow ? -1 : 1
  return {
    kind: hollow ? 'low' : 'high',
    spot: { bearingDeg: b, middle: dist(at) < MIDDLE * Math.max(reach, dist(at)) },
    rimCm: bins.map((zs) => (zs.length ? (sign * (z[at]! - median(zs)!)) / 10 : NaN)),
  }
}

const RIDGE_LINES = ['front to back', 'front left to back right', 'left to right', 'front right to back left']
const SWALE_SIDES = ['left and right', 'front right and back left', 'front and back', 'front left and back right']
const EDGES = ['back', 'right', 'front', 'left'] as const
const OPPOSITE = { back: 'front', right: 'left', front: 'back', left: 'right' } as const

/** Per edge (back, right, front, left): the median of the rim bins within 45° of it. */
function edgeCm(rimCm: number[], approachDeg: number): number[] {
  const step = 360 / rimCm.length
  return EDGES.map((_, e) => {
    const xs: number[] = []
    rimCm.forEach((cm, i) => {
      const off = ((((i + 0.5) * step - approachDeg - 90 * e) % 360) + 540) % 360 - 180
      if (Math.abs(off) <= 45 && Number.isFinite(cm)) xs.push(cm)
    })
    return median(xs) ?? NaN
  })
}

function edgeList(es: string[]): string {
  if (es.length === 4) return 'every edge'
  const s = ['front', 'back', 'left', 'right'].filter((e) => es.includes(e))
  return `the ${s.length === 1 ? s[0] : s.length === 2 ? `${s[0]} and ${s[1]}` : `${s[0]}, ${s[1]} and ${s[2]}`}`
}

/**
 * The second line, relative to the player's approach bearing, in the
 * player's units: "High at the back left · falls to the front and right".
 * Null when line 1 (the tilt) already says it all.
 */
export function shapePhrase(s: GreenShape, approachDeg: number, unit: DistanceUnit): string | null {
  switch (s.kind) {
    case 'plain':
    case 'mixed':
      return null
    case 'two-tiers':
      return `Two tiers · the upper tier is ${greenHeightWords(s.stepCm, unit)} higher`
    case 'ridge':
    case 'swale': {
      const k = Math.floor(((((s.axisDeg - approachDeg) % 180) + 180 + 22.5) % 180) / 45)
      return s.kind === 'ridge'
        ? `Ridge · runs ${RIDGE_LINES[k]}, falls off both sides`
        : `Low through the middle · rises to the ${SWALE_SIDES[k]}`
    }
    case 'high':
    case 'low': {
      const cm = edgeCm(s.rimCm, approachDeg)
      const top = Math.max(...cm.filter(Number.isFinite))
      const at = endAt(s.spot.bearingDeg - approachDeg)
      // The edges the spot sits on aren't away from it.
      const own = s.spot.middle ? [] : at.split(' ')
      const es = EDGES.filter((e, i) => cm[i]! >= Math.max(EDGE_MIN_CM, EDGE_SHARE * top) && !own.includes(e))
      if (!es.length) return null
      // One fall, from the far end: that is line 1's tilt.
      if (s.kind === 'high' && es.length === 1 && own.includes(OPPOSITE[es[0]!])) return null
      const across = es.length === 2 && OPPOSITE[es[0]!] === es[1]
      const where = s.spot.middle ? (across ? 'through the middle' : 'in the middle') : at === 'left' || at === 'right' ? `on the ${at}` : `at the ${at}`
      return `${s.kind === 'high' ? 'High' : 'Low'} ${where} · ${s.kind === 'high' ? 'falls' : 'rises'} to ${edgeList(es)}`
    }
  }
}
