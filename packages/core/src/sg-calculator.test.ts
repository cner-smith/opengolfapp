import { describe, expect, it } from 'vitest'
import {
  calculateRoundSG,
  calculateShotSG,
  getExpectedStrokes,
  getShotCategory,
  type ShotWithContext,
} from './sg-calculator'
import { getHandicapBracket, interpolateBaseline } from './sg-baselines'
import type { Shot } from './types'

function shotCtx(
  shot: Partial<Shot> & { par: number; isLastShot: boolean; shotNumber: number },
): ShotWithContext {
  return {
    id: shot.id ?? 'shot',
    holeScoreId: shot.holeScoreId ?? 'hs',
    userId: shot.userId ?? 'user',
    shotNumber: shot.shotNumber,
    par: shot.par,
    isLastShot: shot.isLastShot,
    distanceToTarget: shot.distanceToTarget,
    lieType: shot.lieType,
    puttDistanceFt: shot.puttDistanceFt,
    puttResult: shot.puttResult,
    penalty: shot.penalty,
    ob: shot.ob,
  }
}

describe('getHandicapBracket', () => {
  it('floors low handicaps to 0', () => {
    expect(getHandicapBracket(0)).toBe(0)
    expect(getHandicapBracket(2)).toBe(0)
  })
  it('caps at 30 for very high handicaps', () => {
    expect(getHandicapBracket(45)).toBe(30)
  })
  it('returns the right bracket in the middle', () => {
    expect(getHandicapBracket(14)).toBe(15)
    expect(getHandicapBracket(20)).toBe(20)
  })
})

describe('interpolateBaseline', () => {
  it('returns endpoints when distance is at or beyond bounds', () => {
    const table = { 5: 1, 10: 2 }
    expect(interpolateBaseline(table, 0)).toBe(1)
    expect(interpolateBaseline(table, 5)).toBe(1)
    expect(interpolateBaseline(table, 10)).toBe(2)
    expect(interpolateBaseline(table, 100)).toBe(2)
  })
  it('linearly interpolates between keys', () => {
    expect(interpolateBaseline({ 0: 0, 10: 10 }, 5)).toBeCloseTo(5)
    expect(interpolateBaseline({ 0: 0, 10: 10 }, 7.5)).toBeCloseTo(7.5)
  })
})

describe('getShotCategory', () => {
  it('returns putting on the green', () => {
    expect(getShotCategory({ lieType: 'green' }, 4, 2)).toBe('putting')
  })
  it('returns around_green within 30 yards', () => {
    expect(getShotCategory({ lieType: 'fairway', distanceToTarget: 25 }, 4, 2)).toBe(
      'around_green',
    )
  })
  it('returns off_tee for shot 1 of par 4/5', () => {
    expect(getShotCategory({ lieType: 'tee', distanceToTarget: 400 }, 4, 1)).toBe('off_tee')
    expect(getShotCategory({ lieType: 'tee', distanceToTarget: 540 }, 5, 1)).toBe('off_tee')
  })
  it('returns approach for non-tee long shots', () => {
    expect(getShotCategory({ lieType: 'fairway', distanceToTarget: 150 }, 4, 2)).toBe('approach')
  })
})

describe('getExpectedStrokes', () => {
  it('returns null when no distance is provided', () => {
    expect(getExpectedStrokes('putting', undefined, undefined, 10)).toBeNull()
  })
  it('returns putting baseline for greens', () => {
    const e = getExpectedStrokes('putting', undefined, 10, 0)
    expect(e).toBeCloseTo(1.37)
  })
  it('returns approach baseline for fairway', () => {
    const e = getExpectedStrokes('approach', 150, undefined, 0)
    expect(e).toBeCloseTo(3.12)
  })
})

describe('calculateShotSG', () => {
  it('subtracts 1 from the strokes saved', () => {
    expect(calculateShotSG(3.12, 1.65)).toBeCloseTo(0.47)
  })
  it('returns negative for poor shots', () => {
    expect(calculateShotSG(3.12, 2.5)).toBeCloseTo(-0.38)
  })
})

describe('calculateRoundSG', () => {
  it('returns zeroed breakdown for empty input', () => {
    const r = calculateRoundSG([], 10)
    expect(r.total).toBe(0)
    expect(r.offTee + r.approach + r.aroundGreen + r.putting).toBe(0)
  })

  it('credits SG to off_tee on tee shots and approach mid-hole', () => {
    // Par 4: tee shot from 400yd (off_tee), approach 150yd (approach), 10ft putt holed.
    const shots: ShotWithContext[] = [
      shotCtx({
        par: 4,
        isLastShot: false,
        shotNumber: 1,
        lieType: 'tee',
        distanceToTarget: 400,
      }),
      shotCtx({
        par: 4,
        isLastShot: false,
        shotNumber: 2,
        lieType: 'fairway',
        distanceToTarget: 150,
      }),
      shotCtx({
        par: 4,
        isLastShot: true,
        shotNumber: 3,
        lieType: 'green',
        puttDistanceFt: 10,
        puttResult: 'made',
      }),
    ]
    const r = calculateRoundSG(shots, 0)
    expect(r.offTee).not.toBe(0)
    expect(r.approach).not.toBe(0)
    expect(r.putting).not.toBe(0)
    expect(r.total).toBeCloseTo(r.offTee + r.approach + r.aroundGreen + r.putting)
  })

  it('penalizes SG for OB / penalty shots', () => {
    const cleanShots: ShotWithContext[] = [
      shotCtx({
        par: 4,
        isLastShot: false,
        shotNumber: 1,
        lieType: 'tee',
        distanceToTarget: 400,
      }),
      shotCtx({
        par: 4,
        isLastShot: true,
        shotNumber: 2,
        lieType: 'green',
        puttDistanceFt: 5,
        puttResult: 'made',
      }),
    ]
    const obShots: ShotWithContext[] = [
      { ...cleanShots[0]!, ob: true },
      cleanShots[1]!,
    ]
    const clean = calculateRoundSG(cleanShots, 0)
    const ob = calculateRoundSG(obShots, 0)
    expect(ob.offTee).toBeLessThan(clean.offTee)
  })

  it('treats holed putt as ending at zero expected', () => {
    const shots: ShotWithContext[] = [
      shotCtx({
        par: 3,
        isLastShot: true,
        shotNumber: 2,
        lieType: 'green',
        puttDistanceFt: 5,
        puttResult: 'made',
      }),
    ]
    const r = calculateRoundSG(shots, 0)
    // 5ft putt expected ~1.14, made it in 1 → SG = 1.14 - 0 - 1 = +0.14
    expect(r.putting).toBeCloseTo(0.14, 2)
  })
})

