import { describe, expect, it } from 'vitest'
import { niceAxis, symmetricNiceTicks } from './chart-axis'

describe('symmetricNiceTicks', () => {
  it('is symmetric around zero and includes 0', () => {
    const { max, ticks } = symmetricNiceTicks([0.3, -0.9, 1.2])
    expect(ticks).toContain(0)
    expect(ticks[0]).toBe(-max)
    expect(ticks[ticks.length - 1]).toBe(max)
    // mirror: every tick's negation is also present
    const rounded = ticks.map((x) => Number(x.toFixed(2)))
    for (const t of ticks) expect(rounded).toContain(-t)
  })

  it('covers the data peak (labels match the plotted range)', () => {
    const values = [0.4, -1.1, 5.2, -0.8]
    const { max } = symmetricNiceTicks(values)
    expect(max).toBeGreaterThanOrEqual(5.2)
    expect(max).toBe(6) // ceil(5.2/2)*2 with step 2
  })

  it('uses a tight band for small SG-total swings', () => {
    const { max, ticks } = symmetricNiceTicks([0.3, -0.6, 0.9])
    expect(max).toBe(1)
    expect(ticks).toEqual([-1, -0.5, 0, 0.5, 1])
  })

  it('honours the floor for flat/empty data', () => {
    expect(symmetricNiceTicks([]).max).toBeGreaterThanOrEqual(0.5)
    expect(symmetricNiceTicks([0, 0, 0]).max).toBeGreaterThanOrEqual(0.5)
  })

  it('produces readable round-number steps for large outliers', () => {
    const { ticks } = symmetricNiceTicks([12, -3, 1])
    const step = ticks[1]! - ticks[0]!
    expect(Number.isFinite(step)).toBe(true)
    expect(ticks).toContain(0)
  })
})

describe('niceAxis', () => {
  it.each([
    // values, minSpan → lo, hi, ticks
    // span max(10, 20) = 20 → 20 / 5 = 4 → step 5; 150..160 is under 20 → hi = 150 + 4·5
    [[150, 160], 20, 150, 170, [150, 155, 160, 165, 170]],
    // span 44: 44/5 = 8.8, 44/10 = 4.4, 44/20 = 2.2 → step 20; floor(143/20)·20 = 140, ceil(187/20)·20 = 200
    [[143, 187], 20, 140, 200, [140, 160, 180, 200]],
    // a single 0: span 10 → step 5; hi = 0 + ceil(10/5)·5
    [[0], 10, 0, 10, [0, 5, 10]],
    // flat with no min span: one step tall
    [[100, 100], 0, 100, 105, [100, 105]],
    // span 1000 passes every step: 100
    [[0, 1000], 20, 0, 1000, [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]],
  ] as const)('%j min %s → %s..%s', (values, minSpan, lo, hi, ticks) => {
    expect(niceAxis([...values], minSpan)).toEqual({ lo, hi, ticks: [...ticks] })
  })
})
