// The selected shot's flag callout on the round map (#611 §19.9 C, #1217): a
// box on a staff from the shot's start, put where it covers least. Screen
// space (px/dp), y down, shared by both apps.
import type { ScreenPt } from './plate-fan'

export interface CalloutInput {
  /** The selected shot's start, the staff's foot. */
  anchor: ScreenPt
  /** End of the selected leg (next start / aim / pin). */
  end: ScreenPt | null
  /** Start of the leg before it. */
  prev: ScreenPt | null
  /** Every dot to keep clear of, the anchor and leg end included. */
  dots: ScreenPt[]
  /** Number plates (left, top, right, bottom). */
  plates: [number, number, number, number][]
  box: { w: number; h: number }
  /** The map's size. */
  size: { w: number; h: number }
  /** Bottom-left corner of the map to keep clear. */
  avoidCorner?: { w: number; h: number }
}

export interface CalloutPlacement {
  bx: number
  by: number
  foot: ScreenPt
  head: ScreenPt
}

const RING = 22
const CLEAR = 30
// Candidate order doubles as the tie-break (§19.9 C).
const CANDIDATES: ScreenPt[] = [
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1],
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
]

export function placeCallout(q: CalloutInput): CalloutPlacement {
  const a = q.anchor
  const segs: [ScreenPt, ScreenPt][] = []
  if (q.end) segs.push([a, q.end])
  if (q.prev) segs.push([q.prev, a])
  const { w: BW, h: BH } = q.box
  const hits = (bx: number, by: number) => {
    let n = 0
    for (const [s, e] of segs) {
      for (let t = 0; t <= 1; t += 0.02) {
        const x = s[0] + (e[0] - s[0]) * t
        const y = s[1] + (e[1] - s[1]) * t
        if (x > bx - 4 && x < bx + BW + 4 && y > by - 4 && y < by + BH + 4) n++
      }
    }
    for (const d of q.dots) {
      if (d[0] > bx - 24 && d[0] < bx + BW + 24 && d[1] > by - 24 && d[1] < by + BH + 24) n += 50
    }
    for (const [l, t, r, btm] of q.plates) if (l < bx + BW + 4 && r > bx - 4 && t < by + BH + 4 && btm > by - 4) n += 50
    const c = q.avoidCorner
    if (c && bx < c.w && by + BH > q.size.h - c.h) n += 50
    return n
  }
  let best = { sc: Infinity, bx: 0, by: 0 }
  for (const [ox, oy] of CANDIDATES) {
    let bx = ox > 0 ? a[0] + CLEAR : ox < 0 ? a[0] - CLEAR - BW : a[0] - BW / 2
    let by = oy > 0 ? a[1] + CLEAR : oy < 0 ? a[1] - CLEAR - BH : a[1] - BH / 2
    bx = Math.max(14, Math.min(q.size.w - 14 - BW, bx))
    by = Math.max(11, Math.min(q.size.h - 13 - BH, by))
    const sc = hits(bx, by)
    if (sc < best.sc) best = { sc, bx, by }
  }
  const { bx, by } = best
  const head: ScreenPt = [Math.max(bx, Math.min(bx + BW, a[0])), Math.max(by, Math.min(by + BH, a[1]))]
  const ang = Math.atan2(head[1] - a[1], head[0] - a[0])
  const foot: ScreenPt = [a[0] + Math.cos(ang) * RING, a[1] + Math.sin(ang) * RING]
  return { bx, by, foot, head }
}
