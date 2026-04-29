import type { ShotCategory } from './constants'
import {
  APPROACH_BASELINES,
  AROUND_GREEN_BASELINES,
  PUTTING_BASELINES,
  getHandicapBracket,
  interpolateBaseline,
} from './sg-baselines'
import type { Shot } from './types'

export function getShotCategory(
  shot: Pick<Shot, 'lieType' | 'distanceToTarget'>,
  par: number,
  shotNumber: number,
): ShotCategory {
  if (shot.lieType === 'green') return 'putting'
  if (shot.distanceToTarget !== undefined && shot.distanceToTarget <= 30) {
    return 'around_green'
  }
  if (shotNumber === 1 && (par === 4 || par === 5)) return 'off_tee'
  return 'approach'
}

export function getExpectedStrokes(
  category: ShotCategory,
  distanceYards: number | undefined,
  distanceFt: number | undefined,
  handicap: number,
): number | null {
  const bracket = getHandicapBracket(handicap)
  if (category === 'putting' && distanceFt !== undefined) {
    return interpolateBaseline(PUTTING_BASELINES[bracket], distanceFt)
  }
  if (category === 'around_green' && distanceYards !== undefined) {
    return interpolateBaseline(AROUND_GREEN_BASELINES[bracket], distanceYards)
  }
  if ((category === 'approach' || category === 'off_tee') && distanceYards !== undefined) {
    return interpolateBaseline(APPROACH_BASELINES[bracket], distanceYards)
  }
  return null
}

export function calculateShotSG(startExpected: number, endExpected: number): number {
  return startExpected - endExpected - 1
}
