// Green shape v1 (#1378): planar, two tiers, crown, ridge, or no single
// slope. The round-4 rule (#1379), fitted on the interior (collar excluded):
// - two tiers: along the plane's fall line in 1 m bins, one steep band
//   (≥ 4% and ≥ 2.2× the median) in the middle 20–80%, ≤ 30% of the length,
//   flatter on both sides, and a step of ≥ 12 cm. Checked first.
// - planar: the plane explains ≥ 85% of the height variance.
// - else, if a quadratic explains ≥ 20 points more, its curvatures decide:
//   both < −K0 with the top inside → crown; one < −K0 with ≥ 6 cm of relief
//   and the other near 0 → ridge. Bowl, saddle and swale wait for v2.
// - anything else: no single slope.
// The two-tier rule flagged 14% of Oklahoma greens; it needs tuning against
// hand-labelled greens before it ships.
import { median } from '../shot-patterns'
import type { DistanceUnit } from '../types'
import { GREEN_CELL_M, type GreenGrid } from './codec'
import { downhillBearing, greenCollar } from './slope'
import { bothEndsWords, greenHeightWords, steepnessTerm } from './words'

const MIN_CELLS = 200
const PLANAR_R2 = 0.85
const QUADRATIC_GAIN = 0.2
/** Curvature, 1/m: bends 0.5·K0·(10 m)² = 20 cm over a 10 m radius. */
const K0 = 0.004
const RELIEF_MIN_CM = 6

export type GreenShape =
  | { kind: 'planar'; tiltPct: number; downhillDeg: number }
  | { kind: 'two-tiers'; stepCm: number; atM: number }
  | { kind: 'crown'; fallCm: number }
  | { kind: 'ridge'; axisDeg: number }
  | { kind: 'no-single-slope'; riseCm: number }

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
  if (lo.length <= 3 || hi.length <= 3 || !(median(lo)! < 0.6 * band) || !(median(hi)! < 0.6 * band) || !(step >= 12)) return null
  return { stepCm: Math.round(step), atM: Math.round((a + w / 2) * 10) / 10 }
}

export function greenShape(g: GreenGrid): GreenShape | null {
  const collar = greenCollar(g)
  const { width: W, mask, heightsMm } = g
  const idx: number[] = []
  for (let j = 0; j < mask.length; j++) if (mask[j] && !collar[j]) idx.push(j)
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
  let zMin = Infinity
  let zMax = -Infinity
  for (const h of z) {
    zMin = Math.min(zMin, h)
    zMax = Math.max(zMax, h)
  }
  const v = variance(z)
  if (!(v > 0)) return { kind: 'planar', tiltPct: 0, downhillDeg: 0 }

  const one = new Float64Array(n).fill(1)
  const plane = leastSquares([one, x, y], z)
  const quad = leastSquares([one, x, y, x.map((a) => a * a), x.map((a, i) => a * y[i]!), y.map((a) => a * a)], z)
  if (!plane || !quad) return { kind: 'no-single-slope', riseCm: (zMax - zMin) * 100 }
  const r2p = 1 - plane.residualVar / v
  const r2q = 1 - quad.residualVar / v
  const [, e, north] = plane.coef as [number, number, number]
  const tiltPct = 100 * Math.hypot(e, north)

  if (tiltPct > 0.5) {
    const tier = findTier(x, y, z, e / Math.hypot(e, north), north / Math.hypot(e, north))
    if (tier) return { kind: 'two-tiers', ...tier }
  }
  if (r2p >= PLANAR_R2) return { kind: 'planar', tiltPct, downhillDeg: downhillBearing(e, north) }

  if (r2q - r2p >= QUADRATIC_GAIN) {
    // Hessian [[p, q], [q, s]] of the quadratic; eigenvalues k0 ≤ k1.
    const [, c1, c2, c3, c4, c5] = quad.coef as [number, number, number, number, number, number]
    const p = 2 * c3
    const q = c4
    const s = 2 * c5
    const mid = (p + s) / 2
    const rad = Math.hypot((p - s) / 2, q)
    const k0 = mid - rad
    const k1 = mid + rad
    const L = Math.sqrt((n * GREEN_CELL_M * GREEN_CELL_M) / Math.PI)
    const det = p * s - q * q
    const top = Math.abs(det) > 1e-12 ? Math.hypot((-c1 * s + c2 * q) / det, (c1 * q - c2 * p) / det) : Infinity
    if (k0 < -K0 && k1 < -K0 && top < 0.6 * L) {
      const edge = median(Array.from(collar.keys()).filter((j) => collar[j]).map((j) => heightsMm[j]! / 1000))
      return { kind: 'crown', fallCm: (zMax - (edge ?? zMin)) * 100 }
    }
    if (k0 < -K0 && Math.abs(k1) < K0 / 2 && 50 * Math.abs(k0) * L * L >= RELIEF_MIN_CM) {
      // The spine runs along k1's eigenvector (the direction that doesn't bend).
      const [ex, ny] = Math.abs(q) > 1e-12 ? [q, k1 - p] : p >= s ? [1, 0] : [0, 1]
      return { kind: 'ridge', axisDeg: (((Math.atan2(ex, ny) * 180) / Math.PI) % 180 + 180) % 180 }
    }
  }
  return { kind: 'no-single-slope', riseCm: (zMax - zMin) * 100 }
}

const RIDGE_LINES = ['front to back', 'front left to back right', 'left to right', 'front right to back left']

/** "Shape · one measurement", relative to the player's approach bearing, in the player's units. */
export function shapePhrase(s: GreenShape, approachDeg: number, unit: DistanceUnit): string {
  switch (s.kind) {
    case 'planar':
      return `${bothEndsWords(s.downhillDeg, s.tiltPct, approachDeg)} · ${steepnessTerm(s.tiltPct)}`
    case 'two-tiers':
      return `Two tiers · the upper tier is ${greenHeightWords(s.stepCm, unit)} higher`
    case 'crown':
      return `Crown · high in the middle, falls ${greenHeightWords(s.fallCm, unit)} to the edges`
    case 'ridge': {
      const rel = ((((s.axisDeg - approachDeg) % 180) + 180 + 22.5) % 180) / 45
      return `Ridge · runs ${RIDGE_LINES[Math.floor(rel)]}, falls off both sides`
    }
    case 'no-single-slope':
      return `No single slope · ${greenHeightWords(s.riseCm, unit)} from the lowest to the highest point`
  }
}
