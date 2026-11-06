import { describe, expect, it } from 'vitest'
import type { GreenGrid } from './codec'
import { greenContours } from './contours'

// A 21 × 11 grid, all inside, rising 20 mm per column (0.5 m): a 4% tilt up
// to the east, heights 0–400 mm. The collar is columns 0–1 and 19–20 and
// rows 0–1 and 9–10, so the interior runs columns 2–18: 40–360 mm, 32 cm.
function plane(): GreenGrid {
  const width = 21
  const height = 11
  const heightsMm = new Float64Array(width * height)
  for (let j = 0; j < heightsMm.length; j++) heightsMm[j] = 20 * (j % width)
  return { width, height, stepMm: 2, zMinMm: 0, mask: new Uint8Array(width * height).fill(1), heightsMm }
}

describe('greenContours', () => {
  it('steps every 5 cm under 50 cm of relief, at whole multiples of the step', () => {
    const c = greenContours(plane())
    expect(c.reliefCm).toBeCloseTo(32, 6)
    expect(c.stepCm).toBe(5)
    // Levels 50, 100 … 400 mm: eight lines, each crossing the 10 rows of squares.
    expect(c.levels.map((l) => l.mm)).toEqual([50, 100, 150, 200, 250, 300, 350, 400])
    for (const l of c.levels) expect(l.segments).toHaveLength(10)
  })

  it('places each crossing by linear interpolation between cell centres', () => {
    // 50 mm sits between column 2 (40 mm) and column 3 (60 mm): column 2.5 = 1.25 m east.
    const at50 = greenContours(plane()).levels[0]!
    for (const [e1, , e2] of at50.segments) {
      expect(e1).toBeCloseTo(1.25, 9)
      expect(e2).toBeCloseTo(1.25, 9)
    }
  })

  it('marks the low and high points inside the collar', () => {
    const c = greenContours(plane())
    expect(c.low).toEqual({ eastM: 1, southM: 1 })
    expect(c.high).toEqual({ eastM: 9, southM: 1 })
  })

  it('steps every 10 cm from 50 cm of relief', () => {
    const g = plane()
    for (let j = 0; j < g.heightsMm.length; j++) g.heightsMm[j] = 40 * (j % g.width)
    // Interior 80–720 mm = 64 cm: levels 100 … 800 mm.
    const c = greenContours(g)
    expect(c.stepCm).toBe(10)
    expect(c.levels[0]!.mm).toBe(100)
    expect(c.levels.at(-1)!.mm).toBe(800)
  })

  it('draws nothing across a square with an outside corner', () => {
    const g = plane()
    g.mask[5 * g.width + 3] = 0
    g.heightsMm[5 * g.width + 3] = NaN
    // Column 3 row 5 touches four squares; two of them carry the 50 mm line.
    expect(greenContours(g).levels[0]!.segments).toHaveLength(8)
  })
})

describe('greenContours saddle', () => {
  it('cuts off the two low corners when the square’s middle is high', () => {
    // 2 × 2 cells: north-west 0, north-east 100, south-east 0, south-west 100 mm.
    // The 50 mm level crosses every edge at its midpoint; the mean (50) counts
    // as high, so the line isolates the north-west and south-east corners.
    const g: GreenGrid = {
      width: 2,
      height: 2,
      stepMm: 2,
      zMinMm: 0,
      mask: new Uint8Array([1, 1, 1, 1]),
      heightsMm: new Float64Array([0, 100, 100, 0]),
    }
    expect(greenContours(g).levels[0]).toEqual({
      mm: 50,
      segments: [
        [0, 0.25, 0.25, 0],
        [0.5, 0.25, 0.25, 0.5],
      ],
    })
  })
})
