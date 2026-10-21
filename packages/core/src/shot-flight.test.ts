import { describe, expect, it } from 'vitest'
import { flightControls, startLineAngleDeg, type FlightControls, type FlightPoint } from './shot-flight'

// Hand-worked with u(φ) = (sin φ, cos φ), S = (0,0), angles from the aim line:
//   φC = atan2(ex, ey), L = |E|, β = φC − φ0, φE = φC + β,
//   k = (2L/3)·tan(β/2)/sin β  (L/3 when |β| < 0.1°),
//   p1 = k·u(φ0), p2 = E − k·u(φE).
const S = { x: 0, y: 0 }
const rad = (d: number) => (d * Math.PI) / 180

function expectPoint(p: FlightPoint, x: number, y: number) {
  expect(p.x).toBeCloseTo(x, 3)
  expect(p.y).toBeCloseTo(y, 3)
}

// The Bézier's midpoint must sit on the circle that leaves S along φ0 and
// passes through E (radius R = L / (2 sin β)); 0.01 yd covers the cubic's
// known ~1e-6·R error at these small turns.
function expectOnArc(f: FlightControls, E: FlightPoint, startDeg: number) {
  const L = Math.hypot(E.x, E.y)
  const beta = Math.atan2(E.x, E.y) - rad(startDeg)
  const R = L / (2 * Math.sin(beta))
  // Centre: R along the normal to u(φ0), to the right of travel for β > 0.
  const centre = { x: R * Math.cos(rad(startDeg)), y: -R * Math.sin(rad(startDeg)) }
  const mid = {
    x: 0.375 * f.p1.x + 0.375 * f.p2.x + 0.125 * E.x,
    y: 0.375 * f.p1.y + 0.375 * f.p2.y + 0.125 * E.y,
  }
  expect(Math.hypot(mid.x - centre.x, mid.y - centre.y)).toBeCloseTo(Math.abs(R), 2)
}

describe('startLineAngleDeg', () => {
  it('is pull −4°, on line 0°, push +4° for a right-hander and mirrored for a left-hander', () => {
    expect([startLineAngleDeg('pull', false), startLineAngleDeg('on_line', false), startLineAngleDeg('push', false)]).toEqual([-4, 0, 4])
    expect([startLineAngleDeg('pull', true), startLineAngleDeg('push', true)]).toEqual([4, -4])
  })
})

describe('flightControls', () => {
  it('(a) on line + straight to (0,150): the chord thirds', () => {
    // φC = 0, φ0' = clamp(0 − 0, ±1.5°) = 0, β = 0 → k = L/3 = 50.
    const f = flightControls(S, { x: 0, y: 150 }, 'on_line', 'straight', false)
    expect(f.kind).toBe('agree')
    expectPoint(f.p1, 0, 50)
    expectPoint(f.p2, 0, 100)
  })

  it('(b) push fade to (15,150): starts 3.21° right and bends 2.5°', () => {
    // φC = atan(0.1) = 5.7106°. βS = +2.5° → φ0' = clamp(3.2106°, [1.5°, 12°]) = 3.2106°, β = 2.5°.
    // L = √22725 = 150.7481; k = 100.4988 · tan 1.25° / sin 2.5° = 100.4988 · 0.500238 = 50.2733.
    // p1 = 50.2733·(sin 3.2106°, cos 3.2106°) = (2.8156, 50.1944).
    // φE = 8.2106° → p2 = (15 − 50.2733·0.14281, 150 − 50.2733·0.98975) = (7.8204, 100.2420).
    const E = { x: 15, y: 150 }
    const f = flightControls(S, E, 'push', 'fade', false)
    expect(f.kind).toBe('agree')
    expectPoint(f.p1, 2.8156, 50.1944)
    expectPoint(f.p2, 7.8204, 100.242)
    expectOnArc(f, E, 3.2106)
  })

  it('(c) push hook to (25,150): the push widens to its 12° edge and it hooks back, so it agrees', () => {
    // φC = atan(1/6) = 9.4623°. βS = −6° → φC − βS = 15.4623° → clamped to 12°.
    // β = −2.5377° (left, a hook). L = 152.0691, k = 50.7146.
    // p1 = 50.7146·(sin 12°, cos 12°) = (10.5441, 49.6063).
    // φE = 6.9246° → p2 = (25 − 50.7146·0.12057, 150 − 50.7146·0.99271) = (18.8857, 99.6554).
    const E = { x: 25, y: 150 }
    const f = flightControls(S, E, 'push', 'hook', false)
    expect(f.kind).toBe('agree')
    expectPoint(f.p1, 10.5441, 49.6063)
    expectPoint(f.p2, 18.8857, 99.6554)
    expectOnArc(f, E, 12)
  })

  it('(d) push hook to (40,150): still right of a 12° push, so it conflicts and bends right', () => {
    // φC = atan(40/150) = 14.9314°, φ0' = 12°, β = +2.9314° (right) ≠ hook.
    // L = 155.2417, k = 51.7811. p1 = (10.7659, 50.6496).
    // φE = 17.8628° → p2 = (24.1167, 100.7151).
    const E = { x: 40, y: 150 }
    const f = flightControls(S, E, 'push', 'hook', false)
    expect(f.kind).toBe('conflict')
    expectPoint(f.p1, 10.7659, 50.6496)
    expectPoint(f.p2, 24.1167, 100.7151)
  })

  it('calls a straight shot that bends more than 1.5° a conflict', () => {
    // On line + straight to (10,150): φC = 3.8141°, φ0' = clamp(3.8141°, ±1.5°) = 1.5°, β = 2.31° > 1.5°.
    expect(flightControls(S, { x: 10, y: 150 }, 'on_line', 'straight', false).kind).toBe('conflict')
    // To (7,150): φC = 2.6719°, β = 1.17° ≤ 1.5° → agrees.
    expect(flightControls(S, { x: 7, y: 150 }, 'on_line', 'straight', false).kind).toBe('agree')
  })

  it('start line only: leaves on the nominal push angle and bends to the finish', () => {
    // φ0 = 4°, φC = 5.7106°, β = 1.7106°, k = 50.2606.
    // p1 = (3.5060, 50.1381); φE = 7.4212° → p2 = (8.5082, 100.1604).
    const E = { x: 15, y: 150 }
    const f = flightControls(S, E, 'push', null, false)
    expect(f.kind).toBe('start-only')
    expectPoint(f.p1, 3.506, 50.1381)
    expectPoint(f.p2, 8.5082, 100.1604)
    expectOnArc(f, E, 4)
  })

  it('shape only: back-solves the start from the recorded bend', () => {
    // Slice βS = +6°: φ0 = 5.7106° − 6° = −0.2894°, β = 6°, k = 50.3874.
    // p1 = (−0.2545, 50.3867); φE = 11.7106° → p2 = (4.7730, 100.6614).
    const E = { x: 15, y: 150 }
    const f = flightControls(S, E, null, 'slice', false)
    expect(f.kind).toBe('shape-only')
    expectPoint(f.p1, -0.2545, 50.3867)
    expectPoint(f.p2, 4.773, 100.6614)
    expectOnArc(f, E, -0.2894)
  })

  it('neither recorded: the straight chord', () => {
    const f = flightControls(S, { x: 15, y: 150 }, null, null, false)
    expect(f.kind).toBe('none')
    expectPoint(f.p1, 5, 50)
    expectPoint(f.p2, 10, 100)
  })

  it('a left-hander’s push fade is the mirror of a right-hander’s (b)', () => {
    // Left-handed push = left, fade = curves left: the mirror of (b) through x.
    const f = flightControls(S, { x: -15, y: 150 }, 'push', 'fade', true)
    expect(f.kind).toBe('agree')
    expectPoint(f.p1, -2.8156, 50.1944)
    expectPoint(f.p2, -7.8204, 100.242)
  })

  it('a left-hander’s push with no shape leaves left, the mirror of the start-only case', () => {
    const f = flightControls(S, { x: -15, y: 150 }, 'push', null, true)
    expect(f.kind).toBe('start-only')
    expectPoint(f.p1, -3.506, 50.1381)
    expectPoint(f.p2, -8.5082, 100.1604)
  })

  it('a left-hander’s push hook finishing left of the 12° push conflicts, like (d)', () => {
    expect(flightControls(S, { x: -40, y: 150 }, 'push', 'hook', true).kind).toBe('conflict')
    // The geometry is never mirrored: a right-hander's tags on that finish read differently.
    expect(flightControls(S, { x: -40, y: 150 }, 'push', 'hook', false).kind).toBe('conflict')
    expect(flightControls(S, { x: -40, y: 150 }, 'pull', 'draw', false).kind).toBe('agree')
  })

  it('draws an arc up to a 15° bend and the chord beyond, flagged as a conflict', () => {
    // Pull (−4°) only, to (28,150): φC = 10.5735°, β = 14.5735° ≤ 15° → arc, k = 51.6953,
    // p1 = (−3.6061, 51.5694).
    const inside = flightControls(S, { x: 28, y: 150 }, 'pull', null, false)
    expect(inside.kind).toBe('start-only')
    expectPoint(inside.p1, -3.6061, 51.5694)
    // To (30,150): φC = 11.3099°, β = 15.3099° > 15° → the chord, p1 = E/3, p2 = 2E/3.
    const beyond = flightControls(S, { x: 30, y: 150 }, 'pull', null, false)
    expect(beyond.kind).toBe('conflict')
    expectPoint(beyond.p1, 10, 50)
    expectPoint(beyond.p2, 20, 100)
  })

  it('measures from the start point, not the origin', () => {
    // (b) shifted by (5, −20): the controls shift with it.
    const f = flightControls({ x: 5, y: -20 }, { x: 20, y: 130 }, 'push', 'fade', false)
    expectPoint(f.p1, 7.8156, 30.1944)
    expectPoint(f.p2, 12.8204, 80.242)
  })

  it('a zero-length shot collapses onto its start', () => {
    const f = flightControls(S, S, 'push', 'fade', false)
    expectPoint(f.p1, 0, 0)
    expectPoint(f.p2, 0, 0)
  })
})
