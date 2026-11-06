import { describe, expect, it } from 'vitest'
import { gridOf } from './__fixtures__/grids'
import { greenCollar, greenHachures, greenPlaneTilt, greenSlopeField } from './slope'

describe('greenCollar', () => {
  it('marks the outer 1 m: two cells in from every edge of a 10×10 green', () => {
    const collar = greenCollar(gridOf(10, 10, () => 0))
    for (let r = 0; r < 10; r++)
      for (let c = 0; c < 10; c++) {
        const interior = r >= 2 && r <= 7 && c >= 2 && c <= 7
        expect(collar[r * 10 + c], `cell ${r},${c}`).toBe(interior ? 0 : 1)
      }
  })

  it('measures to the outline, not along rows: a knight’s move from a hole is 0.79 m from its edge', () => {
    // One outside cell at (10,10). Cell (12,11) sits 1.0 m × 0.5 m from its centre, so 0.79 m from its
    // corner: collar. (12,12) is 1.06 m from it and (13,10) 1.25 m: interior.
    const g = gridOf(20, 20, () => 0, (x, y) => !(x === 5 && y === -5))
    const collar = greenCollar(g)
    expect(collar[12 * 20 + 11]).toBe(1)
    expect(collar[12 * 20 + 12]).toBe(0)
    expect(collar[13 * 20 + 10]).toBe(0)
  })

  it('never marks a cell outside the outline', () => {
    const g = gridOf(10, 10, () => 0, (x) => x < 3)
    const collar = greenCollar(g)
    expect(collar[9]).toBe(0)
  })
})

describe('greenSlopeField', () => {
  it('reads a 2% plane rising east as 2% falling west, edge cells included', () => {
    const f = greenSlopeField(gridOf(20, 20, (x) => 20 * x))
    for (let j = 0; j < 400; j++) {
      expect(f.slopePct[j]).toBeCloseTo(2, 9)
      expect(f.downhillDeg[j]).toBeCloseTo(270, 9)
    }
  })

  it('reads a plane rising 3% north and 3% east as 4.24% falling south-west', () => {
    const f = greenSlopeField(gridOf(16, 16, (x, y) => 30 * x + 30 * y))
    expect(f.slopePct[100]).toBeCloseTo(3 * Math.SQRT2, 9)
    expect(f.downhillDeg[100]).toBeCloseTo(225, 9)
  })

  it('takes the local gradient of a curved surface: z = 0.01 x² is 10% at 5 m east of the low line', () => {
    // 61 columns, the low line at column 30; column 40 is 5 m east and 20 cells from the edge.
    const f = greenSlopeField(gridOf(61, 21, (x) => 10 * (x - 15) ** 2))
    const j = 10 * 61 + 40
    expect(f.slopePct[j]).toBeCloseTo(10, 9)
    expect(f.downhillDeg[j]).toBeCloseTo(270, 9)
  })

  it('leaves outside cells empty', () => {
    const f = greenSlopeField(gridOf(10, 10, (x) => 20 * x, (x) => x < 3))
    expect(f.slopePct[9]).toBeNaN()
    expect(f.slopePct[0]).toBeCloseTo(2, 9)
  })
})

describe('greenPlaneTilt', () => {
  it('fits the whole green and ignores the collar', () => {
    const plane = (x: number) => 20 * x
    const g = gridOf(20, 20, plane)
    const collar = greenCollar(g)
    // A wall on the east half of the collar only, so it would tilt any fit that used it.
    collar.forEach((v, j) => {
      if (v && j % 20 >= 10) g.heightsMm[j]! += 500
    })
    const t = greenPlaneTilt(g)!
    expect(t.tiltPct).toBeCloseTo(2, 9)
    expect(t.downhillDeg).toBeCloseTo(270, 9)
  })

  it('reads a 3% rise to the north as falling due south', () => {
    const t = greenPlaneTilt(gridOf(12, 12, (_, y) => 30 * y))!
    expect(t.tiltPct).toBeCloseTo(3, 9)
    expect(t.downhillDeg).toBeCloseTo(180, 9)
  })
})

describe('greenHachures', () => {
  // 20×20 cells, interior = cells 2–17. The 2 m hex lattice has rows at y = j·√3 m
  // (rows 1–5 land inside) and points every 2 m, odd rows shifted 1 m: 4 per row.
  it('places one mark per lattice point inside the collar, sized by the slope', () => {
    const g = gridOf(20, 20, (x) => 20 * x)
    const marks = greenHachures(g, greenSlopeField(g))
    expect(marks).toHaveLength(20)
    expect(marks[0]).toEqual({ eastM: 1, southM: expect.closeTo(Math.sqrt(3), 9), downhillDeg: expect.closeTo(270, 9), slopePct: expect.closeTo(2, 9), lengthM: expect.closeTo(0.94, 9) })
    expect(new Set(marks.map((m) => m.eastM))).toEqual(new Set([1, 3, 5, 7, 2, 4, 6, 8]))
  })

  it('caps the length at 5%', () => {
    const g = gridOf(20, 20, (x) => 80 * x)
    expect(greenHachures(g, greenSlopeField(g))[0]!.lengthM).toBeCloseTo(1.6, 9)
  })

  it('draws nothing under the 0.8% noise floor', () => {
    const flat = gridOf(20, 20, (x) => 5 * x)
    expect(greenHachures(flat, greenSlopeField(flat))).toHaveLength(0)
    const gentle = gridOf(20, 20, (x) => 9 * x)
    expect(greenHachures(gentle, greenSlopeField(gentle))).toHaveLength(20)
  })
})
