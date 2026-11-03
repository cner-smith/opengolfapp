import { describe, expect, it } from 'vitest'
import { fanPlates, plateBox, type ScreenPt } from './plate-fan'

const overlap = (a: number[], b: number[]) => a[0]! < b[2]! && a[2]! > b[0]! && a[1]! < b[3]! && a[3]! > b[1]!

describe('fanPlates', () => {
  it('puts a lone plate up and to the right', () => {
    expect(fanPlates([[100, 100]], [])).toEqual(['ur'])
  })

  it('sends a second plate to another side when the first would cover it', () => {
    const dots: ScreenPt[] = [
      [100, 100],
      [102, 105],
    ]
    const sides = fanPlates(dots, [])
    expect(sides[0]).toBe('ur')
    expect(sides[1]).not.toBe('ur')
    expect(overlap(plateBox(dots[0]!, sides[0]!), plateBox(dots[1]!, sides[1]!))).toBe(false)
  })

  it('keeps a plate off the pin', () => {
    // The pin sits inside the dot's up-right plate box.
    expect(fanPlates([[100, 100]], [[130, 90]])).toEqual(['dr'])
  })

  it('keeps a plate off the selected disc', () => {
    // The selected disc is just right of the dot: both right-hand sides come within its ring.
    expect(fanPlates([[100, 100]], [], [140, 100])).toEqual(['ul'])
  })

  it('still separates plates when every side touches something', () => {
    const dots: ScreenPt[] = [
      [100, 100],
      [101, 101],
    ]
    const others: ScreenPt[] = [
      [130, 90],
      [130, 110],
      [70, 90],
      [70, 110],
    ]
    const sides = fanPlates(dots, others)
    expect(overlap(plateBox(dots[0]!, sides[0]!), plateBox(dots[1]!, sides[1]!))).toBe(false)
  })
})
