import { useEffect, useMemo, useState } from 'react'
import { DEFAULT_BAG, clubTypicalDistance, formatClubLabel, type Club } from '@oga/core'
import type { useClubDispersion } from './useClubDispersion'
import type { useUserBag } from '../../../hooks/useUserBag'

type Dispersion = ReturnType<typeof useClubDispersion>

// Club wheel (#611 §4): the bag minus the putter, one row per club type.
// It opens on the auto pick every shot; a manual pick lasts one shot.
// Open state lives with the session so Back closes the wheel first; it names the shot it opened on (a new shot = closed).
export function useClubWheel(opts: {
  bag: ReturnType<typeof useUserBag>['bag']
  byClub: Dispersion['byClub']
  selectClub: Dispersion['selectClub']
  ballToPinYards: number | null
  holeNumber: number
  totalShotsThisHole: number
}) {
  const { bag, byClub, selectClub, ballToPinYards, holeNumber, totalShotsThisHole } = opts
  const [clubOverride, setClubOverride] = useState<Club | null>(null)
  const shotKey = `${holeNumber}:${totalShotsThisHole}`, [wheelOpenOn, setWheelOpenOn] = useState<string | null>(null)
  const wheelOpen = wheelOpenOn === shotKey, setWheelOpen = (open: boolean) => setWheelOpenOn(open ? shotKey : null)
  useEffect(() => { setClubOverride(null) }, [holeNumber, totalShotsThisHole])
  const wheelRows = useMemo(() => {
    const seen = new Set<string>()
    return (bag.length > 0 ? bag : DEFAULT_BAG)
      .filter((c) => c.club_type !== 'putter' && !seen.has(c.club_type) && !!seen.add(c.club_type))
      .map((c) => {
        const d = byClub.get(c.club_type as Club)
        // DEFAULT_BAG rows carry no typed distance.
        const typed = (c as { typical_distance_yards?: number | null }).typical_distance_yards
        return {
          club: c.club_type as Club,
          name: formatClubLabel(c),
          // The wheel is 124 wide: "driver" at 32 sp pushed the meta off the card.
          label: c.club_type === 'driver' ? 'dr' : formatClubLabel(c),
          // Measured once the club has 5 shots, else the My Bag estimate (#1052).
          typicalYards: clubTypicalDistance(d?.medianDistanceYards, d?.points.length ?? 0, typed)?.yards ?? null,
          shots: d?.points.length ?? 0,
          sparse: !d?.dispersion,
        }
      })
  }, [bag, byClub])
  const autoClub = useMemo(
    () => selectClub(ballToPinYards, new Set(wheelRows.map((r) => r.club)))?.club ?? null,
    [selectClub, ballToPinYards, wheelRows],
  )
  const wheelClub = clubOverride ?? autoClub ?? wheelRows[0]?.club ?? null
  return { wheelRows, autoClub, wheelClub, setClubOverride, wheelOpen, setWheelOpen }
}
