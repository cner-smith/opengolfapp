import type { Mark, Pt } from '@oga/core'

// Web renderer for the shared pencil geometry (@oga/core pencil.ts). Web has
// no perfect-freehand, so each stroke is outlined here from its per-point
// widths (static final form only).
export { marksFor, pencilTick } from '@oga/core'

// Outline one stroke: offset each point by half its width along the normal,
// out along the left side and back along the right, with round end caps.
const WMUL = 0.8
function outline(p: Pt[]): string {
  const n = p.length
  const L: string[] = []
  const R: string[] = []
  for (let i = 0; i < n; i++) {
    const a = p[Math.max(0, i - 1)]!
    const b = p[Math.min(n - 1, i + 1)]!
    const dx = b.x - a.x
    const dy = b.y - a.y
    const l = Math.hypot(dx, dy) || 1
    const h = p[i]!.w * WMUL
    const nx = (-dy / l) * h
    const ny = (dx / l) * h
    L.push(`${(p[i]!.x + nx).toFixed(2)} ${(p[i]!.y + ny).toFixed(2)}`)
    R.push(`${(p[i]!.x - nx).toFixed(2)} ${(p[i]!.y - ny).toFixed(2)}`)
  }
  const r0 = (p[0]!.w * WMUL).toFixed(2)
  const r1 = (p[n - 1]!.w * WMUL).toFixed(2)
  return `M${L.join(' L')} A${r1} ${r1} 0 0 1 ${R[n - 1]} L${R.reverse().join(' L')} A${r0} ${r0} 0 0 1 ${L[0]} Z`
}

/** SVG path data for the finished marks. */
export function marksPath(ms: { m: Mark; at: number }[]): string {
  let d = ''
  for (const { m } of ms) for (const st of m.strokes) if (st.pts.length > 1) d += outline(st.pts)
  return d
}
