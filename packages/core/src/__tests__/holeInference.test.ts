import { describe, it, expect } from 'vitest'
import { inferHoleStats } from '../holeInference'

interface S {
  shot_number: number
  lie_type: string | null
  shot_result?: string | null
}

const tee = (n: number): S => ({ shot_number: n, lie_type: 'tee' })
const lie = (n: number, lt: string): S => ({ shot_number: n, lie_type: lt })
const holed = (n: number, lt: string | null = 'tee'): S => ({
  shot_number: n,
  lie_type: lt,
  shot_result: 'holed',
})

describe('inferHoleStats — fairway', () => {
  it('par 4, shot 2 lie=fairway → fairway: true', () => {
    const shots: S[] = [tee(1), lie(2, 'fairway'), lie(3, 'green')]
    expect(inferHoleStats(shots, 4).fairway).toBe(true)
  })

  it('par 4, shot 2 lie=rough → fairway: false', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'green')]
    expect(inferHoleStats(shots, 4).fairway).toBe(false)
  })

  it('par 3 → fairway: null (not applicable)', () => {
    const shots: S[] = [tee(1), lie(2, 'green')]
    expect(inferHoleStats(shots, 3).fairway).toBeNull()
  })

  it('par 4, shot 2 on green → fairway: false (skipped fairway)', () => {
    const shots: S[] = [tee(1), lie(2, 'green')]
    expect(inferHoleStats(shots, 4).fairway).toBe(false)
  })

  it('par 5, shot 2 lie=fairway → fairway: true', () => {
    const shots: S[] = [tee(1), lie(2, 'fairway'), lie(3, 'green')]
    expect(inferHoleStats(shots, 5).fairway).toBe(true)
  })

  it('hole-in-one on par 4 → fairway: false', () => {
    expect(inferHoleStats([holed(1)], 4).fairway).toBe(false)
  })

  it('empty shots → fairway: null', () => {
    expect(inferHoleStats([], 4).fairway).toBeNull()
  })
})

describe('inferHoleStats — gir', () => {
  it('par 4, shot 2 on green → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'green')]
    expect(inferHoleStats(shots, 4).gir).toBe(true)
  })

  it('par 4, shot 3 on green → gir: false', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'green')]
    expect(inferHoleStats(shots, 4).gir).toBe(false)
  })

  it('par 5, shot 3 on green → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'fairway'), lie(3, 'green')]
    expect(inferHoleStats(shots, 5).gir).toBe(true)
  })

  it('par 5, shot 4 on green → gir: false', () => {
    const shots: S[] = [
      tee(1),
      lie(2, 'fairway'),
      lie(3, 'rough'),
      lie(4, 'green'),
    ]
    expect(inferHoleStats(shots, 5).gir).toBe(false)
  })

  it('hole-in-one par 3 → gir: true, fairway: null', () => {
    const out = inferHoleStats([holed(1)], 3)
    expect(out.gir).toBe(true)
    expect(out.fairway).toBeNull()
  })

  it('hole-in-one par 4 → gir: true, fairway: false', () => {
    const out = inferHoleStats([holed(1)], 4)
    expect(out.gir).toBe(true)
    expect(out.fairway).toBe(false)
  })

  it('shots logged but none reach green → gir: false', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'sand')]
    expect(inferHoleStats(shots, 4).gir).toBe(false)
  })

  it('empty shots → gir: null', () => {
    expect(inferHoleStats([], 4).gir).toBeNull()
  })
})
