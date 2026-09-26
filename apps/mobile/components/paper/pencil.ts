import { getStroke } from 'perfect-freehand'

// Hand-drawn pencil marks for the scorecard (#611 §15), ported from the design
// harness (docs/internal/611-redesign/design/anim-pencil.js). Geometry is built
// once per mark, seeded by hole number, then rendered at any time t (ms) — so
// the same code gives the animated draw and the static final form.
//
// Motion model: speed follows the 2/3 power law of human drawing (slower in
// tight turns and corners), lands slow and is still moving at the lift;
// pressure tapers in/out, wobbles, and is heavier where the pencil is slow.

type Pt = { x: number; y: number; t: number; w: number }
type Stroke = { pts: Pt[]; t0: number }
export type Mark = { strokes: Stroke[]; dur: number; w0: number }

type Opts = {
  dur: number
  w: number
  beta?: number
  in0?: number
  inR?: number
  out0?: number
  outR?: number
  kEps?: number
  pn?: number
  tapIn?: number
  tapOut?: number
  tipOut?: number
  pv?: number
  down?: number
}
type CircleOpts = Opts & {
  a: number
  b: number
  tilt: number
  start: number
  over: number
  drift: number
  wob: number
  tailStraight?: number
  tailFrom?: number
}
type StrokeSpec = Partial<Opts> & {
  corners: (Corner | [number, number])[]
  dur: number
  gapBefore?: number
  bow?: number[]
  preOver?: number
  postOver?: number
}
type Corner = 'TL' | 'TR' | 'BR' | 'BL'
type BoxOpts = Omit<Opts, 'dur'> & { hw: number; hh: number; tilt: number; r: number; jit?: number; cj?: number; strokes: StrokeSpec[] }

const D = Math.PI / 180
const ss = (x: number) => {
  const c = Math.max(0, Math.min(1, x))
  return c * c * (3 - 2 * c)
}
const lerp = (a: number, b: number, s: number) => a + (b - a) * s

function rng(seed: number) {
  let s = (seed * 2654435761) >>> 0 || 1
  return () => {
    s ^= s << 13
    s >>>= 0
    s ^= s >>> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}
function noise(r: () => number, n = 6) {
  const v = Array.from({ length: n + 2 }, () => r() * 2 - 1)
  return (u: number) => {
    const x = Math.max(0, Math.min(0.9999, u)) * n
    const i = Math.floor(x)
    const f = x - i
    const s = f * f * (3 - 2 * f)
    return v[i]! * (1 - s) + v[i + 1]! * s
  }
}

function resample(pts: { x: number; y: number }[], step: number) {
  const out = [{ ...pts[0]! }]
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const b = pts[i]!
    let prev = pts[i - 1]!
    let d = Math.hypot(b.x - prev.x, b.y - prev.y)
    while (acc + d >= step) {
      const f = (step - acc) / d
      const q = { x: prev.x + (b.x - prev.x) * f, y: prev.y + (b.y - prev.y) * f }
      out.push(q)
      prev = q
      d = Math.hypot(b.x - q.x, b.y - q.y)
      acc = 0
    }
    acc += d
  }
  const last = pts[pts.length - 1]!
  const l2 = out[out.length - 1]!
  if (Math.hypot(last.x - l2.x, last.y - l2.y) > step * 0.3) out.push({ ...last })
  return out
}
const smooth = (a: number[], k: number) =>
  a.map((_, i) => {
    let s = 0
    let c = 0
    for (let j = -k; j <= k; j++) {
      const v = a[i + j]
      if (v !== undefined) {
        s += v
        c++
      }
    }
    return s / c
  })

// Attach t (ms from stroke start) and w (dp) to each point.
function kinematics(raw: { x: number; y: number }[], o: Opts, r: () => number): Pt[] {
  const n = raw.length
  const ds = [0]
  const cum = [0]
  for (let i = 1; i < n; i++) {
    ds.push(Math.hypot(raw[i]!.x - raw[i - 1]!.x, raw[i]!.y - raw[i - 1]!.y))
    cum.push(cum[i - 1]! + ds[i]!)
  }
  const L = cum[n - 1]!
  const s = cum.map((c) => c / L)
  let kap = raw.map((p, i) => {
    if (i === 0 || i === n - 1) return 0
    const a1 = Math.atan2(p.y - raw[i - 1]!.y, p.x - raw[i - 1]!.x)
    const a2 = Math.atan2(raw[i + 1]!.y - p.y, raw[i + 1]!.x - p.x)
    let da = a2 - a1
    while (da > Math.PI) da -= 2 * Math.PI
    while (da < -Math.PI) da += 2 * Math.PI
    return Math.abs(da) / Math.max(1e-3, (ds[i]! + ds[i + 1]!) / 2)
  })
  kap = smooth(smooth(kap, 3), 3)
  const beta = o.beta ?? 1 / 3
  const env = (x: number) =>
    lerp(o.in0 ?? 0.3, 1, ss(x / (o.inR ?? 0.2))) * lerp(o.out0 ?? 0.6, 1, ss((1 - x) / (o.outR ?? 0.2)))
  const v = s.map((x, i) => env(x) * Math.pow(kap[i]! + (o.kEps ?? 0.02), -beta))
  const t = [0]
  for (let i = 1; i < n; i++) t.push(t[i - 1]! + ds[i]! / ((v[i]! + v[i - 1]!) / 2))
  const T = t[n - 1]!
  const vbar = L / T
  const nz = noise(r, o.pn ?? 7)
  return raw.map((p, i) => {
    const dy = i ? (p.y - raw[i - 1]!.y) / Math.max(1e-3, ds[i]!) : 0
    const tipOut = o.tipOut ?? 0.12
    const taper = (0.3 + 0.7 * ss(s[i]! / (o.tapIn ?? 0.06))) * (tipOut + (1 - tipOut) * ss((1 - s[i]!) / (o.tapOut ?? 0.14)))
    const slow = Math.min(1.35, Math.pow(vbar / v[i]!, 0.22))
    return {
      x: p.x,
      y: p.y,
      t: (t[i]! / T) * o.dur,
      w: o.w * taper * (1 + (o.pv ?? 0.18) * nz(s[i]!)) * slow * (1 + (o.down ?? 0.12) * Math.max(0, dy)),
    }
  })
}

function circle(o: CircleOpts, seed: number): Mark {
  const r = rng(seed)
  const n1 = noise(r, 5)
  const n2 = noise(r, 11)
  const ph2 = r() * 6.28
  const ph3 = r() * 6.28
  const N = 400
  const th0 = o.start * D
  const sweep = (360 + o.over) * D
  const tilt = o.tilt * D
  const raw: { x: number; y: number; u: number }[] = []
  for (let k = 0; k <= N; k++) {
    const u = k / N
    const th = th0 - u * sweep
    const rad =
      1 + o.drift * ss(u * 1.1) + o.wob * n1(u) + o.wob * 0.35 * n2(u) + 0.03 * Math.cos(2 * th + ph2) + 0.015 * Math.cos(3 * th + ph3)
    const x = o.a * rad * Math.cos(th)
    const y = o.b * rad * Math.sin(th)
    raw.push({ x: x * Math.cos(tilt) - y * Math.sin(tilt), y: x * Math.sin(tilt) + y * Math.cos(tilt), u })
  }
  // The tail straightens as the pencil lifts (curvature relaxes).
  const ut = o.tailFrom ?? 0.9
  const k0 = Math.round(ut * N)
  const p0 = raw[k0]!
  const pm = raw[k0 - 2]!
  const tx = p0.x - pm.x
  const ty = p0.y - pm.y
  const tl = Math.hypot(tx, ty)
  const orig = raw.map((q) => ({ ...q }))
  let arc = 0
  for (let k = k0 + 1; k <= N; k++) {
    arc += Math.hypot(orig[k]!.x - orig[k - 1]!.x, orig[k]!.y - orig[k - 1]!.y)
    const f = ss((raw[k]!.u - ut) / (1 - ut)) * (o.tailStraight ?? 0.6)
    raw[k] = { x: lerp(raw[k]!.x, p0.x + (tx / tl) * arc, f), y: lerp(raw[k]!.y, p0.y + (ty / tl) * arc, f), u: raw[k]!.u }
  }
  return { strokes: [{ pts: kinematics(resample(raw, 0.35), o, r), t0: 0 }], dur: o.dur, w0: o.w }
}

function cornerPath(C: [number, number][], o: StrokeSpec & BoxOpts, r: () => number) {
  const nz = noise(r, 9)
  const pts: { x: number; y: number }[] = []
  const dir = (a: [number, number], b: [number, number]): [number, number, number] => {
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l = Math.hypot(dx, dy)
    return [dx / l, dy / l, l]
  }
  const c = C.map((p) => [...p] as [number, number])
  if (o.preOver) {
    const [dx, dy] = dir(c[1]!, c[0]!)
    c[0] = [c[0]![0] + dx * o.preOver, c[0]![1] + dy * o.preOver]
  }
  if (o.postOver) {
    const m = c.length
    const [dx, dy] = dir(c[m - 2]!, c[m - 1]!)
    c[m - 1] = [c[m - 1]![0] + dx * o.postOver, c[m - 1]![1] + dy * o.postOver]
  }
  for (let e = 0; e < c.length - 1; e++) {
    const A = c[e]!
    const B = c[e + 1]!
    const [dx, dy, l] = dir(A, B)
    const rA = e === 0 ? 0 : o.r
    const rB = e === c.length - 2 ? 0 : o.r
    const bow = o.bow?.[e] ?? 0
    const M = Math.max(4, Math.round(l / 0.3))
    for (let k = 0; k <= M; k++) {
      const d = rA + ((l - rA - rB) * k) / M
      const sE = d / l
      const off = bow * Math.sin(Math.PI * sE) + (o.jit ?? 0.25) * nz((e + sE) / c.length)
      pts.push({ x: A[0] + dx * d - dy * off, y: A[1] + dy * d + dx * off })
    }
    if (e < c.length - 2) {
      // Rounded corner: a quadratic through the corner point.
      const [ex, ey] = dir(B, c[e + 2]!)
      const P0 = [B[0] - dx * rB, B[1] - dy * rB]
      const P2 = [B[0] + ex * rB, B[1] + ey * rB]
      for (let k = 1; k < 10; k++) {
        const t = k / 10
        const a = (1 - t) * (1 - t)
        const b = 2 * t * (1 - t)
        const cc = t * t
        pts.push({ x: a * P0[0]! + b * B[0] + cc * P2[0]!, y: a * P0[1]! + b * B[1] + cc * P2[1]! })
      }
    }
  }
  return resample(pts, 0.3)
}

function box(o: BoxOpts, seed: number): Mark {
  const r = rng(seed)
  const J = o.cj ?? 1.2
  const jit = () => (r() * 2 - 1) * J
  const rot = o.tilt * D
  const corner: Record<Corner, [number, number]> = {
    TL: [-o.hw + jit(), -o.hh + jit()],
    TR: [o.hw + jit(), -o.hh + jit()],
    BR: [o.hw + jit(), o.hh + jit()],
    BL: [-o.hw + jit(), o.hh + jit()],
  }
  for (const k of Object.keys(corner) as Corner[]) {
    const [x, y] = corner[k]
    corner[k] = [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]
  }
  let t = 0
  const strokes: Stroke[] = []
  for (const st of o.strokes) {
    t += st.gapBefore ?? 0
    const C = st.corners.map((k) => (typeof k === 'string' ? corner[k] : k))
    const so = { ...o, ...st }
    strokes.push({ pts: kinematics(cornerPath(C, so, r), so, r), t0: t })
    t += st.dur
  }
  return { strokes, dur: t, w0: o.w }
}

// Per-hole variation so no two marks on a card are identical.
function varyCircle(o: CircleOpts, seed: number): CircleOpts {
  const r = rng(seed * 7 + 1)
  const j = (a: number) => (r() * 2 - 1) * a
  return { ...o, a: o.a * (1 + j(0.05)), b: o.b * (1 + j(0.05)), tilt: o.tilt + j(4), start: o.start + j(14), over: o.over * (1 + j(0.25)), dur: o.dur * (1 + j(0.06)) }
}
function varyBox(o: BoxOpts, seed: number): BoxOpts {
  const r = rng(seed * 7 + 1)
  const j = (a: number) => (r() * 2 - 1) * a
  return { ...o, tilt: o.tilt + j(1.5), hw: o.hw * (1 + j(0.04)), hh: o.hh * (1 + j(0.04)) }
}

// Owner picks (anim-notes §1): circle C1 "steady", square S2 "two L strokes".
const C1: CircleOpts = { a: 15.5, b: 13.2, tilt: -8, start: -58, over: 42, drift: 0.075, wob: 0.035, dur: 330, w: 1.68, tailStraight: 0.55, in0: 0.3, inR: 0.22, out0: 0.75, outR: 0.2 }
const S2: BoxOpts = {
  hw: 14, hh: 13, tilt: -2, r: 0.4, w: 1.68, pv: 0.26, kEps: 0.03,
  strokes: [
    { corners: ['TL', 'TR', 'BR'], dur: 170, bow: [0.5, -0.5], preOver: 0.8, postOver: 1.2, in0: 0.35, out0: 0.45 },
    { corners: ['TL', 'BL', 'BR'], dur: 170, gapBefore: 50, bow: [0.6, 0.5], preOver: 1.8, postOver: 3.2, in0: 0.35, out0: 0.6 },
  ],
}
const fast = (o: BoxOpts, k: number): BoxOpts => ({
  ...o,
  strokes: o.strokes.map((st) => ({ ...st, dur: st.dur * k, gapBefore: (st.gapBefore ?? 0) * k })),
})

/** The marks for a score `toPar` (none at par), each with its start time. Eagle
 *  and double bogey are two gestures: the second starts 50 ms after the first. */
export function marksFor(toPar: number, seed: number): { m: Mark; at: number }[] {
  if (toPar === -1) return [{ m: circle(varyCircle(C1, seed), seed), at: 0 }]
  if (toPar <= -2) {
    const i = varyCircle(C1, seed)
    i.dur *= 0.75
    const o = varyCircle(C1, seed + 5)
    o.a *= 1.32
    o.b *= 1.34
    o.dur *= 0.8
    o.start += 25
    const a = circle(i, seed)
    return [{ m: a, at: 0 }, { m: circle(o, seed + 5), at: a.dur + 50 }]
  }
  if (toPar === 1) return [{ m: box(varyBox(S2, seed), seed), at: 0 }]
  if (toPar >= 2) {
    const a = box(fast(varyBox(S2, seed), 0.72), seed)
    const bo = fast(varyBox(S2, seed + 5), 0.72)
    bo.hw *= 1.5
    bo.hh *= 1.45
    bo.tilt += 2.5
    return [{ m: a, at: 0 }, { m: box(bo, seed + 5), at: a.dur + 50 }]
  }
  return []
}

export const marksDuration = (ms: { m: Mark; at: number }[]) => Math.max(0, ...ms.map((x) => x.at + x.m.dur))

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
