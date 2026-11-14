// The selected shot's flag callout on the round map (#611 §19.9 C, #1217): a
// box on a staff from the shot's start, put where it covers least. Screen
// space (px/dp), y down, shared by both apps.
import type { ScreenPt } from './plate-fan'
import type { ScreenBox } from './green/wayfinder'

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

const TAG_GAP = 14
const TAG_EDGE = 8

// The plan map's aim tag (#1336): beside the selected shot's aim point,
// right of it by default, flipped left at the map's right edge, and held
// inside the map. No staff, so it never jumps between candidates mid-drag.
export function placeAimTag(q: {
  anchor: ScreenPt
  box: { w: number; h: number }
  size: { w: number; h: number }
}): { x: number; y: number } {
  const [ax, ay] = q.anchor
  const { w, h } = q.box
  let x = ax + TAG_GAP
  if (x + w > q.size.w - TAG_EDGE) x = ax - TAG_GAP - w
  x = Math.max(TAG_EDGE, Math.min(q.size.w - TAG_EDGE - w, x))
  const y = Math.max(TAG_EDGE, Math.min(q.size.h - TAG_EDGE - h, ay - h / 2))
  return { x, y }
}

// The drag magnifier (#1356): a circle of radius `r` showing what the finger
// covers. Straight above the finger by default, past the thumb; then above and
// to one side, beside the finger, below. A spot must sit inside the map and
// keep off every `keepOut` box (the Mapbox logo and attribution, which the
// terms want visible, and the remaining-distance tag). `away` is the side
// (+1 right, −1 left) to try first: away from the aim line's tags.
// Nothing fits: the in-map spot touching the fewest boxes.
const LOUPE_LIFT = 90
const LOUPE_SIDE = 12
const LOUPE_EDGE = 8

export function placeLoupe(q: {
  finger: ScreenPt
  r: number
  size: { w: number; h: number }
  keepOut: ScreenBox[]
  away: 1 | -1
}): ScreenPt {
  const [x, y] = q.finger
  const { r } = q
  const up = LOUPE_LIFT + r
  const s = q.away
  const shift = r + LOUPE_SIDE
  const candidates: ScreenPt[] = [
    [x, y - up],
    [x + s * shift, y - up],
    [x - s * shift, y - up],
    [x + s * up, y],
    [x - s * up, y],
    [x, y + up],
  ]
  const inMap = ([cx, cy]: ScreenPt) =>
    cx - r >= LOUPE_EDGE && cx + r <= q.size.w - LOUPE_EDGE && cy - r >= LOUPE_EDGE && cy + r <= q.size.h - LOUPE_EDGE
  // A circle touches a box when the box's nearest point is within r.
  const touches = ([cx, cy]: ScreenPt, k: ScreenBox) =>
    Math.hypot(cx - Math.max(k.left, Math.min(k.right, cx)), cy - Math.max(k.top, Math.min(k.bottom, cy))) < r
  let best: { p: ScreenPt; n: number } | null = null
  for (const c of candidates) {
    // Near a side edge the above spots slide in rather than give up.
    const p: ScreenPt = [Math.max(LOUPE_EDGE + r, Math.min(q.size.w - LOUPE_EDGE - r, c[0])), c[1]]
    if (!inMap(p)) continue
    // A slide can't bring the circle back over the finger.
    if (Math.hypot(p[0] - x, p[1] - y) < r + 20) continue
    const n = q.keepOut.filter((k) => touches(p, k)).length
    if (n === 0) return p
    if (!best || n < best.n) best = { p, n }
  }
  return best?.p ?? [x, y - up]
}
