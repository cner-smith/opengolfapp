// Recreate a shot's ball flight, seen from above, from what the player
// recorded. Mock only: the real build moves this to @oga/core with tests.
// Copied verbatim to apps/mobile/components/patterns/flight.ts.
//
// Yards in the aim frame: x = right of the aim line, y = along it (up).
// The flight is a quadratic Bézier S → C → E; this returns C.
//   start line recorded: the first direction is the aim line turned by
//     pull −4° / on line 0° / push +4° (mirrored for a left-hander), and
//     C = S + dir · L/2. The curve then lands on E by itself.
//   else shape recorded: C = the chord's midpoint pushed sideways AGAINST the
//     curve (a fade starts left of the chord and bends right) by k · L, with
//     k = 0.05 draw / fade, 0.10 hook / slice, 0 straight.
//   neither: a straight line, and `recorded` is false.

export type FlightShape = 'hook' | 'draw' | 'straight' | 'fade' | 'slice'
export type FlightStart = 'pull' | 'on_line' | 'push'
export interface FlightPoint {
  x: number
  y: number
}

const START_DEG: Record<FlightStart, number> = { pull: -4, on_line: 0, push: 4 }
const BEND: Record<FlightShape, number> = { hook: 0.1, draw: 0.05, straight: 0, fade: 0.05, slice: 0.1 }
// Which way the ball curves for a right-hander: +1 right, −1 left.
const CURVE: Record<FlightShape, number> = { hook: -1, draw: -1, straight: 0, fade: 1, slice: 1 }

export function flightControl(
  S: FlightPoint,
  E: FlightPoint,
  startLine: FlightStart | null,
  shape: FlightShape | null,
  leftHanded: boolean,
): { c: FlightPoint; recorded: boolean } {
  const hand = leftHanded ? -1 : 1
  const dx = E.x - S.x
  const dy = E.y - S.y
  const L = Math.hypot(dx, dy)
  const mid = { x: (S.x + E.x) / 2, y: (S.y + E.y) / 2 }
  if (L === 0) return { c: mid, recorded: startLine != null || shape != null }
  if (startLine) {
    const a = (START_DEG[startLine] * hand * Math.PI) / 180
    return { c: { x: S.x + Math.sin(a) * (L / 2), y: S.y + Math.cos(a) * (L / 2) }, recorded: true }
  }
  if (shape) {
    // Unit normal to the chord pointing right of the direction of travel.
    const nx = dy / L
    const ny = -dx / L
    const off = -CURVE[shape] * hand * BEND[shape] * L
    return { c: { x: mid.x + nx * off, y: mid.y + ny * off }, recorded: true }
  }
  return { c: mid, recorded: false }
}
