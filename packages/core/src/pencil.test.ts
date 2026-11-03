import { describe, expect, it } from 'vitest'
import { marksFor, marksPath, pencilTick } from './pencil'

describe('pencil marks', () => {
  it('draws nothing at par, one gesture for birdie / bogey, two for eagle / double', () => {
    expect(marksFor(0, 3)).toEqual([])
    expect(marksFor(-1, 3)).toHaveLength(1)
    expect(marksFor(1, 3)).toHaveLength(1)
    const eagle = marksFor(-2, 3)
    const double = marksFor(3, 3)
    expect(eagle).toHaveLength(2)
    expect(double).toHaveLength(2)
    // The second gesture starts 50 ms after the first ends.
    expect(eagle[1]!.at).toBe(eagle[0]!.m.dur + 50)
    expect(double[1]!.at).toBe(double[0]!.m.dur + 50)
  })

  it('is seeded: the same hole draws the same mark on web and mobile', () => {
    expect(marksFor(-1, 7)).toEqual(marksFor(-1, 7))
    expect(pencilTick(7)).toEqual(pencilTick(7))
    expect(marksFor(-1, 7)).not.toEqual(marksFor(-1, 8))
    expect(pencilTick(7)).not.toEqual(pencilTick(8))
  })
})

describe('marksPath', () => {
  it('draws the mark over time: nothing before it starts, more as it goes, then the full outline', () => {
    const ms = marksFor(-1, 3)
    const full = marksPath(ms, 1e9)
    expect(marksPath(ms, 0)).toBe('')
    expect(full).toMatch(/^M[\d.-]+ [\d.-]+ Q.*Z$/)
    expect(marksPath(ms, ms[0]!.m.dur / 2).length).toBeLessThan(full.length)
  })
})
