import { describe, expect, it } from 'vitest'
import { gridOf } from './__fixtures__/grids'
import { greenCollar, type SlopeField } from './slope'
import { bothEndsWords, falseFront, falseFrontWords, steepnessTerm } from './words'

describe('steepnessTerm', () => {
  it.each([
    [0, 'Flat'],
    [0.99, 'Flat'],
    [1, 'Gentle'],
    [1.99, 'Gentle'],
    [2, 'Moderate'],
    [2.99, 'Moderate'],
    [3, 'Steep'],
    [3.99, 'Steep'],
    [4, 'Severe'],
    [9, 'Severe'],
  ])('%s%% is %s', (pct, term) => {
    expect(steepnessTerm(pct)).toBe(term)
  })
})

describe('bothEndsWords', () => {
  // The player walks north (approach 0), so south is the front, east the right.
  it.each([
    [180, 'Back to front'],
    [0, 'Front to back'],
    [90, 'Left to right'],
    [270, 'Right to left'],
    [135, 'Back left to front right'],
    [225, 'Back right to front left'],
    [45, 'Front left to back right'],
    [315, 'Front right to back left'],
  ])('falling toward %s° reads "%s"', (downhill, words) => {
    expect(bothEndsWords(downhill, 2, 0)).toBe(words)
  })

  it('turns with the approach: walking east, a fall to the west is back to front', () => {
    expect(bothEndsWords(270, 2, 90)).toBe('Back to front')
    expect(bothEndsWords(0, 2, 90)).toBe('Right to left')
  })

  it('splits octants at 22.5°', () => {
    expect(bothEndsWords(157.4, 2, 0)).toBe('Back left to front right')
    expect(bothEndsWords(157.6, 2, 0)).toBe('Back to front')
    expect(bothEndsWords(10, 2, 350)).toBe('Front to back')
  })

  it('says Level wherever the steepness is Flat, under 1%', () => {
    expect(bothEndsWords(180, 0.8, 0)).toBe('Level')
    expect(bothEndsWords(180, 0.99, 0)).toBe('Level')
    expect(bothEndsWords(180, 1, 0)).toBe('Back to front')
    // A fitted 1% comes out a hair under; steepnessTerm calls it Gentle, so it gets a direction.
    expect(bothEndsWords(180, 0.9999999999, 0)).toBe('Back to front')
  })
})

describe('falseFront', () => {
  // 32 columns × 40 rows, played from the south (approach 0). Row r sits
  // (39 − r)·0.5 + 0.25 m in from the front edge. The field is set by hand:
  // a rise of `front` % toward the back for the first `depthM` metres, `rest` % after.
  function field(front: number, rest: number, depthM = 5): { grid: ReturnType<typeof gridOf>; f: SlopeField } {
    const grid = gridOf(32, 40, () => 0)
    const n = 32 * 40
    const gradN = new Float64Array(n)
    for (let j = 0; j < n; j++) {
      const d = (39 - Math.floor(j / 32)) * 0.5 + 0.25
      gradN[j] = (d < depthM ? front : rest) / 100
    }
    const f: SlopeField = {
      slopePct: gradN.map((v) => v * 100),
      downhillDeg: new Float64Array(n).fill(180),
      gradE: new Float64Array(n),
      gradN,
      collar: greenCollar(grid),
    }
    return { grid, f }
  }

  it('measures a 6% front band 5 m deep over a 1% green: 5 m at 6%', () => {
    const { grid, f } = field(6, 1)
    expect(falseFront(grid, f, 0)).toEqual({ depthM: 5, pct: 6 })
  })

  it('needs 3.5%', () => {
    const { grid, f } = field(3.4, 0)
    expect(falseFront(grid, f, 0)).toBeNull()
  })

  it('needs 1.5 points more than the rest of the green', () => {
    const { grid, f } = field(4.4, 3)
    expect(falseFront(grid, f, 0)).toBeNull()
    const g2 = field(4.5, 3)
    expect(falseFront(g2.grid, g2.f, 0)).toEqual({ depthM: 5, pct: 4.5 })
  })

  it('ends the depth where the fall drops under 3% or the rest + 1', () => {
    const { grid, f } = field(6, 1, 3)
    expect(falseFront(grid, f, 0)).toEqual({ depthM: 3, pct: 6 })
  })

  it('reads the fall along the approach: played from the west, an east rise is the false front', () => {
    const grid = gridOf(40, 40, () => 0)
    const n = 40 * 40
    const gradE = new Float64Array(n)
    for (let j = 0; j < n; j++) gradE[j] = ((j % 40) * 0.5 + 0.25 < 5 ? 6 : 1) / 100
    const f: SlopeField = { slopePct: gradE.map((v) => v * 100), downhillDeg: new Float64Array(n).fill(270), gradE, gradN: new Float64Array(n), collar: greenCollar(grid) }
    expect(falseFront(grid, f, 90)).toEqual({ depthM: 5, pct: 6 })
  })

  it('finds none played from the other end, where the same slope falls away', () => {
    const { grid, f } = field(6, 1)
    expect(falseFront(grid, f, 180)).toBeNull()
  })
})

describe('falseFrontWords', () => {
  // 4 m = 4 / 0.3048 = 13.12 ft; 5 m = 16.40 ft. Whole feet, whole metres, the % to one place.
  it.each([
    [{ depthM: 4, pct: 6.7 }, 'yards', 'First 13 ft fall back at 6.7%'],
    [{ depthM: 4, pct: 6.7 }, 'meters', 'First 4 m fall back at 6.7%'],
    [{ depthM: 5, pct: 6 }, 'yards', 'First 16 ft fall back at 6.0%'],
    [{ depthM: 5, pct: 4.46 }, 'meters', 'First 5 m fall back at 4.5%'],
  ] as const)('%o in %s reads "%s"', (ff, unit, words) => {
    expect(falseFrontWords(ff, unit)).toBe(words)
  })
})
