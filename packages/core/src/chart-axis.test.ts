import { describe, expect, it } from 'vitest'
import { symmetricNiceTicks } from './chart-axis'

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
