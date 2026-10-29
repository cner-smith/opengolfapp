import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DEFAULT_HANDICAP,
  bearingDegrees,
  clubNoun,
  destinationYards,
  formatClubLabel,
  haversineYards,
  sgAtAim,
  type GeoPoint,
} from '@oga/core'
import { useCoursePlanData } from '../../hooks/useCoursePlanData'
import { useCourse } from '../../hooks/useCourses'
import { useProfile } from '../../hooks/useProfile'
import { Rocker } from '../../components/ui/Rocker'
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
  const { data: course } = useCourse(courseId)
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
    // Wait for dispersion too, not just tee/pin — otherwise, when the course's
    // holes resolve before the shot-history fetch, the leg initializes with a
    // null club (empty byClub) and initedKeyRef locks it, so the default club
    // never gets set once dispersion arrives (permanent "no data" state).
    if (!tee || !pin || dispersion.loading) return
    const key = `${courseId}/${holeNum}`
    if (initedKeyRef.current === key) return
    const teePinDist = haversineYards(tee.lat, tee.lng, pin.lat, pin.lng)
    const club = dispersion.selectClub(teePinDist)
    const legDist = Math.min(club?.medianDistanceYards ?? teePinDist, teePinDist)
    const bearing = bearingDegrees(tee.lat, tee.lng, pin.lat, pin.lng)
    const aim = destinationYards(tee, bearing, legDist)
    setLegs([{ origin: tee, club, aim }])
    setFocusedLeg(0)
    initedKeyRef.current = key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, holeNum, tee, pin, dispersion.selectClub, dispersion.loading])

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
    const legDist = Math.min(club?.medianDistanceYards ?? distToPin, distToPin)
    const bearing = bearingDegrees(prevLeg.aim.lat, prevLeg.aim.lng, pin.lat, pin.lng)
    const aim = destinationYards(prevLeg.aim, bearing, legDist)
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
    // Name the course: search lists many courses under one name (#1223).
    const where = course ? [course.name, [course.city, course.state].filter(Boolean).join(' ')].filter(Boolean).join(', ') : 'This course'
    return (
      <div className="mx-auto max-w-2xl">
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 24, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.25 }}
        >
          {isMapped ? `Hole ${holeNum} isn\u2019t mapped yet.` : `${where} isn\u2019t mapped yet.`}
        </h1>
        <p className="text-caddie-ink-dim" style={{ fontSize: 15, lineHeight: 1.5, marginTop: 10, maxWidth: 520 }}>
          {isMapped
            ? 'We have the course but not where this hole\u2019s tee and green are, so there\u2019s nothing to plan on.'
            : 'We have its scorecard but not where the tees and greens are, so there\u2019s nothing to plan on.'}
        </p>
        <div className="flex flex-wrap" style={{ gap: 12, marginTop: 22 }}>
          <button type="button" className="key key-primary" onClick={() => navigate('/plan')}>
            Pick another course
          </button>
          <button type="button" className="key" onClick={() => navigate(-1)}>
            Back
          </button>
        </div>
      </div>
    )
  }

  const totalHoles = holes.length
  const goToHole = (n: number) => {
    const clamped = Math.min(Math.max(n, 1), totalHoles)
    navigate(`/plan/${courseId}/${clamped}`)
  }

  // Longest club first, as a bag reads.
  const clubs = [...dispersion.byClub.values()].sort((x, y) => (y.medianDistanceYards ?? 0) - (x.medianDistanceYards ?? 0))
  const clubKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step || clubs.length === 0) return
    e.preventDefault()
    const i = clubs.findIndex((c) => c.club === focusedLegData?.club?.club)
    const next = (i + step + clubs.length) % clubs.length
    onClubChange(clubs[next]!)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus()
  }
  const label13 = { fontSize: 13, marginBottom: 6 } as const

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid grid-cols-1 gap-6 items-start lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* Controls — below the map on narrow screens, left column on desktop. */}
        <div className="order-2 flex flex-col gap-5 lg:order-1">
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <button
              type="button"
              className="key"
              aria-label="Previous hole"
              onClick={() => goToHole(holeNum - 1)}
              disabled={holeNum <= 1}
              style={{ padding: '0 14px' }}
            >
              <span className="font-serif" style={{ fontStyle: 'italic' }}>&larr;</span> Prev
            </button>
            <div style={{ textAlign: 'center', minWidth: 0 }}>
              {course?.name && (
                <div className="text-caddie-ink-dim" style={{ fontSize: 13, overflowWrap: 'anywhere' }}>
                  {course.name}
                </div>
              )}
              <h1 className="font-serif text-caddie-ink" style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}>
                Hole {hole.number}
              </h1>
              <div className="font-serif text-caddie-ink-dim" style={{ fontSize: 15, fontStyle: 'italic' }}>
                Par {hole.par}
                {hole.yards != null ? ` \u00b7 ${hole.yards} yd` : ''}
              </div>
            </div>
            <button
              type="button"
              className="key"
              aria-label="Next hole"
              onClick={() => goToHole(holeNum + 1)}
              disabled={holeNum >= totalHoles}
              style={{ padding: '0 14px' }}
            >
              Next <span className="font-serif" style={{ fontStyle: 'italic' }}>&rarr;</span>
            </button>
          </div>

          <div>
            <div className="text-caddie-ink-dim" style={label13}>
              Shot
            </div>
            <Rocker
              label="Shot"
              options={legs.map((_, i) => ({ value: i, label: `Shot ${i + 1}` }))}
              value={focusedLeg}
              onChange={setFocusedLeg}
            />
            <div className="flex flex-wrap" style={{ gap: 10, marginTop: 12 }}>
              <button type="button" className="key key-sm" onClick={addLeg}>
                Add next shot
              </button>
              <button type="button" className="key key-sm" onClick={removeLeg} disabled={legs.length <= 1}>
                Remove last shot
              </button>
            </div>
          </div>

          {clubs.length === 0 ? (
            <div className="text-caddie-ink-mute" style={{ fontSize: 13 }}>
              Log a few rounds with shot data to enable club-specific dispersion.
            </div>
          ) : (
            <div>
              <div className="text-caddie-ink-dim" style={label13} id="plan-club-label">
                Club
              </div>
              <div
                role="radiogroup"
                aria-labelledby="plan-club-label"
                onKeyDown={clubKeys}
                className="flex flex-wrap"
                style={{ gap: 6, paddingBottom: 3 }}
              >
                {clubs.map((c, i) => {
                  const on = c.club === focusedLegData?.club?.club
                  const noneOn = !clubs.some((x) => x.club === focusedLegData?.club?.club)
                  return (
                    <button
                      key={c.club}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={clubNoun(c.club)}
                      tabIndex={on || (noneOn && i === 0) ? 0 : -1}
                      onClick={() => onClubChange(c)}
                      className="key key-sm"
                      style={{ minWidth: 48, padding: '0 10px' }}
                    >
                      {formatClubLabel({ club_type: c.club })}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <SGFeedbackCard
            legSG={legSG}
            clubLabel={clubLabel}
            holeExpectedScore={holeExpectedScore}
            par={hole.par}
          />
        </div>

        {/* Map — on top on narrow screens, right column on desktop. */}
        <div
          className="order-1 lg:order-2"
          style={{
            height: 'min(80vh, 760px)',
            minHeight: 460,
            borderRadius: 3,
            border: '1px solid #1C211C',
            overflow: 'hidden',
          }}
        >
          <HoleStrategyMap
            tee={tee}
            pin={pin}
            legs={legs}
            focusedLeg={focusedLeg}
            onAimChange={onAimChange}
          />
        </div>
      </div>
    </div>
  )
}
