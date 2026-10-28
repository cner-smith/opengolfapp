import { getStroke } from 'perfect-freehand'
import type { Mark } from '@oga/core'

// Mobile renderer for the shared pencil geometry (@oga/core pencil.ts).
export { marksDuration, marksFor, pencilEllipse, pencilTick, pencilUnderline, type Mark } from '@oga/core'

// perfect-freehand settings from the harness: size 2·w0·1.2, thinning .9,
// pressure p = (w/(2·w0) − 0.1)/1.8.
const WMUL = 1.2
const pathOf = (pts: number[][]) => {
  if (!pts.length) return ''
  let d = `M${pts[0]![0]!.toFixed(2)} ${pts[0]![1]!.toFixed(2)}`
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    d += ` Q${a[0]!.toFixed(2)} ${a[1]!.toFixed(2)} ${((a[0]! + b[0]!) / 2).toFixed(2)} ${((a[1]! + b[1]!) / 2).toFixed(2)}`
  }
  return d + 'Z'
}

/** SVG path data for the marks as drawn by time t (ms). */
export function marksPath(ms: { m: Mark; at: number }[], t: number): string {
  let d = ''
  for (const { m, at } of ms) {
    for (const st of m.strokes) {
      const lt = t - at - st.t0
      if (lt <= 0) continue
      const p = st.pts
      const inp: number[][] = []
      const pr = (w: number) => Math.max(0, Math.min(1, (w / (2 * m.w0) - 0.1) / 1.8))
      for (let i = 0; i < p.length; i++) {
        const b = p[i]!
        if (b.t > lt) {
          if (!i) break
          const a = p[i - 1]!
          const f = (lt - a.t) / (b.t - a.t)
          inp.push([a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, pr(a.w + (b.w - a.w) * f)])
          break
        }
        inp.push([b.x, b.y, pr(b.w)])
      }
      if (inp.length < 2) continue
      const done = lt >= p[p.length - 1]!.t
      d += pathOf(
        getStroke(inp, {
          size: 2 * m.w0 * WMUL,
          thinning: 0.9,
          smoothing: 0.6,
          streamline: 0,
          simulatePressure: false,
          last: done,
          start: { cap: true, taper: 0 },
          end: { cap: true, taper: 0 },
        }),
      )
    }
  }
  return d
}
