// Pre-computed ball paths for the mobile slow-start screen (#1005). Pure: a small
// simulation in ground coordinates, sampled to tables the UI thread reads.
//
// One camera for everything. Ground: X right, Z away from the viewer, tilted by
// an angle with sine K. A ground point (X, Z) at drop d below the rim plane draws
// at (X, -Z * K + d * COS). A ball is a circle round the point r above its contact
// point, so the contact point sits r * (1 - COS) inside the circle's bottom edge.
// The curve is built from its curvature, so position, heading and curvature are
// all continuous; speed comes from integrating forces along it, so it can't jump.

const K = 0.18
const COS = Math.sqrt(1 - K * K)
const BALL_R = 17

export const ROLL = {
  ballR: BALL_R,
  k: K,
  cos: COS,
  dt: 1 / 120,
  vStart: 281, // dp/s, the waiting roll's cruise speed when the path takes over
  scrollT: 0.725, // s for the line to stop scrolling (the cup sliding in)
  approach: 200, // dp rolled before the rim bends the ball
  friction: 60, // dp/s2 rolling friction on the approach
  arcFriction: 82,
  exitFriction: 132,
  gravity: 620, // dp/s2 along the slope of the dip
  arc: 280, // dp of curve
  turn: (222 * Math.PI) / 180, // total heading change
  skew: 0.45, // where along the arc the curve is tightest (below 0.5: catches early)
  fitFrom: 0.28,
  fitTo: 0.72,
  rimOut: 1.05, // cup radius = fitted arc radius + this * ball radius
  settleV: 13, // dp/s where the final rock starts
  settleW: 8.5, // rad/s
  settleZ: 0.2,
  settleT: 0.8,
  // Hole-in, from footage: forward speed is untouched, the fall is plain
  // gravity, and the ball is gone behind the near lip within a few frames.
  tipT: 0.03, // s for gravity to take over as the ball pivots off the lip
  dropG: 1500 / COS, // 1500 dp/s2 on screen
  holdT: 0.45, // s of empty cup before the gate lifts
}

export interface RollTable {
  n: number
  /** Ball contact point on screen, before the stage offset. */
  x: number[]
  y: number[]
  /** Ground deltas per sample, for rolling the ball. */
  dx: number[]
  dz: number[]
  /** Below the rim plane. */
  drop: number[]
  /** Left to scroll: the cup sits this far right of its final place. */
  scroll: number[]
  speed: number[]
}

export interface RollPaths {
  lip: RollTable
  hole: RollTable
  cup: { x: number; y: number; r: number }
  /** Hole-in: the cup sits this far from the lip-out spot, on the ball's line. */
  holeDy: number
  /** Lip-out: the cover (paper drawn over the near lip) fades out between these
   *  samples as the ball climbs back over the rim. There's no gap to cut it in:
   *  the ball touches the cover from the near pass until well after it's out. */
  coverFrom: number
  coverTo: number
}

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t))
  return u * u * u * (u * (6 * u - 15) + 10)
}

// Curvature along the arc: zero at both ends with zero slope, tightest at `skew`.
function shape(u: number, skew: number) {
  const w = u < skew ? (0.5 * u) / skew : 0.5 + (0.5 * (u - skew)) / (1 - skew)
  const s = Math.sin(Math.PI * w)
  return s * s
}

export function buildRollPaths(): RollPaths {
  const p = ROLL
  const ds = 0.2
  const nArc = Math.round(p.arc / ds)
  let area = 0
  for (let i = 0; i < nArc; i++) area += shape((i + 0.5) / nArc, p.skew) * ds
  const kappa0 = p.turn / area
  const curve = (s: number) => (s > p.approach && s < p.approach + p.arc ? kappa0 * shape((s - p.approach) / p.arc, p.skew) : 0)

  const total = p.approach + p.arc + 900
  const nS = Math.round(total / ds)
  const X = new Float64Array(nS + 1)
  const Z = new Float64Array(nS + 1)
  const H = new Float64Array(nS + 1)
  let x = 0
  let z = 0
  let h = 0
  for (let i = 1; i <= nS; i++) {
    const s = i * ds
    h -= curve(s - ds / 2) * ds // clockwise from above
    x += Math.cos(h) * ds
    z += Math.sin(h) * ds
    X[i] = x
    Z[i] = z
    H[i] = h
  }

  // Cup centre: least-squares circle through the arc's middle.
  const a = Math.round((p.approach + p.fitFrom * p.arc) / ds)
  const b = Math.round((p.approach + p.fitTo * p.arc) / ds)
  let cx = 0
  let cz = 0
  for (let iter = 0, n = b - a + 1; iter < 40; iter++) {
    let mean = 0
    const rs: number[] = []
    for (let i = a; i <= b; i++) {
      const d = Math.hypot(X[i]! - cx, Z[i]! - cz)
      rs.push(d)
      mean += d / n
    }
    let gx = 0
    let gz = 0
    for (let i = a; i <= b; i++) {
      const d = rs[i - a]!
      gx += ((d - mean) * (cx - X[i]!)) / d
      gz += ((d - mean) * (cz - Z[i]!)) / d
    }
    cx -= (gx / n) * 1.6
    cz -= (gz / n) * 1.6
    if (iter === 0) {
      const m = Math.round((a + b) / 2)
      cx = X[m]! + Math.cos(H[m]! - Math.PI / 2) * (1 / curve(m * ds))
      cz = Z[m]! + Math.sin(H[m]! - Math.PI / 2) * (1 / curve(m * ds))
    }
  }
  let fit = 0
  for (let i = a; i <= b; i++) fit += Math.hypot(X[i]! - cx, Z[i]! - cz) / (b - a + 1)
  const rimR = fit + p.rimOut * BALL_R

  const dropAt = (i: number) => {
    const e = Math.min(rimR - Math.hypot(X[i]! - cx, Z[i]! - cz), 0.97 * BALL_R)
    return e > 0 ? BALL_R - Math.sqrt(BALL_R * BALL_R - e * e) : 0
  }

  const scrollTotal = (() => {
    let sum = 0
    for (let time = 0; time < p.scrollT; time += 1 / 960) sum += (1 - smooth(time / p.scrollT)) * p.vStart * (1 / 960)
    return sum
  })()
  const newTable = (): RollTable => ({ n: 0, x: [], y: [], dx: [], dz: [], drop: [], scroll: [], speed: [] })
  const sub = 8
  const h1 = p.dt / sub

  // Lip-out: the cup sits off the ball's line, so the ball catches its edge.
  const rollLip = (): RollTable => {
    const t = newTable()
    let s = 0
    let v = p.vStart
    let time = 0
    let scrolled = 0
    let settleAt = -1
    let settleS = 0
    let sinceSettle = 0
    let lastPX = 0
    let lastPZ = 0
    for (let step = 0; step < 12000; step++) {
      if (step % sub === 0) {
        const pos = sample(s)
        t.x.push(pos[0] - scrolled)
        t.y.push(-pos[1] * K + pos[2] * COS)
        t.drop.push(pos[2])
        t.scroll.push(scrollTotal - scrolled)
        t.speed.push(v)
        t.dx.push(pos[0] - lastPX)
        t.dz.push(pos[1] - lastPZ)
        t.n++
        lastPX = pos[0]
        lastPZ = pos[1]
      }
      time += h1
      scrolled += (1 - smooth(time / p.scrollT)) * p.vStart * h1
      const i = Math.min(nS - 1, Math.floor(s / ds))
      const slope = (dropAt(i + 1) - dropAt(i)) / ds // drop gained per px travelled
      if (settleAt < 0 && v < p.settleV && s > p.approach + p.arc) {
        settleAt = time
        settleS = s
      }
      let acc: number
      if (settleAt >= 0) {
        const w = p.settleW
        acc = -w * w * (s - settleS) - 2 * p.settleZ * w * v
        sinceSettle += h1
        if (sinceSettle > p.settleT) break
      } else {
        const fIn = smooth((s - p.approach + 40) / 80)
        const fOut = smooth((s - p.approach - p.arc + 20) / 90)
        acc = -(p.friction + (p.arcFriction - p.friction) * fIn + (p.exitFriction - p.arcFriction) * fOut) + p.gravity * slope
      }
      v += acc * h1
      s += v * h1
    }
    return t
  }

  // Hole-in: the cup sits on the ball's line. Past the left rim there's nothing
  // under the ball's centre, so it tips and falls, keeping its forward speed.
  const rollHole = (): RollTable => {
    const t = newTable()
    let x = 0
    let v = p.vStart
    let time = 0
    let scrolled = 0
    let d = 0
    let vd = 0
    let freeT = 0
    let hidden = 0
    let lastX = 0
    for (let step = 0; step < 12000; step++) {
      if (step % sub === 0) {
        t.x.push(x - scrolled)
        t.y.push(d * COS)
        t.drop.push(d)
        t.scroll.push(scrollTotal - scrolled)
        t.speed.push(v)
        t.dx.push(x - lastX)
        t.dz.push(0)
        t.n++
        lastX = x
      }
      time += h1
      scrolled += (1 - smooth(time / p.scrollT)) * p.vStart * h1
      if (x > cx - rimR) {
        freeT += h1
        vd += p.dropG * smooth(freeT / p.tipT) * h1
        d += vd * h1
      } else {
        v -= p.friction * h1
      }
      x += v * h1
      if (d * COS > rimR * K + BALL_R * (1 + COS) + 1) {
        hidden += h1
        if (hidden > p.holdT) break
      }
    }
    return t
  }
  function sample(s: number): [number, number, number] {
    const f = s / ds
    const i = Math.min(nS - 1, Math.floor(f))
    const u = f - i
    return [X[i]! + (X[i + 1]! - X[i]!) * u, Z[i]! + (Z[i + 1]! - Z[i]!) * u, dropAt(i) + (dropAt(i + 1) - dropAt(i)) * u]
  }

  const lip = rollLip()
  const hole = rollHole()

  // Screen: the cup's final x fixes everything else.
  const cupX = 196
  const cupY = 100
  const off = cupX - cx + lip.scroll[0]!
  const offY = cupY + cz * K
  for (const t of [lip, hole]) for (let i = 0; i < t.n; i++) t.x[i] = t.x[i]! + off
  for (let i = 0; i < lip.n; i++) lip.y[i] = lip.y[i]! + offY
  // Same ball line for both; the cup sits on it for a hole-in.
  const lineY = lip.y[0]!
  for (let i = 0; i < hole.n; i++) hole.y[i] = hole.y[i]! + lineY

  let nearPass = 0
  for (let i = 0; i < lip.n; i++) if (lip.y[i]! > lip.y[nearPass]!) nearPass = i
  const dipPeak = lip.drop[nearPass]!
  let coverFrom = nearPass
  while (lip.drop[coverFrom]! > 0.72 * dipPeak) coverFrom++
  let coverTo = coverFrom
  while (lip.drop[coverTo]! > 0.12 * dipPeak) coverTo++

  return { lip, hole, cup: { x: cupX, y: cupY, r: rimR }, holeDy: lineY - cupY, coverFrom, coverTo }
}

