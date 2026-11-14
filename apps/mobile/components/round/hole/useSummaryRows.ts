import { useMemo } from 'react'
import { applyCapturedShots, buildInitialRows, clubTypicalDistance, withReplayLies, type Club } from '@oga/core'
import type { useClubDispersion } from './useClubDispersion'
import type { useUserBag } from '../../../hooks/useUserBag'
import type { RoundState } from './types'
import type { UseHoleDataResult } from './useHoleData'

// End-of-hole review rows. Built from the shots placed live (their start
// coords, in order) via the shared @oga/core inference — same call the web
// review sheet uses. Only computed while the summary is open. The pin
// anchors the last shot's end + every shot's distance-to-pin; with no pin
// (unmapped hole, none placed) the last placed point stands in so distances
// degrade to ~0 rather than exploding off [0,0].
//
// LiveRoundSession calls it below useShotActions: the OB seeding needs its
// shotObs.
export function useSummaryRows(
  roundState: RoundState,
  data: UseHoleDataResult,
  shotObs: boolean[],
  bag: ReturnType<typeof useUserBag>['bag'],
  byClub: ReturnType<typeof useClubDispersion>['byClub'],
) {
  return useMemo(() => {
    if (roundState !== 'SUMMARY') return []
    const pts = data.shots.map((s) => s.start)
    if (pts.length === 0) return []
    const pin = data.roundPin ?? data.storedPin ?? pts[pts.length - 1]!
    const par = data.resolvedHole?.par ?? data.currentHoleScore?.par ?? data.currentHole?.par ?? 4
    // Carry the OB flag onto the rows (#839). buildInitialRows is geometry
    // only — it never sets shotResult — and ReviewedShotRow has no `ob` field
    // at all, so this string is the ONLY way a penalty reaches the sheet.
    // Without it the sheet is blind to an OB the player already marked: the
    // score ticker re-seeds to the struck count and Save persists that back
    // over the chip's bump, the row shows no OB chip, and saveHoleSummary
    // (which sources shot_result from the reviewed row, never from the stored
    // one) writes null over the 'ob' the chip wrote.
    //
    // Read off `shotObs`, not data.shots[i].ob, for the same
    // reason the chip's label is (see LiveRoundSession's OB props): the fetched flags
    // lag our own write by a refetch, and finishing the hole inside that
    // window would seed the sheet without the penalty.
    // The club guess matches the same typical distances the wheel shows (#1052).
    const userBag = bag.map((c) => {
      const d = byClub.get(c.club_type as Club)
      const t = clubTypicalDistance(d?.medianDistanceYards, d?.points.length ?? 0, c.typical_distance_yards)
      return { club_type: c.club_type, typical_distance_yards: t?.yards ?? null }
    })
    // What the round already stored (a live putt) beats the distance guess.
    // A re-tee keeps the OB shot's lie (#1098): after the stored lies and the
    // OB flags are on. Live shots store no lie but a putt's, so the re-tee's
    // own row has none to lose.
    return withReplayLies(
      applyCapturedShots(
        buildInitialRows(pts, par, pin.lat, pin.lng, userBag),
        data.shots.map((s) => s.captured),
      ).map((r, i) => (shotObs[i] ? { ...r, shotResult: 'ob' as const } : r)),
    )
  }, [
    roundState,
    data.shots,
    shotObs,
    bag,
    byClub,
    data.roundPin,
    data.storedPin,
    data.resolvedHole?.par,
    data.currentHoleScore?.par,
    data.currentHole?.par,
  ])
}
