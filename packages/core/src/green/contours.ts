// Height contours and the low and high points for the Height view (#1380).
// The research rule (green-lidar v2): contours every 10 cm, 5 cm on greens
// with under 50 cm of relief, read on the interior (the collar left out).
// Marching squares between cell centres; levels are whole multiples of the
// step, so neighbouring greens' lines mean the same height.
import { checkGreenGrid, GREEN_CELL_M, type GreenGrid } from './codec'
import { greenCollar } from './slope'

export interface GreenPoint {
  /** Metres east and south of cell (0,0)'s centre. */
  eastM: number
  southM: number
}

export interface GreenContours {
  stepCm: number
  /** Interior height range, cm. */
  reliefCm: number
  /** Each segment is [east1, south1, east2, south2], metres. */
  levels: { mm: number; segments: [number, number, number, number][] }[]
  low: GreenPoint | null
  high: GreenPoint | null
}

export function greenContours(g: GreenGrid): GreenContours {
  checkGreenGrid(g)
  const { width: W, height: H, mask, heightsMm: z } = g
  const collar = greenCollar(g)
  let lo = -1
  let hi = -1
  let min = Infinity
  let max = -Infinity
  for (let j = 0; j < W * H; j++) {
    if (!mask[j]) continue
    min = Math.min(min, z[j]!)
    max = Math.max(max, z[j]!)
    if (collar[j]) continue
    if (lo < 0 || z[j]! < z[lo]!) lo = j
    if (hi < 0 || z[j]! > z[hi]!) hi = j
  }
  const at = (j: number): GreenPoint | null =>
    j < 0 ? null : { eastM: (j % W) * GREEN_CELL_M, southM: Math.floor(j / W) * GREEN_CELL_M }
  const reliefCm = lo < 0 ? 0 : (z[hi]! - z[lo]!) / 10
  const stepCm = reliefCm < 50 ? 5 : 10
  const stepMm = stepCm * 10

  const levels: GreenContours['levels'] = []
  if (min < max) {
    for (let L = (Math.floor(min / stepMm) + 1) * stepMm; L <= max; L += stepMm) levels.push({ mm: L, segments: [] })
  }
  for (let r = 0; r + 1 < H; r++)
    for (let c = 0; c + 1 < W; c++) {
      // Corners clockwise from the top left (north-west).
      const js = [r * W + c, r * W + c + 1, (r + 1) * W + c + 1, (r + 1) * W + c]
      if (!js.every((j) => mask[j])) continue
      const v = js.map((j) => z[j]!)
      const pos: [number, number][] = [[c, r], [c + 1, r], [c + 1, r + 1], [c, r + 1]]
      const lmin = Math.min(...v)
      const lmax = Math.max(...v)
      for (const level of levels) {
        const L = level.mm
        if (L <= lmin || L > lmax) continue
        // Edges top, right, bottom, left: where the level crosses each.
        const cross: ([number, number] | null)[] = [0, 1, 2, 3].map((e) => {
          const a = v[e]!
          const b = v[(e + 1) % 4]!
          if (a < L === b < L) return null
          const t = (L - a) / (b - a)
          const [ca, ra] = pos[e]!
          const [cb, rb] = pos[(e + 1) % 4]!
          return [(ca + t * (cb - ca)) * GREEN_CELL_M, (ra + t * (rb - ra)) * GREEN_CELL_M]
        })
        const hit = cross.filter((p): p is [number, number] => p !== null)
        const seg = (p: [number, number], q: [number, number]) => level.segments.push([p[0], p[1], q[0], q[1]])
        if (hit.length === 2) seg(hit[0]!, hit[1]!)
        else if (hit.length === 4) {
          // Saddle: the centre's side decides which corners the line cuts off.
          const centreAbove = (v[0]! + v[1]! + v[2]! + v[3]!) / 4 >= L
          if (v[0]! >= L === centreAbove) {
            seg(cross[0]!, cross[1]!)
            seg(cross[2]!, cross[3]!)
          } else {
            seg(cross[3]!, cross[0]!)
            seg(cross[1]!, cross[2]!)
          }
        }
      }
    }
  return { stepCm, reliefCm, levels, low: at(lo), high: at(hi) }
}
