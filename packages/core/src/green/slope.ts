// Slope field, collar, whole-green tilt and downhill marks (#1378).
//
// The per-cell gradient is a Gaussian-weighted local plane fit (σ = 1.5 m,
// window cut at 3σ) over the inside cells around each cell: the grid analogue
// of the research's moving-least-squares fit at the same σ. Weighting only the
// inside cells keeps edge cells honest (a plain Gaussian derivative would pull
// the outside's NaN or zero in), and a plane is recovered exactly anywhere.
// The weights are separable, so the nine weighted sums are built with 1-D
// passes along rows, then columns.
import { checkGreenGrid, GREEN_CELL_M, type GreenGrid } from './codec'

const SIGMA_CELLS = 1.5 / GREEN_CELL_M
const RADIUS = Math.ceil(3 * SIGMA_CELLS)
/** Below this % a slope is within the lidar's systematic noise: no marks. */
export const SLOPE_NOISE_FLOOR_PCT = 0.8
const HACHURE_SPACING_M = 2
/** Mark length grows with slope up to this %. */
const HACHURE_FULL_PCT = 5

export interface SlopeField {
  /** Slope in %, NaN outside the outline. */
  slopePct: Float64Array
  /** Compass bearing of the fall line, degrees; NaN outside or where flat. */
  downhillDeg: Float64Array
  /** Rise per metre east and north. */
  gradE: Float64Array
  gradN: Float64Array
  /** 1 = the outer 1 m band: drawn faded, left out of every number. */
  collar: Uint8Array
}

export interface PlaneTilt {
  tiltPct: number
  downhillDeg: number
}

export interface Hachure {
  /** Metres east and south of cell (0,0)'s centre. */
  eastM: number
  southM: number
  downhillDeg: number
  slopePct: number
  /** Drawn tapered: wide uphill, sharp at the downhill end. */
  lengthM: number
}

/** Compass bearing of the downhill direction for a rise of (e, n) per metre east and north. */
export function downhillBearing(e: number, n: number): number {
  return ((Math.atan2(-e, -n) * 180) / Math.PI + 360) % 360
}

/**
 * Inside cells whose centre is within 1.25 m of an outside cell's centre, so
 * within ~1 m of the outline. Off-grid counts as outside.
 */
export function greenCollar(g: GreenGrid): Uint8Array {
  checkGreenGrid(g)
  const { width: W, height: H, mask } = g
  const collar = new Uint8Array(W * H)
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      if (!mask[r * W + c]) continue
      search: for (let dr = -2; dr <= 2; dr++)
        for (let dc = -2; dc <= 2; dc++) {
          if (dr * dr + dc * dc > 5) continue
          const rr = r + dr
          const cc = c + dc
          if (rr < 0 || rr >= H || cc < 0 || cc >= W || !mask[rr * W + cc]) {
            collar[r * W + c] = 1
            break search
          }
        }
    }
  return collar
}

export function greenSlopeField(g: GreenGrid): SlopeField {
  checkGreenGrid(g)
  const { width: W, height: H, mask, heightsMm } = g
  const n = W * H
  const kernel = Array.from({ length: 2 * RADIUS + 1 }, (_, i) => Math.exp(-((i - RADIUS) ** 2) / (2 * SIGMA_CELLS ** 2)))

  // Row passes: Σ g(dc)·dc^k·F over the row, for F = mask and mask·z.
  const z = new Float64Array(n)
  for (let j = 0; j < n; j++) z[j] = mask[j] ? (heightsMm[j]! - g.zMinMm) / 1000 : 0
  const rows = [new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n), new Float64Array(n)]
  const [m0, m1, m2, z0, z1] = rows as [Float64Array, Float64Array, Float64Array, Float64Array, Float64Array]
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      let a0 = 0, a1 = 0, a2 = 0, b0 = 0, b1 = 0
      for (let d = Math.max(-RADIUS, -c); d <= Math.min(RADIUS, W - 1 - c); d++) {
        const j = r * W + c + d
        if (!mask[j]) continue
        const w = kernel[d + RADIUS]!
        const wz = w * z[j]!
        a0 += w
        a1 += w * d
        a2 += w * d * d
        b0 += wz
        b1 += wz * d
      }
      const j = r * W + c
      m0[j] = a0
      m1[j] = a1
      m2[j] = a2
      z0[j] = b0
      z1[j] = b1
    }

  const slopePct = new Float64Array(n).fill(NaN)
  const downhillDeg = new Float64Array(n).fill(NaN)
  const gradE = new Float64Array(n).fill(NaN)
  const gradN = new Float64Array(n).fill(NaN)
  for (let r = 0; r < H; r++)
    for (let c = 0; c < W; c++) {
      const j = r * W + c
      if (!mask[j]) continue
      // Column pass, offsets dr (rows, south-positive) and dc (columns, east).
      let S = 0, Sc = 0, Sr = 0, Scc = 0, Scr = 0, Srr = 0, Sz = 0, Scz = 0, Srz = 0
      for (let d = Math.max(-RADIUS, -r); d <= Math.min(RADIUS, H - 1 - r); d++) {
        const i = j + d * W
        const w = kernel[d + RADIUS]!
        S += w * m0[i]!
        Sc += w * m1[i]!
        Scc += w * m2[i]!
        Sz += w * z0[i]!
        Scz += w * z1[i]!
        Sr += w * d * m0[i]!
        Scr += w * d * m1[i]!
        Srz += w * d * z0[i]!
        Srr += w * d * d * m0[i]!
      }
      // Normal equations for z ≈ a + bc·dc + br·dr, by Cramer's rule.
      const det = S * (Scc * Srr - Scr * Scr) - Sc * (Sc * Srr - Scr * Sr) + Sr * (Sc * Scr - Scc * Sr)
      if (!(Math.abs(det) > 1e-9)) continue
      const bc = (S * (Scz * Srr - Scr * Srz) - Sz * (Sc * Srr - Scr * Sr) + Sr * (Sc * Srz - Scz * Sr)) / det
      const br = (S * (Scc * Srz - Scz * Scr) - Sc * (Sc * Srz - Scz * Sr) + Sz * (Sc * Scr - Scc * Sr)) / det
      const e = bc / GREEN_CELL_M
      const north = -br / GREEN_CELL_M
      gradE[j] = e
      gradN[j] = north
      slopePct[j] = 100 * Math.hypot(e, north)
      if (e || north) downhillDeg[j] = downhillBearing(e, north)
    }
  return { slopePct, downhillDeg, gradE, gradN, collar: greenCollar(g) }
}

/** Least-squares plane through the cells inside the collar. Null with fewer than 3 such cells. */
export function greenPlaneTilt(g: GreenGrid): PlaneTilt | null {
  const collar = greenCollar(g)
  const { width: W, height: H, mask, heightsMm } = g
  let S = 0, Sx = 0, Sy = 0, Sz = 0
  for (let j = 0; j < W * H; j++) {
    if (!mask[j] || collar[j]) continue
    S++
    Sx += j % W
    Sy += Math.floor(j / W)
    Sz += heightsMm[j]!
  }
  if (S < 3) return null
  const mx = Sx / S, my = Sy / S, mz = Sz / S
  let xx = 0, xy = 0, yy = 0, xz = 0, yz = 0
  for (let j = 0; j < W * H; j++) {
    if (!mask[j] || collar[j]) continue
    const x = (j % W) - mx
    const y = Math.floor(j / W) - my
    const zz = heightsMm[j]! - mz
    xx += x * x
    xy += x * y
    yy += y * y
    xz += x * zz
    yz += y * zz
  }
  const det = xx * yy - xy * xy
  if (!(det > 1e-9)) return null
  // mm per cell → m per m: divide by 1000 mm and by the cell size.
  const e = (xz * yy - yz * xy) / det / (1000 * GREEN_CELL_M)
  const north = -(yz * xx - xz * xy) / det / (1000 * GREEN_CELL_M)
  return { tiltPct: 100 * Math.hypot(e, north), downhillDeg: e || north ? downhillBearing(e, north) : 0 }
}

/**
 * Downhill marks (H2 tapered strokes) on a 2 m hex lattice, inside the collar
 * and above the noise floor. Data only; the apps draw them.
 */
export function greenHachures(g: GreenGrid, field: SlopeField): Hachure[] {
  checkGreenGrid(g)
  const { width: W, height: H, mask } = g
  if (field.slopePct.length !== W * H) throw new Error('Slope field does not match the grid')
  const out: Hachure[] = []
  const rowStep = HACHURE_SPACING_M * (Math.sqrt(3) / 2)
  const maxE = (W - 1) * GREEN_CELL_M
  const maxS = (H - 1) * GREEN_CELL_M
  for (let k = 0; k * rowStep <= maxS; k++) {
    const southM = k * rowStep
    for (let eastM = k % 2 ? HACHURE_SPACING_M / 2 : 0; eastM <= maxE; eastM += HACHURE_SPACING_M) {
      const j = Math.round(southM / GREEN_CELL_M) * W + Math.round(eastM / GREEN_CELL_M)
      const s = field.slopePct[j]!
      if (!mask[j] || field.collar[j] || !(s > SLOPE_NOISE_FLOOR_PCT)) continue
      out.push({ eastM, southM, downhillDeg: field.downhillDeg[j]!, slopePct: s, lengthM: 0.5 + 1.1 * Math.min(s / HACHURE_FULL_PCT, 1) })
    }
  }
  return out
}

/** Half the width of a hachure's uphill end, metres. */
const HACHURE_HALF_WIDTH_M = 0.22

/** A hachure as a triangle in metres (east, south): the uphill corners, then the downhill tip. */
export function hachureTriangle(h: Hachure): [number, number][] {
  const d = (h.downhillDeg * Math.PI) / 180
  const ux = Math.sin(d)
  const uy = -Math.cos(d)
  const w = HACHURE_HALF_WIDTH_M
  const bx = h.eastM - (ux * h.lengthM) / 2
  const by = h.southM - (uy * h.lengthM) / 2
  return [
    [bx - uy * w, by + ux * w],
    [bx + uy * w, by - ux * w],
    [h.eastM + (ux * h.lengthM) / 2, h.southM + (uy * h.lengthM) / 2],
  ]
}
