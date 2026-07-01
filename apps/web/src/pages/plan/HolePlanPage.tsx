import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  DEFAULT_HANDICAP,
  bearingDegrees,
  destinationYards,
  formatClubLabel,
  haversineYards,
  sgAtAim,
  type Club,
  type GeoPoint,
} from '@oga/core'
import { useCoursePlanData } from '../../hooks/useCoursePlanData'
import { useProfile } from '../../hooks/useProfile'
import HoleStrategyMap, { type Leg } from '../../components/plan/HoleStrategyMap'
import SGFeedbackCard from '../../components/plan/SGFeedbackCard'
import type { ClubDispersion } from '../rounds/hooks/useClubDispersion'

// Hole-by-hole strategy planner: owns the ordered "leg" list (one entry per
// planned shot) and wires HoleStrategyMap (drag-to-adjust aim) + SGFeedbackCard
// (expected-strokes readout) + prev/next hole nav. Read-only — no round/shot
// writes; this is a planning surface, not a live-round logger.
export default function HolePlanPage() {
  const { courseId, holeNumber } = useParams<{ courseId: string; holeNumber: string }>()
  const navigate = useNavigate()
  const { holes, loading, isMapped, dispersion } = useCoursePlanData(courseId)
  const { data: profileData } = useProfile()
  const handicap = profileData?.handicap_index ?? DEFAULT_HANDICAP

  const holeNum = Number(holeNumber)
  const hole = holes.find((h) => h.number === holeNum)
  // Memoized on the raw coords so tee/pin keep a stable object identity across
  // renders — HoleStrategyMap's marker-rebuild effect lists them in its
  // by-reference dep array, so fresh literals every render would needlessly
  // tear down and rebuild every map marker (same stability discipline as
  // onAimChange below).
  const tee = useMemo<GeoPoint | null>(
    () =>
      hole?.tee_lat != null && hole?.tee_lng != null
        ? { lat: hole.tee_lat, lng: hole.tee_lng }
        : null,
    [hole?.tee_lat, hole?.tee_lng],
  )
  const pin = useMemo<GeoPoint | null>(
    () =>
      hole?.pin_lat != null && hole?.pin_lng != null
        ? { lat: hole.pin_lat, lng: hole.pin_lng }
        : null,
    [hole?.pin_lat, hole?.pin_lng],
  )

  const [legs, setLegs] = useState<Leg[]>([])
  const [focusedLeg, setFocusedLeg] = useState(0)
  // The `${courseId}/${holeNum}` key whose legs are currently initialized.
  // Guards the reset effect so an incidental dependency change (e.g. a future
  // refetch giving dispersion.selectClub a new identity) can't re-run
  // initialization and wipe the player's in-progress plan mid-session — only
  // a genuine course+hole change does. Keying on holeNum alone would miss a
  // courseId change that lands on the same hole number (component instance is
  // reused across the /plan/:courseId/:holeNumber route), leaving a stale
  // tee/origin from the previous course.
  const initedKeyRef = useRef<string | null>(null)

  // Reset the leg list to a single tee-to-pin leg when the course or hole
  // changes. holes + dispersion resolve asynchronously after a route-param
  // change, so this only rebuilds once tee/pin are actually ready — but it
  // also guards on initedKeyRef so that once a hole's legs exist, an
  // incidental dep change (e.g. a future dispersion refetch handing
  // selectClub a new identity) can't re-run and wipe the player's
  // in-progress plan mid-session. Only a genuine course+hole change
  // (key !== the initialized key) reinitializes.
  useEffect(() => {
    if (!tee || !pin) return
    const key = `${courseId}/${holeNum}`
    if (initedKeyRef.current === key) return
    const teePinDist = haversineYards(tee.lat, tee.lng, pin.lat, pin.lng)
    const club = dispersion.selectClub(teePinDist)
    const carryDist = Math.min(club?.medianCarryYards ?? teePinDist, teePinDist)
    const bearing = bearingDegrees(tee.lat, tee.lng, pin.lat, pin.lng)
    const aim = destinationYards(tee, bearing, carryDist)
    setLegs([{ origin: tee, club, aim }])
    setFocusedLeg(0)
    initedKeyRef.current = key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, holeNum, tee, pin, dispersion.selectClub])

  // Passed to HoleStrategyMap, which lists this in a render-effect dep array —
  // an inline function here would tear down and rebuild every map marker on
  // every parent render. Functional setState form keeps this stable forever
  // (empty dep array), so it never invalidates that effect.
  const onAimChange = useCallback((legIndex: number, aim: GeoPoint) => {
    setLegs((prev) => {
      const leg = prev[legIndex]
      if (!leg) return prev
      const next = [...prev]
      next[legIndex] = { ...leg, aim }
      const nextLeg = next[legIndex + 1]
      if (nextLeg) next[legIndex + 1] = { ...nextLeg, origin: aim }
      return next
    })
  }, [])

  const addLeg = () => {
    if (!pin) return
    const prevLeg = legs[legs.length - 1]
    if (!prevLeg) return
    const distToPin = haversineYards(prevLeg.aim.lat, prevLeg.aim.lng, pin.lat, pin.lng)
    const club = dispersion.selectClub(distToPin)
    const carryDist = Math.min(club?.medianCarryYards ?? distToPin, distToPin)
    const bearing = bearingDegrees(prevLeg.aim.lat, prevLeg.aim.lng, pin.lat, pin.lng)
    const aim = destinationYards(prevLeg.aim, bearing, carryDist)
    const newLeg: Leg = { origin: prevLeg.aim, club, aim }
    setLegs((prev) => [...prev, newLeg])
    setFocusedLeg(legs.length)
  }

  const removeLeg = () => {
    if (legs.length <= 1) return
    setLegs((prev) => prev.slice(0, -1))
    setFocusedLeg((prev) => Math.min(prev, legs.length - 2))
  }

  const onClubChange = (club: ClubDispersion | null) => {
    setLegs((prev) => {
      const leg = prev[focusedLeg]
      if (!leg) return prev
      const next = [...prev]
      next[focusedLeg] = { ...leg, club }
      return next
    })
  }

  const { legSG, holeExpectedScore } = useMemo(() => {
    if (!pin) return { legSG: null, holeExpectedScore: null }
    const leg = legs[focusedLeg]
    const legSG = leg?.club
      ? sgAtAim({
          tee: leg.origin,
          aim: leg.aim,
          pin,
          dispersion: leg.club.dispersion,
          handicap,
        })
      : null
    const lastLeg = legs[legs.length - 1]
    const holeExpectedScore = lastLeg?.club
      ? legs.length -
        1 +
        sgAtAim({
          tee: lastLeg.origin,
          aim: lastLeg.aim,
          pin,
          dispersion: lastLeg.club.dispersion,
          handicap,
        }).expectedStrokes
      : null
    return { legSG, holeExpectedScore }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [legs, focusedLeg, handicap, pin?.lat, pin?.lng])

  const focusedLegData = legs[focusedLeg]
  const clubLabel = focusedLegData?.club
    ? formatClubLabel({ club_type: focusedLegData.club.club })
    : null

  if (loading) {
    return (
      <div className="text-caddie-ink-dim" style={{ padding: 40, textAlign: 'center', fontSize: 13 }}>
        Loading…
      </div>
    )
  }

  if (!isMapped || !hole || !tee || !pin) {
    return (
      <div className="mx-auto max-w-2xl">
        <div
          className="bg-caddie-surface"
          style={{ border: '0.5px solid #D9D2BF', borderRadius: 10, padding: 20 }}
        >
          <div className="text-caddie-ink" style={{ fontSize: 15, fontWeight: 500 }}>
            This course isn&rsquo;t mapped yet
          </div>
          <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginTop: 6 }}>
            Tee and pin locations haven&rsquo;t been imported for this hole, so a
            plan can&rsquo;t be built yet.
          </div>
          <Link
            to="/plan"
            className="text-caddie-accent"
            style={{ fontSize: 13, display: 'inline-block', marginTop: 14 }}
          >
            ← Back to course search
          </Link>
        </div>
      </div>
    )
  }

  const totalHoles = holes.length
  const goToHole = (n: number) => {
    const clamped = Math.min(Math.max(n, 1), totalHoles)
    navigate(`/plan/${courseId}/${clamped}`)
  }

  const clubs = [...dispersion.byClub.values()]

  return (
    <div className="mx-auto max-w-4xl">
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 14 }}
      >
        <button
          type="button"
          onClick={() => goToHole(holeNum - 1)}
          disabled={holeNum <= 1}
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, opacity: holeNum <= 1 ? 0.4 : 1 }}
        >
          ← Prev hole
        </button>
        <div style={{ textAlign: 'center' }}>
          <h1
            className="text-caddie-ink"
            style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3 }}
          >
            Hole {hole.number} · Par {hole.par}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => goToHole(holeNum + 1)}
          disabled={holeNum >= totalHoles}
          className="text-caddie-ink-dim"
          style={{ fontSize: 13, opacity: holeNum >= totalHoles ? 0.4 : 1 }}
        >
          Next hole →
        </button>
      </div>

      <div style={{ height: 440, borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
        <HoleStrategyMap
          tee={tee}
          pin={pin}
          legs={legs}
          focusedLeg={focusedLeg}
          onAimChange={onAimChange}
        />
      </div>

      <div
        className="bg-caddie-surface flex flex-col gap-3"
        style={{ border: '0.5px solid #D9D2BF', borderRadius: 10, padding: 16, marginBottom: 16 }}
      >
        <div className="flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 10 }}>
          <div className="flex items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
            {legs.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setFocusedLeg(i)}
                className={i === focusedLeg ? 'text-caddie-accent-ink' : 'text-caddie-ink-dim'}
                style={{
                  background: i === focusedLeg ? 'var(--caddie-chip-on)' : 'var(--caddie-chip)',
                  borderRadius: 2,
                  padding: '6px 10px',
                  fontSize: 12,
                }}
              >
                Shot {i + 1}
              </button>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: 8 }}>
            <button
              type="button"
              onClick={removeLeg}
              disabled={legs.length <= 1}
              className="text-caddie-ink-dim"
              style={{ fontSize: 12, opacity: legs.length <= 1 ? 0.4 : 1 }}
            >
              Remove last shot
            </button>
            <button
              type="button"
              onClick={addLeg}
              className="text-caddie-accent"
              style={{ fontSize: 12, fontWeight: 500 }}
            >
              + Add next shot
            </button>
          </div>
        </div>

        {clubs.length === 0 ? (
          <div className="text-caddie-ink-mute" style={{ fontSize: 12 }}>
            Log a few rounds with shot data to enable club-specific dispersion.
          </div>
        ) : (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 220 }}>
            <span className="kicker">Club</span>
            <select
              value={focusedLegData?.club?.club ?? ''}
              onChange={(e) => {
                const selected = dispersion.byClub.get(e.target.value as Club) ?? null
                onClubChange(selected)
              }}
              style={{
                padding: '8px 10px',
                fontSize: 14,
                border: '1px solid #D9D2BF',
                background: '#FBF8F1',
                borderRadius: 2,
              }}
            >
              <option value="" disabled>
                Select a club…
              </option>
              {clubs.map((c) => (
                <option key={c.club} value={c.club}>
                  {formatClubLabel({ club_type: c.club })}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <SGFeedbackCard
        legSG={legSG}
        clubLabel={clubLabel}
        holeExpectedScore={holeExpectedScore}
        par={hole.par}
      />
    </div>
  )
}
