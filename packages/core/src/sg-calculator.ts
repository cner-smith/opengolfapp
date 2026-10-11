import { NEAR_GREEN_YARDS, type ShotCategory } from './constants'
import {
  APPROACH_BASELINES,
  AROUND_GREEN_BASELINES,
  PUTTING_BASELINES,
  getHandicapBracket,
  interpolateBaseline,
  teeBaseline,
} from './sg-baselines'
import { haversineYards } from './units'
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

/** Round-map marker category — the display vocabulary the map uses, distinct
 *  from the SG `ShotCategory`. */
export type ShotMarkerCategory = 'tee' | 'approach' | 'around-green' | 'putt'

// Any tee-lie shot renders as a tee marker even on a par 3, where SG counts
// the tee shot as approach — the marker reflects what the player sees, not the
// SG category.
export function getShotMarkerCategory(
  shot: Pick<Shot, 'lieType' | 'distanceToTarget'>,
  par: number,
  shotNumber: number,
): ShotMarkerCategory {
  if (shot.lieType === 'tee') return 'tee'
  const cat = getShotCategory(shot, par, shotNumber)
  if (cat === 'putting') return 'putt'
  if (cat === 'around_green') return 'around-green'
  if (cat === 'off_tee') return 'tee'
  return 'approach'
}

/** Category for the expected-strokes readout from a ball `distanceYards` from the
 *  pin, with no lie data: around-green inside NEAR_GREEN_YARDS, the tee line for
 *  the tee shot of a par 4/5 (#998), otherwise approach. */
export function startCategory(distanceYards: number, teeShot: boolean): ShotCategory {
  if (distanceYards <= NEAR_GREEN_YARDS) return 'around_green'
  return teeShot ? 'off_tee' : 'approach'
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
  if (category === 'off_tee' && distanceYards !== undefined) {
    return teeBaseline(bracket, distanceYards)
  }
  if (category === 'approach' && distanceYards !== undefined) {
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
  return shot.lieType === 'green' && shot.puttResult === 'made'
}

// A shot played from (within this of) the spot an OB shot was played from is
// the stroke-and-distance replay. ponytail: fixed radius; a web re-tee tap or a
// GPS mark lands well inside it, a casual drop up the hole lands far outside.
const OB_REPLAY_YARDS = 10

function isReplayOf(ob: Shot, shot: Shot): boolean {
  if (
    ob.startLat !== undefined &&
    ob.startLng !== undefined &&
    shot.startLat !== undefined &&
    shot.startLng !== undefined
  ) {
    return haversineYards(ob.startLat, ob.startLng, shot.startLat, shot.startLng) <= OB_REPLAY_YARDS
  }
  if (ob.distanceToTarget !== undefined && shot.distanceToTarget !== undefined) {
    return Math.abs(ob.distanceToTarget - shot.distanceToTarget) <= OB_REPLAY_YARDS
  }
  return false
}

export interface ShotSG {
  category: ShotCategory
  /** Strokes gained on this shot, penalty stroke included. */
  sg: number
}

// Per-shot SG for one hole's shots, in order; null where a start or end
// position can't be valued (no distance data). The one place the per-shot
// rule lives — calculateRoundSG sums it, the Stats approach chart buckets it.
export function perShotSG(
  shots: ShotWithContext[],
  handicap: number,
): (ShotSG | null)[] {
  // Each shot's start: its category and the expected strokes from there. The
  // replay after an OB keeps the OB shot's category (#1094) — a re-tee is a
  // tee shot whatever its shot number or inferred lie.
  const starts: { category: ShotCategory; expected: number | null }[] = []
  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i]!
    const prev = shots[i - 1]
    const category =
      prev?.ob && isReplayOf(prev, shot)
        ? starts[i - 1]!.category
        : getShotCategory(shot, shot.par, shot.shotNumber)
    starts.push({
      category,
      expected: getExpectedStrokes(category, shot.distanceToTarget, startDistanceFt(shot), handicap),
    })
  }

  return shots.map((shot, i) => {
    const { category, expected: startExpected } = starts[i]!
    if (startExpected === null) return null
    const next = shots[i + 1] ? starts[i + 1]! : undefined

    let endExpected: number
    // Out of bounds ends where the next shot is played from: the same spot for
    // a stroke-and-distance replay, further up for a drop (#1094). With no
    // next row, or one with no position, it is stroke and distance — "Skip
    // all, just track location" is always visible, so a player who drops
    // without logging the recovery is normal use, and reading isLastShot below
    // would zero endExpected and return a large POSITIVE sg.
    if (shot.ob) {
      endExpected = next?.expected ?? startExpected
    } else if (shot.isLastShot || holedOut(shot) || !next) {
      endExpected = 0
    } else if (next.expected === null) {
      // The end position can't be valued: skip rather than book it as holed
      // (#668).
      return null
    } else {
      endExpected = next.expected
    }

    const penaltyAdjust = shot.penalty || shot.ob ? -1 : 0
    return { category, sg: calculateShotSG(startExpected, endExpected) + penaltyAdjust }
  })
}

export function calculateRoundSG(
  shots: ShotWithContext[],
  handicap: number,
): SGBreakdown {
  const breakdown: SGBreakdown = { ...EMPTY_SG }
  for (const shot of perShotSG(shots, handicap)) {
    if (!shot) continue
    switch (shot.category) {
      case 'off_tee':
        breakdown.offTee += shot.sg
        break
      case 'approach':
        breakdown.approach += shot.sg
        break
      case 'around_green':
        breakdown.aroundGreen += shot.sg
        break
      case 'putting':
        breakdown.putting += shot.sg
        break
    }
  }
  breakdown.total =
    breakdown.offTee + breakdown.approach + breakdown.aroundGreen + breakdown.putting
  return breakdown
}

