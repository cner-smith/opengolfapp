import { NEAR_GREEN_YARDS, type ShotCategory } from './constants'
import {
  APPROACH_BASELINES,
  AROUND_GREEN_BASELINES,
  PUTTING_BASELINES,
  getHandicapBracket,
  interpolateBaseline,
} from './sg-baselines'
import type { SGBreakdown, Shot } from './types'

export function getShotCategory(
  shot: Pick<Shot, 'lieType' | 'distanceToTarget'>,
  par: number,
  shotNumber: number,
): ShotCategory {
  if (shot.lieType === 'green') return 'putting'
  if (
    shot.distanceToTarget !== undefined &&
    shot.distanceToTarget <= NEAR_GREEN_YARDS
  ) {
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

export interface ShotWithContext extends Shot {
  par: number
  isLastShot: boolean
}

const EMPTY_SG: SGBreakdown = {
  offTee: 0,
  approach: 0,
  aroundGreen: 0,
  putting: 0,
  total: 0,
}

function startDistanceFt(shot: Shot): number | undefined {
  return shot.lieType === 'green' ? shot.puttDistanceFt : undefined
}

function holedOut(shot: Shot): boolean {
  if (shot.lieType === 'green' && shot.puttResult === 'made') return true
  return false
}

export function calculateRoundSG(
  shots: ShotWithContext[],
  handicap: number,
): SGBreakdown {
  const breakdown: SGBreakdown = { ...EMPTY_SG }

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!
    const category = getShotCategory(shot, shot.par, shot.shotNumber)
    const startExpected = getExpectedStrokes(
      category,
      shot.distanceToTarget,
      startDistanceFt(shot),
      handicap,
    )
    if (startExpected === null) continue

    let endExpected: number
    if (shot.isLastShot || holedOut(shot)) {
      endExpected = 0
    } else {
      const next = shots[i + 1]
      if (!next) {
        endExpected = 0
      } else {
        const nextCategory = getShotCategory(next, next.par, next.shotNumber)
        const nextExpected = getExpectedStrokes(
          nextCategory,
          next.distanceToTarget,
          startDistanceFt(next),
          handicap,
        )
        if (nextExpected === null) continue
        endExpected = nextExpected
      }
    }

    const sg = calculateShotSG(startExpected, endExpected)
    const penaltyAdjust = shot.penalty || shot.ob ? -1 : 0

    switch (category) {
      case 'off_tee':
        breakdown.offTee += sg + penaltyAdjust
        break
      case 'approach':
        breakdown.approach += sg + penaltyAdjust
        break
      case 'around_green':
        breakdown.aroundGreen += sg + penaltyAdjust
        break
      case 'putting':
        breakdown.putting += sg + penaltyAdjust
        break
    }
  }

  breakdown.total =
    breakdown.offTee + breakdown.approach + breakdown.aroundGreen + breakdown.putting
  return breakdown
}

export function averageSGBreakdown(rounds: SGBreakdown[]): SGBreakdown {
  if (rounds.length === 0) return { ...EMPTY_SG }
  const sum = rounds.reduce<SGBreakdown>(
    (acc, r) => ({
      offTee: acc.offTee + r.offTee,
      approach: acc.approach + r.approach,
      aroundGreen: acc.aroundGreen + r.aroundGreen,
      putting: acc.putting + r.putting,
      total: acc.total + r.total,
    }),
    { ...EMPTY_SG },
  )
  const n = rounds.length
  return {
    offTee: sum.offTee / n,
    approach: sum.approach / n,
    aroundGreen: sum.aroundGreen / n,
    putting: sum.putting / n,
    total: sum.total / n,
  }
}
