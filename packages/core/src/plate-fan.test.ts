import { describe, expect, it } from 'vitest'
import { fanPlates, plateBox, plateWidth, type ScreenPt } from './plate-fan'

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

  // #737: plates with a club are wider; the boxes below are 56 wide (shot 3, "putt").
  it('a wide plate steps off a neighbour dot it would cover', () => {
    // A's up-right box [120,79,176,99] reaches B's dot at x 160 (and so does
    // down-right); up-left [24,79,80,99] is clear. B's up-right is clear.
    // At the one-digit width A's box ends at 140 and both stay up-right.
    const dots: ScreenPt[] = [
      [100, 100],
      [160, 100],
    ]
    expect(fanPlates(dots, [], undefined, [56, 56])).toEqual(['ul', 'ur'])
  })

  it('a wide plate keeps off the pin', () => {
    // Pin at (165, 90): inside the 56-wide up-right box [120,79,176,99], 11
    // above the down-right box's top (101), outside the 6 margin. A one-digit
    // box ends at 140, so it would have stayed up-right.
    expect(fanPlates([[100, 100]], [[165, 90]], undefined, [56])).toEqual(['dr'])
  })

  it('a wide plate clears a wide plate placed before it', () => {
    // A: up-right [120,79,176,99]. B at (130,121): its up-right [150,100,206,120]
    // touches A's box (100 < 99 + 2), its down-right [150,122,206,142] is clear.
    // One-digit boxes ([120..140] and [150..170]) never meet.
    const dots: ScreenPt[] = [
      [100, 100],
      [130, 121],
    ]
    const sides = fanPlates(dots, [], undefined, [56, 56])
    expect(sides).toEqual(['ur', 'dr'])
    expect(overlap(plateBox(dots[0]!, sides[0]!, 56), plateBox(dots[1]!, sides[1]!, 56))).toBe(false)
  })
})

describe('plateBox', () => {
  it('grows the plate away from its dot on either side', () => {
    expect(plateBox([100, 100], 'ur', 42)).toEqual([120, 79, 162, 99])
    expect(plateBox([100, 100], 'dl', 42)).toEqual([38, 101, 80, 121])
  })
})

describe('plateWidth', () => {
  it('is 20 for a one-digit number and 9 more a digit', () => {
    expect(plateWidth(4)).toBe(20)
    expect(plateWidth(12, null)).toBe(29)
  })

  it('adds a divider and about 7 a character for the club', () => {
    // 19 + 9 + 7 * 2 and 19 + 9 + 7 * 6.
    expect(plateWidth(1, 'Dr')).toBe(42)
    expect(plateWidth(3, 'Putter')).toBe(70)
  })
})
