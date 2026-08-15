import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  DEFAULT_HANDICAP,
  LIE_TYPE_LABELS,
  bearingDegrees,
  destinationYards,
  formatClubLabel,
  isPuttShot,
  resolveHole,
  summarizePuttParts,
  summarizeShotParts,
  type DistanceUnit,
  type LieType,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { distanceYards } from '../../lib/maps'
import { FONT, TYPE } from '../../lib/typography'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HoleMap, type LatLng } from './HoleMap'
import type { HoleMapPhase } from './HoleMap.types'
import { PUTTING_RADIUS_YARDS } from './hole/types'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

// Debounce window for persisting an aim drag. The aim handle fires updates
// at ~25 Hz while dragging (HoleMap throttles to 40ms); we keep the marker
// tracking the finger locally and only write the settled position.
const AIM_PERSIST_DEBOUNCE_MS = 500

// One-line summary of the selected shot for the review stepper. Putts read
// "Putt · 12 ft · Made"; full shots read "7i · Fairway · 152 yd · Solid".
// Distance/result formatting lives in @oga/core (summarizePuttParts /
// summarizeShotParts, shared with web's ShotEntryModal); this wrapper adds
// the club·lie prefix (web shows those on their own row line) and the
// empty-state text.
function summarizeShot(
  row: ShotRow | null,
  next: ShotRow | null,
  unit: DistanceUnit,
): string {
  if (!row) return 'No details yet — tap Edit to add them'
  const parts = isPuttShot(row.lie_type)
    ? ['Putt', ...summarizePuttParts(row, unit)]
    : ([
        row.club ? formatClubLabel({ club_type: row.club }) : null,
        row.lie_type ? LIE_TYPE_LABELS[row.lie_type as LieType] : null,
        ...summarizeShotParts(row, next, unit),
      ].filter(Boolean) as string[])
  return parts.length ? parts.join(' · ') : 'No details yet — tap Edit to add them'
}

// The past-round map has TWO lifecycle-gated modes (#593), driven by
// `completed` (= round.completed_at != null):
//
//  • LOGGING (not completed): you're still entering an old round. Full
//    placement chrome — BALL / AIM / PIN modes (pin-setting included),
//    "+ Shot". Geometry only; shot details are edited on the scorecard.
//
//  • REVIEW (completed): the round is finalized. A shot stepper walks the
//    existing shots, the selected marker drags to reposition, "Edit this
//    shot" opens the shared scorecard sheet, and a new shot can be added
//    only off the last one. No pin chrome — a finalized round has its pins.
//
// Both share the seed / persist / score-sync plumbing below. Reuses HoleMap
// (the renderer) but NOT LiveRoundSession (the live GPS state machine) — #514.
interface PlacedShot {
  id: string | null
  shotNumber: number
  start: LatLng | null
  aim: LatLng | null
}

type PlacementMode = Extract<HoleMapPhase, 'PLACE_BALL' | 'SET_AIM' | 'PIN'>

// Half-width of the tee box (each dot sits this far to either side of the
// tee shot, perpendicular to the line of play). ~4 yd ≈ a real teeing ground.
const TEE_BOX_HALF_YARDS = 4

interface PastRoundMapProps {
  roundId: string
  userId: string
  /** round.completed_at != null — finalized → review; null → still logging. */
  completed: boolean
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  /** Per-tee hole overrides for the whole course — sparse, filtered to
   *  resolvedCourseTeeId below. Yards/par/stroke_index/tee location. */
  holeTees: HoleTeeRow[]
  /** The round's resolved course_tees.id (id-then-tee_color fallback,
   *  already computed by the parent via resolveCourseTee), or null if the
   *  round has no resolvable tee. */
  resolvedCourseTeeId: string | null
  shots: ShotRow[]
  unit: DistanceUnit
  courseCenter: LatLng | null
  holeNumber: number
  onHoleChange: (next: number) => void
  onEditShot: (shotId: string) => void
  onShotUpserted: (shot: ShotRow) => void
  onShotRemoved: (shotId: string) => void
  onHoleScoreChanged: (holeScore: HoleScoreRow) => void
}

const OKC_FALLBACK: LatLng = { lat: 35.5, lng: -97.5 }

export function PastRoundMap({
  roundId,
  userId,
  completed,
  holes,
  holeScores,
  holeTees,
  resolvedCourseTeeId,
  shots,
  unit,
  courseCenter,
  holeNumber,
  onHoleChange,
  onEditShot,
  onShotUpserted,
  onShotRemoved,
  onHoleScoreChanged,
}: PastRoundMapProps) {
  const insets = useSafeAreaInsets()

  const currentHole = useMemo(
    () => holes.find((h) => h.number === holeNumber) ?? null,
    [holes, holeNumber],
  )
  const currentHoleScore = useMemo(
    () =>
      currentHole
        ? holeScores.find((hs) => hs.hole_id === currentHole.id) ?? null
        : null,
    [holeScores, currentHole],
  )

  // Tee-resolved par/yards/stroke_index/tee-location — hole_tees override
  // for the round's resolved tee (if any) over the base holes row, with
  // hole_scores.par folded in. Sparse by design; falls through to base
  // values for the common case (no override yet).
  const resolvedHole = useMemo(() => {
    if (!currentHole) return null
    const teeOverride = resolvedCourseTeeId
      ? holeTees.find(
          (ht) => ht.hole_id === currentHole.id && ht.course_tee_id === resolvedCourseTeeId,
        ) ?? null
      : null
    return resolveHole(currentHole, teeOverride, { par: currentHoleScore?.par })
  }, [currentHole, currentHoleScore?.par, holeTees, resolvedCourseTeeId])

  const storedPin: LatLng | null = useMemo(
    () =>
      currentHole?.pin_lat != null && currentHole?.pin_lng != null
        ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
        : null,
    [currentHole],
  )
  const roundPin: LatLng | null = useMemo(
    () =>
      currentHoleScore?.pin_lat != null && currentHoleScore?.pin_lng != null
        ? { lat: currentHoleScore.pin_lat, lng: currentHoleScore.pin_lng }
        : null,
    [currentHoleScore],
  )
  const effectivePin = roundPin ?? storedPin
  const tee: LatLng | null = useMemo(
    () =>
      resolvedHole?.teeLat != null && resolvedHole?.teeLng != null
        ? { lat: resolvedHole.teeLat, lng: resolvedHole.teeLng }
        : null,
    [resolvedHole],
  )
  // Tee-first so the camera orients "up the hole" — useHoleCamera computes
  // heading from center→pin, and centering on the pin (as before) made
  // origin == target, collapsing the bearing to north-up. Pin is deliberately
  // NOT in the fallback chain, matching the live view (LiveRoundSession:
  // tee ?? courseCenter ?? ball): a hole with a round-pin but no surveyed tee
  // would otherwise resolve center == pin and re-collapse the heading. When no
  // tee resolves, courseCenter still gives a non-coincident origin.
  // effectivePin trails as a last resort BEFORE the OKC fallback — for a
  // manually-added course with no tee and null lat/lng, framing on the pin
  // (north-up, but on the hole) beats dropping the camera on Oklahoma. Pin is
  // last, so it never wins over tee/courseCenter and can't recollapse a real hole.
  const center = tee ?? courseCenter ?? effectivePin ?? OKC_FALLBACK

  const [placed, setPlaced] = useState<PlacedShot[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  // LOGGING placement mode (BALL/AIM/PIN). Ignored in REVIEW (forced
  // PLACE_BALL there so the camera stays flat top-down and the marker drags).
  const [mode, setMode] = useState<PlacementMode>('PLACE_BALL')
  // REVIEW: a fresh trailing draft is awaiting placement (tap drops it).
  const [adding, setAdding] = useState(false)
  // When set (a shot index), the "On the green?" prompt is showing for a ball
  // just placed within putting range (mirrors the live round's prompt). Yes
  // marks it a putt; No leaves it a chip/bunker. Putt DETAILS (made /
  // short-long / left-right / break) are edited on the scorecard sheet.
  const [greenPromptIdx, setGreenPromptIdx] = useState<number | null>(null)
  const aimTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clear a pending aim-debounce on unmount (e.g. switching to the Scorecard
  // tab mid-drag) so it can't fire a write against a torn-down component.
  useEffect(() => {
    return () => {
      if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    }
  }, [])

  // Re-seed the placement list whenever the hole changes (NOT on every
  // shots-prop change, which would clobber an in-progress placement). The
  // ref tracks which hole_score we've seeded so a parent shots update from
  // our own persist doesn't reset the user's work.
  const seededForRef = useRef<string | null>(null)
  useEffect(() => {
    const key = currentHoleScore?.id ?? `none-${holeNumber}`
    const hsId = currentHoleScore?.id
    const existing = hsId
      ? shots
          .filter(
            (s): s is ShotRow & { start_lat: number; start_lng: number } =>
              s.hole_score_id === hsId && s.start_lat != null && s.start_lng != null,
          )
          .sort((a, b) => a.shot_number - b.shot_number)
          .map<PlacedShot>((s) => ({
            id: s.id,
            shotNumber: s.shot_number,
            start: { lat: s.start_lat, lng: s.start_lng },
            aim:
              s.aim_lat != null && s.aim_lng != null
                ? { lat: s.aim_lat, lng: s.aim_lng }
                : null,
          }))
      : []
    if (seededForRef.current === key) {
      // `shots` load AFTER `hole_scores` (parent's useFocusEffect), so the
      // first seed for a hole can land before the real shots arrive → an
      // empty draft. Adopt the real shots when they show up, but ONLY while
      // the user hasn't started placing (every entry still an un-persisted
      // draft) so our own persist writes never clobber in-progress work.
      // Once adopted, `placed` has ids → this branch is a no-op (loop-safe).
      if (existing.length > 0 && placed.every((s) => s.id == null)) {
        setPlaced(existing)
        setActiveIdx(existing.length - 1)
        setMode('PLACE_BALL')
        setAdding(false)
      }
      return
    }
    seededForRef.current = key
    const seeded =
      existing.length > 0
        ? existing
        : [{ id: null, shotNumber: 1, start: null, aim: null }]
    setPlaced(seeded)
    setActiveIdx(seeded.length - 1)
    setMode('PLACE_BALL')
    setAdding(false)
  }, [currentHoleScore?.id, holeNumber, shots, placed])

  const active = placed[activeIdx] ?? null
  const activeShotRow = useMemo(
    () => (active?.id ? shots.find((s) => s.id === active.id) ?? null : null),
    [shots, active?.id],
  )
  // Next shot after the active one — its start is the active shot's end, so
  // core's summarizeShotParts can haversine a distance when
  // distance_to_target is null.
  const activeShotNext = useMemo(
    () =>
      activeShotRow
        ? shots.find(
            (s) =>
              // `shots` is round-wide; shot_number restarts per hole.
              s.hole_score_id === activeShotRow.hole_score_id &&
              s.shot_number === activeShotRow.shot_number + 1,
          ) ?? null
        : null,
    [shots, activeShotRow],
  )

  // The actually-placed shots, paired with their index in `placed`. The
  // review stepper walks this list; an un-placed trailing draft (while
  // adding) is excluded so "Shot N of M" counts only real shots.
  const placedReal = useMemo(
    () => placed.map((s, i) => ({ s, i })).filter((x) => x.s.start != null),
    [placed],
  )
  const activePos = placedReal.findIndex((x) => x.i === activeIdx)
  const isLastSelected =
    placedReal.length > 0 && activePos === placedReal.length - 1

  const previousStarts = useMemo(
    () =>
      placed
        .slice(0, activeIdx)
        .map((s) => s.start)
        .filter((p): p is LatLng => p != null),
    [placed, activeIdx],
  )

  const startedCount = useMemo(
    () => placed.filter((s) => s.start != null).length,
    [placed],
  )

  // Tee box = two dots flanking the tee shot, perpendicular to the line of
  // play. ALWAYS derived from the first placed shot's start (where the player
  // actually teed off) — the stored course tee is consulted ONLY as a last
  // resort when no first shot exists yet. Oriented toward that shot's aim, then pin.
  const teeBox = useMemo<[LatLng, LatLng] | null>(() => {
    const origin = placed[0]?.start ?? tee
    if (!origin) return null
    const toward = placed[0]?.aim ?? effectivePin
    const heading = toward
      ? bearingDegrees(origin.lat, origin.lng, toward.lat, toward.lng)
      : 0
    return [
      destinationYards(origin, heading - 90, TEE_BOX_HALF_YARDS),
      destinationYards(origin, heading + 90, TEE_BOX_HALF_YARDS),
    ]
  }, [placed, tee, effectivePin])

  // Keep hole_scores.score honest with the placed-shot count (a placed shot
  // IS a stroke). Pure score-only entry on the scorecard is untouched —
  // this only fires when the map owns shot creation for the hole.
  async function syncScore(count: number) {
    if (!currentHoleScore) return
    const { data, error } = await supabase
      .from('hole_scores')
      .update({ score: count })
      .eq('id', currentHoleScore.id)
      .eq('round_id', roundId)
      .select()
      .single()
    if (error) {
      Alert.alert('Save failed', error.message)
      return
    }
    if (data) onHoleScoreChanged(data as HoleScoreRow)
  }

  async function persistShotAt(
    idx: number,
    next: { start?: LatLng | null; aim?: LatLng | null },
  ) {
    if (!currentHoleScore) return
    const shot = placed[idx]
    if (!shot) return
    const start = next.start !== undefined ? next.start : shot.start
    const aim = next.aim !== undefined ? next.aim : shot.aim
    if (!start) return
    const distance = effectivePin
      ? Math.round(distanceYards(start, effectivePin))
      : null
    const row = {
      hole_score_id: currentHoleScore.id,
      user_id: userId,
      shot_number: shot.shotNumber,
      start_lat: start.lat,
      start_lng: start.lng,
      aim_lat: aim?.lat ?? null,
      aim_lng: aim?.lng ?? null,
      distance_to_target: distance,
    }
    if (shot.id) {
      const { data, error } = await supabase
        .from('shots')
        .update(row)
        .eq('id', shot.id)
        .eq('user_id', userId)
        .select()
        .single()
      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }
      if (data) onShotUpserted(data as ShotRow)
    } else {
      const { data, error } = await supabase
        .from('shots')
        .insert(row)
        .select()
        .single()
      if (error) {
        Alert.alert('Save failed', error.message)
        return
      }
      if (data) {
        const saved = data as ShotRow
        setPlaced((prev) =>
          prev.map((s, i) => (i === idx ? { ...s, id: saved.id } : s)),
        )
        onShotUpserted(saved)
        // Count idx as started: the closure `placed` predates this shot's
        // start being set, so filtering it directly under-counts by one
        // (the score off-by-one — every hole read one stroke low). See #514 QA.
        await syncScore(
          placed.filter((s, i) => (i === idx ? true : s.start != null)).length,
        )
      }
    }
  }

  // Map tap (LOGGING, or REVIEW only while adding) OR a marker drag (always,
  // in PLACE_BALL) lands here. A drag on an existing shot just repositions +
  // persists. A FIRST placement may trip the green prompt, then either aims
  // (logging) or drops back to review (completed).
  async function handleSetBall(loc: LatLng) {
    const wasInitial = active?.start == null
    setPlaced((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, start: loc } : s)),
    )
    // Await the placement INSERT so the row + id exist before any follow-up
    // (a putt confirmation may update it). Only branch on the FIRST placement.
    await persistShotAt(activeIdx, { start: loc })
    if (!wasInitial) return
    // Within putting range of the pin → ask "On the green?" (mirrors the live
    // prompt) instead of forcing aim. A putt skips aiming entirely.
    if (effectivePin && distanceYards(loc, effectivePin) <= PUTTING_RADIUS_YARDS) {
      setGreenPromptIdx(activeIdx)
    } else if (completed) {
      // Review: the added shot is placed; details on the scorecard. No aim.
      setAdding(false)
    } else {
      // Logging: aim as usual.
      setMode('SET_AIM')
    }
  }

  // "On the green?" → Yes: it's a putt. Mark lie/club + pre-fill the putt
  // distance (start→pin) so the scorecard's putt editor is ready. Logging
  // auto-advances to the next shot; review drops back to the stepper.
  async function handleGreenYes() {
    const idx = greenPromptIdx
    setGreenPromptIdx(null)
    if (idx == null) return
    const shot = placed[idx]
    if (!shot?.id) {
      // The placement INSERT failed (rare — handleSetBall awaits it). Don't
      // silently advance as if the putt were recorded; surface it so the
      // player can re-place the ball.
      Alert.alert('Save failed', "That shot didn't save — try placing the ball again.")
      return
    }
    const distFt =
      shot.start && effectivePin
        ? Math.round(distanceYards(shot.start, effectivePin) * 3)
        : null
    const { data, error } = await supabase
      .from('shots')
      .update({ lie_type: 'green', club: 'putter', putt_distance_ft: distFt })
      .eq('id', shot.id)
      .eq('user_id', userId)
      .select()
      .single()
    if (error) {
      Alert.alert('Save failed', error.message)
      return
    }
    if (data) onShotUpserted(data as ShotRow)
    if (completed) {
      setAdding(false)
    } else {
      // Advance to the next shot (reuses the +Shot path) so you can place the
      // next ball immediately — only after the putt mark persisted.
      handleAddShot()
    }
  }

  // "On the green?" → No: not a putt (chip / bunker / fringe). Logging aims
  // it as usual; review drops back to the stepper (details on the scorecard).
  function handleGreenNo() {
    setGreenPromptIdx(null)
    if (completed) {
      setAdding(false)
    } else {
      setMode('SET_AIM')
    }
  }

  function handleSetAim(loc: LatLng) {
    setPlaced((prev) =>
      prev.map((s, i) => (i === activeIdx ? { ...s, aim: loc } : s)),
    )
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    aimTimerRef.current = setTimeout(() => {
      persistShotAt(activeIdx, { aim: loc })
    }, AIM_PERSIST_DEBOUNCE_MS)
  }

  async function handleSetPin(loc: LatLng) {
    if (!currentHoleScore) return
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    const { data, error } = await supabase
      .from('hole_scores')
      .update({ pin_lat: loc.lat, pin_lng: loc.lng })
      .eq('id', currentHoleScore.id)
      .eq('round_id', roundId)
      .select()
      .single()
    if (error) {
      Alert.alert('Pin save failed', error.message)
      return
    }
    if (data) onHoleScoreChanged(data as HoleScoreRow)
    setMode('PLACE_BALL')
  }

  // LOGGING "+ Shot": append a fresh draft and drop into placing it.
  function handleAddShot() {
    if (!active?.start) return // don't stack two empty drafts
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    setPlaced((prev) => [
      ...prev,
      { id: null, shotNumber: prev.length + 1, start: null, aim: null },
    ])
    setActiveIdx(placed.length)
    setMode('PLACE_BALL')
  }

  function stepTo(pos: number) {
    const target = placedReal[pos]
    if (!target) return
    setActiveIdx(target.i)
  }

  // REVIEW "+ Add shot" — only reachable off the LAST shot (#593). Reuse a
  // trailing empty draft (the empty-hole seed) if one exists; otherwise
  // append a fresh draft and select it for placement.
  function handleStartAddShot() {
    const last = placed[placed.length - 1]
    if (last && last.start == null) {
      setActiveIdx(placed.length - 1)
    } else {
      setPlaced((prev) => [
        ...prev,
        { id: null, shotNumber: prev.length + 1, start: null, aim: null },
      ])
      setActiveIdx(placed.length)
    }
    setMode('PLACE_BALL')
    setAdding(true)
  }

  function handleCancelAdd() {
    // Drop a trailing un-placed draft we appended (but keep the sole
    // empty-hole draft so the map still has a placement target).
    const last = placed[placed.length - 1]
    if (last && last.start == null && placed.length > 1) {
      const trimmed = placed.slice(0, -1)
      setPlaced(trimmed)
      setActiveIdx(trimmed.length - 1)
    }
    setAdding(false)
  }

  async function handleRemoveShot() {
    if (!active) return
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    if (active.id) {
      const { error } = await supabase
        .from('shots')
        .delete()
        .eq('id', active.id)
        .eq('user_id', userId)
      if (error) {
        Alert.alert('Remove failed', error.message)
        return
      }
      onShotRemoved(active.id)
    }
    const nextPlaced = placed.filter((_, i) => i !== activeIdx)
    const ensured =
      nextPlaced.length > 0
        ? nextPlaced.map((s, i) => ({ ...s, shotNumber: i + 1 }))
        : [{ id: null, shotNumber: 1, start: null, aim: null }]
    setPlaced(ensured)
    setActiveIdx(Math.max(0, ensured.length - 1))
    setMode('PLACE_BALL')
    setAdding(false)
    await syncScore(ensured.filter((s) => s.start != null).length)
  }

  function goToHole(next: number) {
    if (next < 1 || next > holes.length) return
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    onHoleChange(next)
  }

  const par = resolvedHole?.par ?? currentHole?.par ?? null

  return (
    <View style={{ flex: 1, backgroundColor: '#1C211C' }}>
      {/* Hole nav strip */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#1C211C',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(242,238,229,0.12)',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous hole"
          disabled={holeNumber <= 1}
          onPress={() => goToHole(holeNumber - 1)}
          hitSlop={10}
          style={{ padding: 6, opacity: holeNumber <= 1 ? 0.35 : 1 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.75)' }}>‹ Prev</Text>
        </Pressable>
        <Text
          style={[TYPE.serif, {
            color: '#F2EEE5',
            fontSize: 16,
          }]}
        >
          Hole {holeNumber}
          {par != null ? ` · Par ${par}` : ''}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next hole"
          disabled={holeNumber >= holes.length}
          onPress={() => goToHole(holeNumber + 1)}
          hitSlop={10}
          style={{ padding: 6, opacity: holeNumber >= holes.length ? 0.35 : 1 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.75)' }}>Next ›</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          teeBox={teeBox}
          aim={active?.aim ?? null}
          ball={active?.start ?? null}
          previousShots={previousStarts}
          // REVIEW is always flat top-down (PLACE_BALL) so the selected marker
          // drags; LOGGING follows the BALL/AIM/PIN mode chips.
          phase={completed ? 'PLACE_BALL' : mode}
          // Review: tap-to-place only while adding a new shot (otherwise
          // drag-only so stray taps don't move the selected shot). Logging:
          // always tap-to-place.
          tapToPlaceBall={completed ? adding : true}
          gpsPosition={null}
          courseCenter={courseCenter}
          holeNumber={holeNumber}
          onSetAim={handleSetAim}
          onSetBall={handleSetBall}
          onPlacePin={handleSetPin}
          showLocationPuck={false}
          overlayMode="tee"
          arcWidthYards={0}
          circleRadiusYards={0}
          dotsVisible={false}
          dispersionPoints={null}
          handicap={DEFAULT_HANDICAP}
        />
      </View>

      {/* Bottom controls */}
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: insets.bottom + 12,
          borderTopWidth: 1,
          borderTopColor: 'rgba(242,238,229,0.12)',
          gap: 12,
        }}
      >
        {!completed ? (
          /* ───────── LOGGING: full placement chrome ───────── */
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ModeChip
                label="Ball"
                active={mode === 'PLACE_BALL'}
                onPress={() => setMode('PLACE_BALL')}
              />
              <ModeChip
                label="Aim"
                active={mode === 'SET_AIM'}
                disabled={!active?.start}
                onPress={() => setMode('SET_AIM')}
              />
              <ModeChip label="Pin" active={mode === 'PIN'} onPress={() => setMode('PIN')} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove this shot"
                onPress={handleRemoveShot}
                disabled={!active?.start && placed.length <= 1}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(242,238,229,0.3)',
                  borderRadius: 2,
                  opacity: !active?.start && placed.length <= 1 ? 0.4 : 1,
                }}
              >
                <Text style={{ ...KICKER, color: '#E0B7AC' }}>Remove</Text>
              </Pressable>
              <Text
                style={[TYPE.kicker, {
                  flex: 1,
                  textAlign: 'center',
                  color: 'rgba(242,238,229,0.7)',
                  fontSize: 12,
                  fontVariant: ['tabular-nums'],
                }]}
              >
                {startedCount === 0
                  ? 'Tap the map to place shot 1'
                  : `${startedCount} shot${startedCount === 1 ? '' : 's'} placed`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another shot"
                onPress={handleAddShot}
                disabled={!active?.start}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  backgroundColor: !active?.start ? '#3A4138' : '#2E7D52',
                  borderRadius: 2,
                  opacity: !active?.start ? 0.5 : 1,
                }}
              >
                <Text style={{ ...KICKER, color: '#F2EEE5' }}>+ Shot</Text>
              </Pressable>
            </View>
          </>
        ) : adding ? (
          /* ───────── REVIEW: placing a newly added shot ───────── */
          <View style={{ gap: 12 }}>
            <Text
              style={[TYPE.kicker, {
                textAlign: 'center',
                color: 'rgba(242,238,229,0.8)',
                fontSize: 12,
              }]}
            >
              {`Tap the map to place shot ${active?.shotNumber ?? placedReal.length + 1}`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel adding shot"
              onPress={handleCancelAdd}
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: 'rgba(242,238,229,0.3)',
                borderRadius: 2,
              }}
            >
              <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.8)' }}>Cancel</Text>
            </Pressable>
          </View>
        ) : placedReal.length === 0 ? (
          /* ───────── REVIEW: finalized hole with no shots ───────── */
          <View style={{ gap: 12 }}>
            <Text
              style={[TYPE.body, {
                textAlign: 'center',
                color: 'rgba(242,238,229,0.7)',
                fontSize: 13,
              }]}
            >
              No shots logged for this hole.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add the first shot"
              onPress={handleStartAddShot}
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                backgroundColor: '#2E7D52',
                borderRadius: 2,
              }}
            >
              <Text style={{ ...KICKER, color: '#F2EEE5' }}>+ Add shot</Text>
            </Pressable>
          </View>
        ) : (
          /* ───────── REVIEW: shot stepper ───────── */
          <>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Previous shot"
                disabled={activePos <= 0}
                onPress={() => stepTo(activePos - 1)}
                hitSlop={10}
                style={{ padding: 6, opacity: activePos <= 0 ? 0.35 : 1 }}
              >
                <Text style={{ ...KICKER, color: '#F2EEE5', fontSize: 16 }}>‹</Text>
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center', gap: 3 }}>
                <Text
                  style={[TYPE.serif, {
                    color: '#F2EEE5',
                    fontSize: 16,
                  }]}
                >
                  Shot {activePos + 1} of {placedReal.length}
                </Text>
                <Text
                  style={[TYPE.body, {
                    color: 'rgba(242,238,229,0.7)',
                    fontSize: 12,
                    textAlign: 'center',
                  }]}
                  numberOfLines={1}
                >
                  {summarizeShot(activeShotRow, activeShotNext, unit)}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Next shot"
                disabled={activePos >= placedReal.length - 1}
                onPress={() => stepTo(activePos + 1)}
                hitSlop={10}
                style={{
                  padding: 6,
                  opacity: activePos >= placedReal.length - 1 ? 0.35 : 1,
                }}
              >
                <Text style={{ ...KICKER, color: '#F2EEE5', fontSize: 16 }}>›</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove this shot"
                onPress={handleRemoveShot}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderWidth: 1,
                  borderColor: 'rgba(242,238,229,0.3)',
                  borderRadius: 2,
                }}
              >
                <Text style={{ ...KICKER, color: '#E0B7AC' }}>Remove</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit this shot's details"
                disabled={!active?.id}
                onPress={() => active?.id && onEditShot(active.id)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: active?.id ? '#F2EEE5' : '#3A4138',
                  borderRadius: 2,
                  opacity: active?.id ? 1 : 0.5,
                }}
              >
                <Text
                  style={{
                    ...KICKER,
                    color: active?.id ? '#1C211C' : 'rgba(242,238,229,0.6)',
                  }}
                >
                  Edit this shot
                </Text>
              </Pressable>
            </View>

            {isLastSelected && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another shot"
                onPress={handleStartAddShot}
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                  backgroundColor: '#2E7D52',
                  borderRadius: 2,
                }}
              >
                <Text style={{ ...KICKER, color: '#F2EEE5' }}>+ Add shot</Text>
              </Pressable>
            )}
          </>
        )}
      </View>

      {/* "On the green?" — mirrors the live round prompt. Yes → it's a putt
          (no aim, details on the scorecard); No → aim as a chip/bunker shot
          (logging) or just place it (review). */}
      <ConfirmDialog
        visible={greenPromptIdx != null}
        title="On the green?"
        message="Within 30 yd of the pin — were you putting, or chipping/in a bunker?"
        confirmLabel="Yes, I'm putting"
        cancelLabel="No"
        onConfirm={handleGreenYes}
        onCancel={handleGreenNo}
      />
    </View>
  )
}

function ModeChip({
  label,
  active,
  disabled,
  onPress,
}: {
  label: string
  active: boolean
  disabled?: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 2,
        backgroundColor: active ? '#F2EEE5' : 'transparent',
        borderWidth: 1,
        borderColor: active ? '#F2EEE5' : 'rgba(242,238,229,0.3)',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <Text
        style={{
          ...KICKER,
          color: active ? '#1C211C' : 'rgba(242,238,229,0.8)',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}
