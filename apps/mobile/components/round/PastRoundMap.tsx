import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import {
  DEFAULT_HANDICAP,
  LIE_TYPE_LABELS,
  NEAR_GREEN_YARDS,
  SHOT_RESULT_LABELS,
  bearingDegrees,
  destinationYards,
  formatClubLabel,
  formatDistance,
  getExpectedStrokes,
  isPuttShot,
  obCount,
  projectShotMove,
  resolveHole,
  summarizePuttParts,
  summarizeShotParts,
  type DistanceUnit,
  type LieType,
  type ShotResult,
} from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { distanceYards } from '../../lib/maps'
import { Icon } from '../paper/icons'
import { MARGIN, P } from '../paper/tokens'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { HoleMap, type LatLng } from './HoleMap'
import type { HoleMapPhase, PastCrumbs } from './HoleMap.types'
import { PUTTING_RADIUS_YARDS } from './hole/types'
import { Em, NoPinVoice, Primary, Secondary, SmallKey, Voice } from '../paper/Dock'
import { ButtonRow, ModeRocker, PastFooter, ShotStepperRow } from './past/PastFooter'
import { PastHoleBlock, type HoleResult } from './past/PastHoleBlock'
import { ShotCallout, type Projector } from './past/ShotCallout'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

// Debounce window for persisting an aim drag. The aim handle fires updates
// at ~25 Hz while dragging (HoleMap throttles to 40ms); we keep the marker
// tracking the finger locally and only write the settled position.
const AIM_PERSIST_DEBOUNCE_MS = 500

// One-line summary of the selected shot for the review stepper (§19.5).
// Putts read "Putt · 12 ft · Made"; full shots read "7i · fairway · 152 yd to
// the pin · Solid". Distance/result formatting lives in @oga/core
// (summarizePuttParts / summarizeShotParts, shared with web's ShotEntryModal).
// "to the pin" only when the yardage IS distance_to_target (start → pin); the
// haversine fallback measures to the next shot's start instead.
function summarizeShot(
  row: ShotRow | null,
  next: ShotRow | null,
  unit: DistanceUnit,
): string {
  if (!row) return 'No details yet — tap Edit to add them'
  const [distance] = summarizeShotParts({ ...row, shot_result: null }, next, unit)
  const parts = isPuttShot(row.lie_type)
    ? ['Putt', ...summarizePuttParts(row, unit)]
    : ([
        row.club ? formatClubLabel({ club_type: row.club }) : null,
        row.lie_type ? LIE_TYPE_LABELS[row.lie_type as LieType]?.toLowerCase() ?? null : null,
        distance && row.distance_to_target != null ? `${distance} to the pin` : distance,
        row.shot_result
          ? SHOT_RESULT_LABELS[row.shot_result as ShotResult] ?? row.shot_result
          : null,
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
  /** Out-of-bounds flag (#839). Optional — fresh drafts (new/unplaced shots)
   *  omit it and read as false; only the seed-from-`shots` site below sets it. */
  ob?: boolean
}

type PlacementMode = Extract<HoleMapPhase, 'PLACE_BALL' | 'SET_AIM' | 'PIN'>

// Mode rocker's bottom over the map: 8 above the footer per §19.4, plus the
// Mapbox logo's strip (bottom-left of the map, which ToS keeps visible).
const ROCKER_BOTTOM = 36

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
  /** Player handicap for the hero's expected strokes; DEFAULT_HANDICAP until
   *  the parent passes the profile's. */
  handicap?: number
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
  handicap = DEFAULT_HANDICAP,
}: PastRoundMapProps) {

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
            ob: s.ob === true,
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
  // IS a stroke) plus this hole's penalty strokes — a stroke-and-distance OB
  // has no row of its own, so a raw row count would silently revert it
  // (#839). Scoped to this hole_score_id, never round-wide. Pure score-only
  // entry on the scorecard is untouched — this only fires when the map owns
  // shot creation for the hole.
  async function syncScore(count: number) {
    if (!currentHoleScore) return
    const obStrokes = obCount(
      shots.filter((s) => s.hole_score_id === currentHoleScore.id),
    )
    const { data, error } = await supabase
      .from('hole_scores')
      .update({ score: count + obStrokes })
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
    // A shot only becomes a putt via handleGreenYes's own direct update (lie_type
    // + club) — this move/aim path never sets lie_type, so the existing server
    // row (if any) is the source of truth for whether this is a putt.
    const existingRow = shot.id ? shots.find((s) => s.id === shot.id) ?? null : null
    const proj = projectShotMove({
      newStart: start,
      pin: effectivePin ?? null,
      isPutt: isPuttShot(existingRow?.lie_type ?? null),
    })
    const row: Database['public']['Tables']['shots']['Insert'] = {
      hole_score_id: currentHoleScore.id,
      user_id: userId,
      shot_number: shot.shotNumber,
      start_lat: proj.startLat,
      start_lng: proj.startLng,
      aim_lat: aim?.lat ?? null,
      aim_lng: aim?.lng ?? null,
      // #662 guard: undefined (pin-less non-putt) leaves distance_to_target
      // untouched instead of nulling a previously-valid value.
      ...(proj.distanceToTarget !== undefined
        ? { distance_to_target: proj.distanceToTarget }
        : {}),
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
      // delete_shot is atomic on the server: deletes the row, renumbers the
      // surviving shots' shot_number, and re-tallies hole_scores (score/putts/
      // penalties/fairway_hit/gir) in one transaction — a client syncScore
      // after this would fight that re-tally, so it's deliberately not called
      // below.
      const { error } = await supabase.rpc('delete_shot', { p_shot_id: active.id })
      if (error) {
        Alert.alert('Remove failed', error.message)
        return
      }
      onShotRemoved(active.id)
      // The RPC re-tallied hole_scores server-side; READ the updated row (do NOT
      // overwrite it) and propagate so the parent's shown hole score/round total
      // reflect the delete instead of going stale until a refetch/remount.
      if (currentHoleScore) {
        const { data: updatedHs } = await supabase
          .from('hole_scores')
          .select('*')
          .eq('id', currentHoleScore.id)
          .single()
        if (updatedHs) onHoleScoreChanged(updatedHs as HoleScoreRow)
      }
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
  }

  function goToHole(next: number) {
    if (next < 1 || next > holes.length) return
    if (aimTimerRef.current) clearTimeout(aimTimerRef.current)
    onHoleChange(next)
  }

  const par = resolvedHole?.par ?? currentHole?.par ?? null

  // Hole block hero (§19.2): To Hole from the SELECTED shot's start — the
  // stepper's shot in review, the shot being placed (or else the last one
  // placed) while logging — and expected strokes from there, as the live
  // header computes them.
  const heroShot = active?.start ? active : placedReal[placedReal.length - 1]?.s ?? null
  const heroRow = heroShot?.id ? shots.find((s) => s.id === heroShot.id) ?? null : null
  const heroYards =
    heroShot?.start && effectivePin ? distanceYards(heroShot.start, effectivePin) : null
  const heroPutt = isPuttShot(heroRow?.lie_type ?? null)
  const heroDistance =
    heroYards == null
      ? null
      : splitDisplay(
          heroPutt && unit !== 'meters'
            ? `${(heroYards * 3).toFixed(1)} ft`
            : formatDistance(heroYards, unit, 1),
        )
  const expected =
    heroYards == null
      ? null
      : heroPutt
        ? getExpectedStrokes('putting', undefined, heroYards * 3, handicap)
        : getExpectedStrokes(
            heroYards <= NEAR_GREEN_YARDS ? 'around_green' : 'approach',
            Math.round(heroYards),
            undefined,
            handicap,
          )

  // Corner (§19.9 A). While logging, the map keeps hole_scores.score equal
  // to the placed shots + penalties (syncScore), so that running tally reads
  // "N shots so far"; a score that differs came from the scorecard and shows.
  const holeScore = currentHoleScore?.score ?? 0
  const tally =
    startedCount +
    (currentHoleScore ? obCount(shots.filter((s) => s.hole_score_id === currentHoleScore.id)) : 0)
  const result: HoleResult =
    holeScore > 0 && (completed || holeScore !== tally)
      ? {
          scored: true,
          score: holeScore,
          toPar: par != null ? holeScore - par : null,
          putts: currentHoleScore?.putts ?? null,
        }
      : { scored: false, shots: startedCount }

  // Breadcrumbs (§19.3): every placed start; the selected one is the ball.
  // Its leg runs to the next start, or to the pin for the last shot unless
  // the aim line already draws that way.
  const nextStart = activePos >= 0 ? placedReal[activePos + 1]?.s.start ?? null : null
  const prevStart = activePos > 0 ? placedReal[activePos - 1]?.s.start ?? null : null
  const segEnd = active?.start ? nextStart ?? (active.aim ? null : effectivePin) : null
  const selectCrumbs = completed && !adding
  const pastCrumbs = useMemo<PastCrumbs>(() => {
    const others = placedReal.filter((x) => x.i !== activeIdx)
    return {
      crumbs: others.map(({ s }) => ({ at: s.start!, n: s.shotNumber, ob: s.ob === true })),
      path: placedReal.map((x) => x.s.start!),
      segment: active?.start && segEnd ? [active.start, segEnd] : null,
      selectedN: active?.start ? active.shotNumber : null,
      onSelect: selectCrumbs ? (ci) => others[ci] && setActiveIdx(others[ci].i) : undefined,
    }
  }, [placedReal, activeIdx, active?.start, active?.shotNumber, segEnd, selectCrumbs])

  // Flag callout (§19.9 C) on the selected start: the aim leg while logging
  // an aimed shot, otherwise the leg to the next shot / the pin.
  const aimLeg = !completed && active?.aim ? active.aim : null
  const legEnd = aimLeg ?? nextStart ?? effectivePin
  const club = activeShotRow?.club ? formatClubLabel({ club_type: activeShotRow.club }) : null
  const legTo = aimLeg ? 'aim' : nextStart ? `to shot ${(active?.shotNumber ?? 0) + 1}` : 'to the pin'
  const callout =
    active?.start && legEnd
      ? {
          ...splitDisplay(formatDistance(distanceYards(active.start, legEnd), unit, 1)),
          sub: club ? `${club} · ${legTo}` : legTo,
        }
      : null
  const calloutMarkers = useMemo(
    () =>
      [...pastCrumbs.crumbs.map((c) => c.at), effectivePin, active?.aim ?? null].filter(
        (m): m is LatLng => m != null,
      ),
    [pastCrumbs.crumbs, effectivePin, active?.aim],
  )
  const projectRef = useRef<Projector['current']>(null)
  const cameraListenerRef = useRef<(() => void) | null>(null)
  const onCameraChanged = useCallback(() => cameraListenerRef.current?.(), [])

  const n = active?.shotNumber ?? 1

  return (
    <View style={{ flex: 1, backgroundColor: P.chrome }}>
      <PastHoleBlock
        holeNumber={holeNumber}
        holeCount={holes.length}
        par={par}
        yardsLabel={resolvedHole?.yards ? formatDistance(resolvedHole.yards, unit) : null}
        result={result}
        distance={heroDistance}
        expected={expected}
        onPrev={() => goToHole(holeNumber - 1)}
        onNext={() => goToHole(holeNumber + 1)}
      />

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          fitHole={(placed[0]?.start ?? tee) && effectivePin ? [(placed[0]?.start ?? tee)!, effectivePin] : null}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          teeBox={teeBox}
          aim={active?.aim ?? null}
          ball={active?.start ?? null}
          pastCrumbs={pastCrumbs}
          projectRef={projectRef}
          onCameraChanged={onCameraChanged}
          // REVIEW is always flat top-down (PLACE_BALL) so the selected marker
          // drags; LOGGING follows the Ball/Aim/Pin rocker.
          phase={completed ? 'PLACE_BALL' : mode}
          // Review: tap-to-place only while adding a new shot (otherwise
          // drag-only so stray taps don't move the selected shot). Logging:
          // always tap-to-place.
          tapToPlaceBall={completed ? adding : true}
          // The rocker "sets what a map tap does" (§19.4): Aim mode taps aim.
          tapToSetAim={!completed}
          gpsPosition={null}
          courseCenter={courseCenter}
          holeNumber={holeNumber}
          onSetAim={handleSetAim}
          onSetBall={handleSetBall}
          onPlacePin={handleSetPin}
          showLocationPuck={false}
          // No GPS here, and nothing floats over this map's bottom edge —
          // its controls are a solid panel below it.
          aimBallInset={50}
          overlayMode="tee"
          arcWidthYards={0}
          circleRadiusYards={0}
          dotsVisible={false}
          dispersionPoints={null}
          handicap={handicap}
        />
        {callout && active?.start && mode !== 'PIN' && (
          <ShotCallout
            projectRef={projectRef}
            cameraListenerRef={cameraListenerRef}
            anchor={active.start}
            end={legEnd}
            prev={prevStart}
            markers={calloutMarkers}
            avoidCorner={completed ? undefined : { w: MARGIN + 186 + 4, h: ROCKER_BOTTOM + 47 + 4 }}
            value={callout.value}
            unit={callout.unit}
            sub={callout.sub}
          />
        )}
        {!completed && (
          // Bottom-left over the map, lifted clear of the Mapbox logo (ToS).
          <View style={{ position: 'absolute', left: MARGIN, bottom: ROCKER_BOTTOM }}>
            <ModeRocker value={mode} onChange={setMode} aimDisabled={!active?.start} />
          </View>
        )}
      </View>

      <PastFooter>
        {!completed ? (
          /* ───────── LOGGING (§19.4) ───────── */
          <>
            {mode === 'PIN' ? (
              <Voice
                trailing={
                  <SmallKey label="Cancel" a11y="Cancel pin placement" onPress={() => setMode('PLACE_BALL')} />
                }
              >
                <Em>Where’s the flag?</Em> Tap it on the map.
              </Voice>
            ) : !effectivePin ? (
              <NoPinVoice onPress={() => setMode('PIN')} />
            ) : mode === 'SET_AIM' ? (
              <Voice>
                <Em>Tap where you aimed shot {n}.</Em>
              </Voice>
            ) : !active?.start ? (
              startedCount === 0 ? (
                <Voice>
                  <Em>Tap the map where you hit shot {n}.</Em>
                </Voice>
              ) : (
                <Voice>
                  Shot {n - 1} is on the map. <Em>Tap where you hit shot {n}.</Em>
                </Voice>
              )
            ) : (
              <Voice>
                Shot {n} is on the map. <Em>Drag to fine-tune</Em>, or add shot {n + 1}.
              </Voice>
            )}
            <ButtonRow>
              <Secondary
                label={`Remove shot ${n}`}
                a11y="Remove this shot"
                onPress={handleRemoveShot}
                disabled={!active?.start && placed.length <= 1}
              />
              <Primary
                plus
                label={`Add shot ${n + 1}`}
                a11y="Add another shot"
                onPress={handleAddShot}
                disabled={!active?.start}
              />
            </ButtonRow>
          </>
        ) : adding ? (
          /* ───────── REVIEW: placing a newly added shot ───────── */
          <Voice trailing={<SmallKey label="Cancel" a11y="Cancel adding shot" onPress={handleCancelAdd} />}>
            <Em>Tap the map where you hit shot {active?.shotNumber ?? placedReal.length + 1}.</Em>
          </Voice>
        ) : placedReal.length === 0 ? (
          /* ───────── REVIEW: finalized hole with no shots ───────── */
          <>
            <Voice>No shots logged for this hole.</Voice>
            <ButtonRow>
              <Primary plus label="Add shot" a11y="Add the first shot" onPress={handleStartAddShot} />
            </ButtonRow>
          </>
        ) : (
          /* ───────── REVIEW: shot stepper (§19.5) ───────── */
          <>
            <ShotStepperRow
              pos={activePos}
              count={placedReal.length}
              summary={summarizeShot(activeShotRow, activeShotNext, unit)}
              onPrev={() => stepTo(activePos - 1)}
              onNext={() => stepTo(activePos + 1)}
            />
            <ButtonRow>
              <Secondary label="Remove" a11y="Remove this shot" color={P.neg} onPress={handleRemoveShot} />
              {/* Adding is only offered off the last shot (#593). */}
              {isLastSelected && (
                <Secondary
                  label="Add shot"
                  a11y="Add another shot"
                  icon={<Icon.plus size={18} />}
                  onPress={handleStartAddShot}
                />
              )}
              <Primary
                label={`Edit shot ${activePos + 1}`}
                a11y="Edit this shot's details"
                disabled={!active?.id}
                onPress={() => active?.id && onEditShot(active.id)}
              />
            </ButtonRow>
          </>
        )}
      </PastFooter>

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

function splitDisplay(text: string): { value: string; unit: string } {
  const [value = '', unit = ''] = text.split(' ')
  return { value, unit }
}
