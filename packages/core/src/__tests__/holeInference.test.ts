import { describe, it, expect } from 'vitest'
import { inferHoleStats } from '../holeInference'

interface S {
  shot_number: number
  lie_type: string | null
}

const tee = (n: number): S => ({ shot_number: n, lie_type: 'tee' })
const lie = (n: number, lt: string): S => ({ shot_number: n, lie_type: lt })

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

  it('known hole-in-one on par 4 (holedOut) → fairway: false', () => {
    expect(inferHoleStats([tee(1)], 4, true).fairway).toBe(false)
  })

  it('single logged shot WITHOUT holedOut → fairway: null (partial log, not an ace)', () => {
    // A lone tee shot on a partially-logged hole says nothing about the
    // fairway — only a known hole-out makes it a fairway-less ace (#669).
    expect(inferHoleStats([tee(1)], 4).fairway).toBeNull()
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

  it('par 4, shot 3 on green → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'green')]
    expect(inferHoleStats(shots, 4).gir).toBe(true)
  })

  it('par 4, shot 4 on green → gir: false', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'rough'), lie(4, 'green')]
    expect(inferHoleStats(shots, 4).gir).toBe(false)
  })

  it('par 5, shot 3 on green → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'fairway'), lie(3, 'green')]
    expect(inferHoleStats(shots, 5).gir).toBe(true)
  })

  it('par 5, shot 4 on green → gir: true', () => {
    const shots: S[] = [
      tee(1),
      lie(2, 'fairway'),
      lie(3, 'rough'),
      lie(4, 'green'),
    ]
    expect(inferHoleStats(shots, 5).gir).toBe(true)
  })

  it('par 5, shot 5 on green → gir: false', () => {
    const shots: S[] = [
      tee(1),
      lie(2, 'fairway'),
      lie(3, 'rough'),
      lie(4, 'sand'),
      lie(5, 'green'),
    ]
    expect(inferHoleStats(shots, 5).gir).toBe(false)
  })

  it('par 3, shot 2 on green → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'green')]
    expect(inferHoleStats(shots, 3).gir).toBe(true)
  })

  it('par 3, shot 3 on green → gir: false', () => {
    const shots: S[] = [tee(1), lie(2, 'fringe'), lie(3, 'green')]
    expect(inferHoleStats(shots, 3).gir).toBe(false)
  })

  // Hole-outs from OFF the green (ace, holed approach, chip-in): the ball
  // reaches the green ON the holing stroke, so GIR needs that stroke to be
  // <= par-2 — one stroke stricter than the green-start branch (#669).
  it('ace on par 3 (holedOut) → gir: true, fairway: null', () => {
    const out = inferHoleStats([tee(1)], 3, true)
    expect(out.gir).toBe(true)
    expect(out.fairway).toBeNull()
  })

  it('ace on par 4 (holedOut) → gir: true, fairway: false', () => {
    const out = inferHoleStats([tee(1)], 4, true)
    expect(out.gir).toBe(true)
    expect(out.fairway).toBe(false)
  })

  it('holed approach for eagle on par 4 (holedOut) → gir: true', () => {
    const shots: S[] = [tee(1), lie(2, 'fairway')]
    expect(inferHoleStats(shots, 4, true).gir).toBe(true)
  })

  it('chip-in for par on par 4 (holedOut) → gir: FALSE (reached green on stroke 3 > par-2)', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'rough')]
    expect(inferHoleStats(shots, 4, true).gir).toBe(false)
  })

  it('hole-out-shaped shots WITHOUT holedOut → gir: false (no signal, conservative)', () => {
    expect(inferHoleStats([tee(1)], 3).gir).toBe(false)
  })

  it('shots logged but none reach green → gir: false', () => {
    const shots: S[] = [tee(1), lie(2, 'rough'), lie(3, 'sand')]
    expect(inferHoleStats(shots, 4).gir).toBe(false)
  })

  it('empty shots → gir: null', () => {
    expect(inferHoleStats([], 4).gir).toBeNull()
  })
})
