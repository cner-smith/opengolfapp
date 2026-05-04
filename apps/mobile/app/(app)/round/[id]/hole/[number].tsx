import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import type { Database } from '@oga/supabase'
import {
  HoleMap,
  type HoleMapPhase,
  type LatLng,
} from '../../../../../components/round/HoleMap'
import {
  ShotLogger,
  type ShotLoggerValue,
} from '../../../../../components/round/ShotLogger'
import {
  PuttingSheet,
  type PuttingValue,
} from '../../../../../components/round/PuttingSheet'
import {
  ScorecardModal,
  ScorecardPreview,
} from '../../../../../components/round/Scorecard'
import { supabase } from '../../../../../lib/supabase'
import { useAuth } from '../../../../../hooks/useAuth'
import {
  insertPendingShot,
  pendingShotsForHoleScore,
  setPendingShotEnd,
  type PendingShot,
  type ShotPayload,
} from '../../../../../lib/db'
import { syncPendingShots } from '../../../../../lib/sync'
import { distanceYards } from '../../../../../lib/maps'
import {
  combinedPuttResult,
  createKalmanState,
  updateKalman,
  type KalmanState,
} from '@oga/core'
import { deleteRound, getProfile } from '@oga/supabase'
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog'
import { useUnits } from '../../../../../hooks/useUnits'
import { completeRound } from '../../../../../lib/completeRound'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']

const FALLBACK_CENTER: LatLng = { lat: 40.0, lng: -75.0 }
const PIN_PROMPT_RADIUS_YARDS = 80

// Live-round state machine. Each shot loops through:
//   PLACE_BALL → SET_AIM → SHOT_DETAIL → PLACE_BALL    (off the green)
//   PLACE_BALL → PUTTING → PLACE_BALL                  (within ~30 yd of pin)
// PLACE_BALL: GPS auto-places ball, player drags to refine, confirms with
//   "Mark ball here →".
// SET_AIM: camera rotates so play direction is up; long-press drops aim.
// SHOT_DETAIL: ShotLogger sheet open; save returns to PLACE_BALL.
// PUTTING: PuttingSheet open with green diagram; save returns to PLACE_BALL
//   (player loops here for each successive putt).
type RoundState = 'PLACE_BALL' | 'SET_AIM' | 'SHOT_DETAIL' | 'PUTTING'

// Distance threshold where the workflow auto-switches to putting.
// 30 yards lines up with the SG "around-green" boundary; once a player
// is inside that radius they're on or chipping near the green and the
// putting flow is more likely than the aim-line flow.
const PUTTING_RADIUS_YARDS = 30

const KICKER: import('react-native').TextStyle = {
  fontSize: 10,
  fontWeight: '600',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function HoleScreen() {
  const { id, number, mode } = useLocalSearchParams<{
    id: string
    number: string
    mode?: string
  }>()
  const holeNumber = Number(number)
  // 'past' means the player is logging after the fact — GPS would just
  // put the ball wherever they happen to be sitting, so skip the
  // auto-place + nearPin prompt and let them tap markers manually.
  const isPastMode = mode === 'past'
  const router = useRouter()
  const { user } = useAuth()
  const { toDisplay } = useUnits()

  const [round, setRound] = useState<RoundRow | null>(null)
  const [courseCenter, setCourseCenter] = useState<LatLng | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [aim, setAim] = useState<LatLng | null>(null)
  const [ball, setBall] = useState<LatLng | null>(null)
  // Kalman filter state for live GPS smoothing during PLACE_BALL. Held
  // in a ref because every position update would otherwise re-render
  // the entire screen at GPS cadence (1-2 Hz). Reset on hole change,
  // manual drag, or when leaving PLACE_BALL — see useEffect below.
  const kalmanStateRef = useRef<KalmanState | null>(null)
  // Set true the moment the player manually drags or taps the ball;
  // freezes the GPS callback's setBall so the next reading can't
  // clobber the manual placement. Cleared on hole change and on
  // PLACE_BALL phase exit (so the next shot's PLACE_BALL re-engages
  // GPS auto-tracking).
  const manuallyPlacedRef = useRef(false)
  // local_id of the just-saved pending shot, so the next PLACE_BALL
  // can fill in that shot's end_lat/end_lng with the new ball position.
  const lastSavedShotLocalIdRef = useRef<number | null>(null)
  const [remoteShotCount, setRemoteShotCount] = useState(0)
  const [remotePuttCount, setRemotePuttCount] = useState(0)
  // Single source of truth for unsynced shots on this hole. Local counts
  // are derived via useMemo so an optimistic save and a slow re-load can't
  // disagree about how many shots / putts the user has logged.
  const [pendingForHole, setPendingForHole] = useState<PendingShot[]>([])
  // Synced shot start positions for this hole. Combined with pending
  // shot starts to render the breadcrumb of waypoints on the map.
  const [remoteShotStarts, setRemoteShotStarts] = useState<LatLng[]>([])
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // Pin placement is orthogonal to the shot phase machine. When true,
  // tapping the map writes today's flag position rather than driving
  // the shot flow.
  const [pinPlacementOpen, setPinPlacementOpen] = useState(false)
  const [roundState, setRoundState] = useState<RoundState>('PLACE_BALL')
  const [gpsPosition, setGpsPosition] = useState<LatLng | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [scorecardOpen, setScorecardOpen] = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [ending, setEnding] = useState(false)

  const currentHole = useMemo(
    () => holes.find((h) => h.number === holeNumber) ?? null,
    [holes, holeNumber],
  )
  const currentHoleScore = useMemo(
    () => holeScores.find((hs) => hs.hole_id === currentHole?.id) ?? null,
    [holeScores, currentHole?.id],
  )

  const storedPin: LatLng | null =
    currentHole?.pin_lat != null && currentHole.pin_lng != null
      ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
      : null
  const roundPin: LatLng | null =
    currentHoleScore?.pin_lat != null && currentHoleScore.pin_lng != null
      ? { lat: currentHoleScore.pin_lat, lng: currentHoleScore.pin_lng }
      : null
  const tee: LatLng | null =
    currentHole?.tee_lat != null && currentHole.tee_lng != null
      ? { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
      : null

  // Camera anchors on the tee box — the player's starting point. Pin/green
  // is intentionally NOT a fallback; it would mis-frame the hole every time.
  // Course centroid is the next-best landing if no per-hole layout exists,
  // and the hard-coded US-center FALLBACK_CENTER is the absolute last
  // resort (course rows missing lat/lng entirely).
  const center: LatLng = useMemo(() => {
    if (tee) return tee
    if (ball) return ball
    if (courseCenter) return courseCenter
    return FALLBACK_CENTER
  }, [tee?.lat, tee?.lng, ball?.lat, ball?.lng, courseCenter?.lat, courseCenter?.lng])

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      // Joining course lat/lng so HoleMap has a fallback camera target
      // when this hole has no tee/pin coords (most courses pre-OSM
      // import). Without it the map flew to FALLBACK_CENTER (US
      // middle), which felt broken.
      const { data: r, error: rErr } = await supabase
        .from('rounds')
        .select('*, courses(lat, lng)')
        .eq('id', id)
        .single()
      if (rErr || !r) throw rErr ?? new Error('Round not found')
      setRound(r)
      setCourseCenter(
        r.courses && r.courses.lat != null && r.courses.lng != null
          ? { lat: r.courses.lat, lng: r.courses.lng }
          : null,
      )

      const [hRes, hsRes] = await Promise.all([
        supabase.from('holes').select('*').eq('course_id', r.course_id).order('number'),
        supabase.from('hole_scores').select('*').eq('round_id', r.id),
      ])
      if (hRes.error) throw hRes.error
      if (hsRes.error) throw hsRes.error
      setHoles(hRes.data ?? [])
      setHoleScores(hsRes.data ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Reload remote + local shot/putt counts whenever the active hole_score
  // changes. Putts are counted as shots where club='putter' OR lie_type='green'.
  // Also pulls remote shot start coords so the on-map waypoint breadcrumb
  // survives a screen reload mid-hole.
  useEffect(() => {
    if (!currentHoleScore) return
    let active = true
    ;(async () => {
      // Single fetch covers shot count, putt count, and start coords —
      // putts are derivable from (club, lie_type) so the two count
      // queries collapse into one round trip.
      const [shotsRes, local] = await Promise.all([
        supabase
          .from('shots')
          .select('club, lie_type, shot_number, start_lat, start_lng')
          .eq('hole_score_id', currentHoleScore.id)
          .order('shot_number'),
        pendingShotsForHoleScore(currentHoleScore.id),
      ])
      if (!active) return
      const shots = shotsRes.data ?? []
      setRemoteShotCount(shots.length)
      setRemotePuttCount(
        shots.filter((s) => s.club === 'putter' || s.lie_type === 'green').length,
      )
      const starts: LatLng[] = []
      for (const r of shots) {
        if (r.start_lat != null && r.start_lng != null) {
          starts.push({ lat: r.start_lat, lng: r.start_lng })
        }
      }
      setRemoteShotStarts(starts)
      setPendingForHole(local)
    })()
    return () => {
      active = false
    }
  }, [currentHoleScore?.id])

  // Reset the just-saved-shot ref synchronously on hole transition. Keeping
  // it inside the async count-load effect (above) created a race: a tap-to-
  // mark-ball that set the ref could be wiped out when the (slower) count
  // load resolved a moment later, leaving shot N's end_lat/end_lng unset.
  useEffect(() => {
    lastSavedShotLocalIdRef.current = null
  }, [currentHoleScore?.id])

  // Live GPS during the PLACE_BALL phase so the ball marker tracks the
  // player as they walk between shots. Raw phone GPS is ±3-10 m which
  // can corrupt SG by 6-20 yd at golf scale, so the readings are run
  // through a Kalman filter (issue #123) before driving the ball.
  //
  // Subscription is torn down once the player taps "Mark ball here" and
  // we leave PLACE_BALL — no need to keep the GPS radio active during
  // SET_AIM / SHOT_DETAIL. Skipped entirely in past-round mode.
  //
  // Filter ref is reset whenever the hole changes, the user manually
  // drags the ball, or PLACE_BALL exits — each is a context switch
  // where the prior filter state shouldn't carry over.
  useEffect(() => {
    if (!currentHole) return
    if (isPastMode) return
    if (roundState !== 'PLACE_BALL') return
    let active = true
    let subscription: Location.LocationSubscription | null = null
    ;(async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync()
        if (perm.status !== 'granted') return
        if (!active) return
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 2,
          },
          (loc) => {
            // Manual placement freezes GPS-driven ball updates. Without
            // this, the next reading after a drag would re-init the
            // filter at the raw GPS point and snap ball back, wiping
            // the player's refinement.
            if (manuallyPlacedRef.current) return
            const rawPoint = {
              lat: loc.coords.latitude,
              lng: loc.coords.longitude,
              accuracy: loc.coords.accuracy ?? undefined,
              timestamp: loc.timestamp,
            }
            kalmanStateRef.current = kalmanStateRef.current
              ? updateKalman(kalmanStateRef.current, rawPoint)
              : createKalmanState(rawPoint)
            const smoothed = {
              lat: kalmanStateRef.current.lat,
              lng: kalmanStateRef.current.lng,
            }
            setGpsPosition(smoothed)
            setBall(smoothed)
          },
        )
      } catch {
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
      subscription?.remove()
      // Phase exit clears the filter so re-entry to PLACE_BALL on the
      // next shot starts smoothing from a fresh fix rather than an
      // old anchor that may now be hundreds of yards away. Also clears
      // the manual-placement freeze so the next PLACE_BALL cycle
      // resumes GPS auto-tracking unless the player drags again.
      kalmanStateRef.current = null
      manuallyPlacedRef.current = false
    }
  }, [currentHole?.id, isPastMode, roundState])

  // Hole change resets the filter — covered by the watch effect's
  // cleanup, but explicit here in case the watch effect short-circuits
  // (past mode, or no current hole) before subscribing.
  useEffect(() => {
    kalmanStateRef.current = null
    manuallyPlacedRef.current = false
  }, [currentHole?.id])

  // Highlight "On the green" once the player is within 80 yd of the stored
  // pin AND a per-round pin hasn't been captured yet.
  const nearPin = useMemo(() => {
    if (roundPin) return false
    if (!storedPin || !gpsPosition) return false
    return distanceYards(gpsPosition, storedPin) <= PIN_PROMPT_RADIUS_YARDS
  }, [roundPin, storedPin, gpsPosition])

  // Derive local shot/putt counts from the pending array — single source
  // of truth, never out of sync with the underlying queue. Putts are
  // counted as shots where club='putter' OR lie_type='green'.
  const localShotCount = pendingForHole.length

  // Shot waypoints rendered on the map: synced shot starts followed by
  // pending shot starts (in pending insertion order). The current ball
  // is intentionally excluded — HoleMap appends it as the line's final
  // segment so the ball can move while the breadcrumb stays.
  const previousShots = useMemo(() => {
    const out: LatLng[] = [...remoteShotStarts]
    for (const r of pendingForHole) {
      try {
        const p = JSON.parse(r.payload) as ShotPayload
        if (p.start_lat != null && p.start_lng != null) {
          out.push({ lat: p.start_lat, lng: p.start_lng })
        }
      } catch {
        // skip malformed pending payload
      }
    }
    return out
  }, [remoteShotStarts, pendingForHole])

  const localPuttCount = useMemo(() => {
    let n = 0
    for (const r of pendingForHole) {
      try {
        const p = JSON.parse(r.payload) as ShotPayload
        if (p.club === 'putter' || p.lie_type === 'green') n++
      } catch {
        // skip malformed pending payload
      }
    }
    return n
  }, [pendingForHole])
  const shotNumber = remoteShotCount + localShotCount + 1

  function buildPayload(meta: ShotLoggerValue | null): ShotPayload | null {
    if (!user || !currentHoleScore || !ball) return null
    // New live-round semantics: ball is the player's current position
    // (the start of this shot). end_lat/lng is unknown until the next
    // PLACE_BALL — the next ball mark fills in this shot's landing.
    return {
      hole_score_id: currentHoleScore.id,
      user_id: user.id,
      shot_number: shotNumber,
      start_lat: ball.lat,
      start_lng: ball.lng,
      end_lat: null,
      end_lng: null,
      aim_lat: aim?.lat ?? null,
      aim_lng: aim?.lng ?? null,
      club: meta?.club ?? null,
      lie_type: meta?.lieType ?? null,
      lie_slope: null,
      lie_slope_forward: meta?.lieSlopeForward ?? null,
      lie_slope_side: meta?.lieSlopeSide ?? null,
      shot_result: meta?.shotResult ?? null,
      penalty: meta?.shotResult === 'penalty',
      ob: meta?.shotResult === 'ob',
      putt_distance_ft: meta?.puttDistanceFt ?? null,
      putt_result: combinedPuttResult({
        made: meta?.puttMade,
        distance: meta?.puttDistanceResult ?? null,
        direction: meta?.puttDirectionResult ?? null,
      }),
      putt_distance_result: meta?.puttMade
        ? null
        : meta?.puttDistanceResult ?? null,
      putt_direction_result: meta?.puttMade
        ? null
        : meta?.puttDirectionResult ?? null,
      putt_slope_pct: meta?.puttSlopePct ?? null,
      green_speed: meta?.greenSpeed ?? null,
      break_direction: meta?.breakDirection ?? null,
      aim_offset_yards:
        meta?.aimOffsetInches != null
          ? Math.round((meta.aimOffsetInches / 36) * 10) / 10
          : null,
      notes: meta?.notes ?? null,
    }
  }

  async function persistShot(meta: ShotLoggerValue | null) {
    const payload = buildPayload(meta)
    if (!payload) return
    setSaving(true)
    try {
      const localId = await insertPendingShot(payload)
      lastSavedShotLocalIdRef.current = localId
      const isPutt = payload.club === 'putter' || payload.lie_type === 'green'
      // Append to the pending queue — counts derive from this so they can't
      // drift. Status starts 'pending' until syncPendingShots flips it.
      // The breadcrumb derives previousShots from pendingForHole +
      // remoteShotStarts (see useMemo above). Pending stays here until
      // hole change refetches; remote starts refresh on next mount, so
      // there's no double-count and no need to push optimistically.
      setPendingForHole((prev) => [
        ...prev,
        {
          local_id: localId,
          remote_id: null,
          status: 'pending',
          payload: JSON.stringify(payload),
          created_at: Date.now(),
        },
      ])
      setAim(null)
      // Leave ball at the just-hit shot's start position. The next shot
      // is hit from somewhere downrange; the player drags the ball to
      // refine. The previous behaviour of clearing the ball + reading a
      // fresh GPS fix snapped the marker to the player's current device
      // location — which on test builds (or anywhere far from where the
      // ball actually lies) jumped the marker miles off the course.
      setLoggerOpen(false)
      setRoundState('PLACE_BALL')
      // Background sync — don't await.
      syncPendingShots().catch(() => undefined)
      // Best-effort hole_score update so the scorecard reflects shot/putt
      // count. shotNumber is the just-saved shot's number == new score.
      const newPutts =
        remotePuttCount + localPuttCount + (isPutt ? 1 : 0)
      supabase
        .from('hole_scores')
        .update({ score: shotNumber, putts: newPutts })
        .eq('id', payload.hole_score_id)
        .then(({ error }) => {
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[hole/score-update]', error.message)
          }
        })
      // Reflect optimistically in the inline scorecard preview.
      setHoleScores((prev) =>
        prev.map((hs) =>
          hs.id === payload.hole_score_id
            ? { ...hs, score: shotNumber, putts: newPutts }
            : hs,
        ),
      )
      // Intentionally do NOT snap ball to a fresh GPS reading here.
      // The watchPosition effect re-engages on phase return to
      // PLACE_BALL, restarts the Kalman filter from the next reading,
      // and resumes ball tracking from there.
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('shot save failed', err, payload)
      Alert.alert('Save failed', (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function persistRoundPin(loc: LatLng) {
    if (!currentHoleScore) return
    // Reject tap events that gave us non-finite coords — defensive
    // guard so we never write null pin_lat by mistake (the original
    // bug looked like "pin disappeared on tap" and likely traced to a
    // malformed Mapbox tap feature on the device).
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return
    // Optimistic update so the marker appears immediately.
    setHoleScores((prev) =>
      prev.map((hs) =>
        hs.id === currentHoleScore.id
          ? { ...hs, pin_lat: loc.lat, pin_lng: loc.lng }
          : hs,
      ),
    )
    setPinPlacementOpen(false)
    const { error: updateErr } = await supabase
      .from('hole_scores')
      .update({ pin_lat: loc.lat, pin_lng: loc.lng })
      .eq('id', currentHoleScore.id)
    if (updateErr) {
      Alert.alert('Pin save failed', updateErr.message)
    }
  }

  // Explicit "clear today's flag" action. The Cancel button in PIN
  // mode used to just exit the mode without doing anything to the pin;
  // device testing showed players wanted Cancel to also remove a
  // mistakenly-placed flag. Sets pin_lat/pin_lng to null in the DB and
  // optimistically in state.
  async function clearRoundPin() {
    if (!currentHoleScore) return
    setHoleScores((prev) =>
      prev.map((hs) =>
        hs.id === currentHoleScore.id
          ? { ...hs, pin_lat: null, pin_lng: null }
          : hs,
      ),
    )
    setPinPlacementOpen(false)
    const { error: updateErr } = await supabase
      .from('hole_scores')
      .update({ pin_lat: null, pin_lng: null })
      .eq('id', currentHoleScore.id)
    if (updateErr) {
      Alert.alert('Pin clear failed', updateErr.message)
    }
  }

  async function markBallHere() {
    if (!ball) {
      Alert.alert('Place the ball first', 'Tap the map to drop the ball.')
      return
    }
    // Lock the ball position right now, before any awaits below.
    // A GPS callback firing during the SQLite write could otherwise
    // shift `ball` between the moment the player tapped "Mark" and
    // the moment persistShot reads it for the next shot's
    // start_lat/lng. Same snapshot also drives the previous shot's
    // end_lat/lng patch.
    const ballSnapshot = { lat: ball.lat, lng: ball.lng }
    // Tapping "Mark ball here" is an explicit position commit — same
    // semantics as a manual drag for the purposes of GPS freezing.
    manuallyPlacedRef.current = true
    // Fill in the previous shot's landing — this position is where it
    // ended. Pending rows get patched in SQLite; synced rows get a
    // best-effort remote update.
    const prevLocalId = lastSavedShotLocalIdRef.current
    if (prevLocalId != null) {
      const result = await setPendingShotEnd(
        prevLocalId,
        ballSnapshot.lat,
        ballSnapshot.lng,
      ).catch(() => null)
      if (result?.status === 'synced' && result.remote_id) {
        supabase
          .from('shots')
          .update({ end_lat: ballSnapshot.lat, end_lng: ballSnapshot.lng })
          .eq('id', result.remote_id)
          .then(({ error }) => {
            if (error) {
              // eslint-disable-next-line no-console
              console.warn('[hole/end-coord-patch]', error.message)
            }
          })
      }
      lastSavedShotLocalIdRef.current = null
    }
    // Re-pin ball state to the snapshot so the new shot's start_lat/lng
    // (read from `ball` in persistShot) is the value the player
    // committed to, not anything an in-flight GPS callback wrote.
    setBall(ballSnapshot)
    setAim(null)
    // Auto-switch to the putting flow when the player has marked their
    // position within ~30 yd of the pin — bypasses SET_AIM (long-press
    // line) and SHOT_DETAIL (club/lie/result), since none of those
    // matter on a putt. Falls back to the standard aim flow if no pin
    // is known.
    const pinTarget = roundPin ?? storedPin ?? null
    if (pinTarget && distanceYards(ballSnapshot, pinTarget) <= PUTTING_RADIUS_YARDS) {
      setRoundState('PUTTING')
      return
    }
    setRoundState('SET_AIM')
  }

  function confirmAim() {
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function skipAim() {
    // Pace-of-play escape hatch: log the shot without an explicit aim.
    setAim(null)
    setRoundState('SHOT_DETAIL')
    setLoggerOpen(true)
  }

  function closeLogger() {
    setLoggerOpen(false)
    setRoundState('PLACE_BALL')
  }

  // Map a PuttingValue into the ShotLoggerValue shape persistShot
  // expects, then run the same persistence path. Forces club=putter and
  // lieType=green so downstream stats classify these correctly without
  // requiring the player to pick them out of a chip row.
  async function persistPutt(v: PuttingValue) {
    const meta: ShotLoggerValue = {
      club: 'putter',
      lieType: 'green',
      puttMade: v.puttMade,
      puttDistanceResult: v.puttDistanceResult,
      puttDirectionResult: v.puttDirectionResult,
      puttDistanceFt: v.puttDistanceFt,
      puttSlopePct: v.puttSlopePct,
      greenSpeed: v.greenSpeed,
      breakDirection: v.breakDirection,
      aimOffsetInches: v.aimOffsetInches,
      notes: v.notes,
    }
    await persistShot(meta)
  }

  function closePuttingSheet() {
    setRoundState('PLACE_BALL')
  }

  function navigateHole(delta: number) {
    const next = holeNumber + delta
    if (next < 1 || next > 18) return
    router.replace(`/(app)/round/${id}/hole/${next}`)
  }

  // "Finish hole" advances to the next hole. The hole_score row's
  // score/putts are already updated optimistically each time persistShot
  // runs, so this is just navigation — no extra DB write needed. On hole
  // 18 we jump back to the home screen where the just-completed round
  // appears at the top of the recent-rounds list.
  function finishHole() {
    if (holeNumber < 18) {
      router.replace(`/(app)/round/${id}/hole/${holeNumber + 1}`)
    } else {
      router.replace('/(app)')
    }
  }

  const totalShotsThisHole =
    remoteShotCount + localShotCount > 0 ? remoteShotCount + localShotCount : 0

  async function handleEndRound() {
    if (!round || !user) return
    setEnding(true)
    try {
      const { data: profile } = await getProfile(supabase, user.id)
      const handicap =
        (profile as { handicap_index?: number | null } | null)?.handicap_index ??
        null
      await completeRound({
        roundId: round.id,
        courseId: round.course_id,
        userId: user.id,
        handicap,
      })
      router.replace(`/(app)/round/${round.id}`)
    } catch (err) {
      Alert.alert('End round failed', (err as Error).message)
    } finally {
      setEnding(false)
      setConfirmEnd(false)
    }
  }

  async function handleDeleteRound() {
    if (!round || !user) return
    setDeleting(true)
    try {
      const { error: delErr } = await deleteRound(supabase, round.id, user.id)
      if (delErr) {
        Alert.alert('Delete failed', delErr.message)
        return
      }
      router.replace('/(app)')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
        }}
      >
        <ActivityIndicator color="#1F3D2C" />
      </View>
    )
  }
  if (error || !round || !currentHole || !currentHoleScore) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
          padding: 18,
        }}
      >
        <Text style={{ color: '#A33A2A', fontSize: 13 }}>
          {error ?? `Hole ${holeNumber} not found for this round.`}
        </Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingTop: 52,
          paddingBottom: 14,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave round and return home"
          onPress={() => setConfirmLeave(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6 }}
        >
          <Text
            style={{
              ...KICKER,
              color: 'rgba(242,238,229,0.6)',
            }}
          >
            ← Home
          </Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              ...KICKER,
              color: 'rgba(242,238,229,0.45)',
              marginBottom: 4,
            }}
          >
            Hole {holeNumber}
          </Text>
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 17,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
          >
            Par {currentHole.par}
            {currentHole.yards ? ` · ${toDisplay(currentHole.yards)}` : ''}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmEnd(true)}
            accessibilityLabel="End round early"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={{
                ...KICKER,
                color: 'rgba(242,238,229,0.85)',
              }}
            >
              End · Shot {shotNumber}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setConfirmDelete(true)}
            accessibilityLabel="Delete round"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={{
                ...KICKER,
                color: 'rgba(163,58,42,0.85)',
              }}
            >
              Delete
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          aim={aim}
          ball={ball}
          previousShots={previousShots}
          missingHoleLayout={tee == null && storedPin == null && roundPin == null}
          phase={
            pinPlacementOpen
              ? 'PIN'
              : roundState === 'SET_AIM'
                ? 'SET_AIM'
                : 'PLACE_BALL'
          }
          onSetAim={setAim}
          onSetBall={(loc) => {
            // Manual drag/tap is an explicit override. Freeze GPS
            // updates for this PLACE_BALL cycle and re-anchor the
            // Kalman filter at the manual point with a low variance
            // (1 m²) — strong prior so any future un-freeze still
            // resists snapping back to a noisy raw fix.
            manuallyPlacedRef.current = true
            kalmanStateRef.current = {
              lat: loc.lat,
              lng: loc.lng,
              variance: 1,
            }
            setBall(loc)
          }}
          onPlacePin={persistRoundPin}
        />
      </View>

      <View
        style={{
          backgroundColor: '#FBF8F1',
          paddingHorizontal: 18,
          paddingTop: 14,
          paddingBottom: 14,
          borderTopWidth: 1,
          borderTopColor: '#D9D2BF',
        }}
      >
        {pinPlacementOpen ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel pin placement"
              onPress={() => setPinPlacementOpen(false)}
              style={{
                flex: 1,
                borderWidth: 1,
                borderColor: '#D9D2BF',
                paddingVertical: 14,
                alignItems: 'center',
                borderRadius: 2,
              }}
            >
              <Text
                style={{
                  color: '#5C6356',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                Cancel
              </Text>
            </Pressable>
            {roundPin && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear pin"
                onPress={clearRoundPin}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#A33A2A',
                  paddingVertical: 14,
                  alignItems: 'center',
                  borderRadius: 2,
                }}
              >
                <Text
                  style={{
                    color: '#A33A2A',
                    fontSize: 14,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  }}
                >
                  Clear flag
                </Text>
              </Pressable>
            )}
          </View>
        ) : roundState === 'SET_AIM' ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={aim ? 'Confirm aim point' : 'Long-press the map to set aim point'}
              accessibilityState={{ disabled: !aim }}
              onPress={confirmAim}
              disabled={!aim}
              style={{
                backgroundColor: aim ? '#1F3D2C' : '#EBE5D6',
                borderRadius: 2,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Text
                style={{
                  color: aim ? '#F2EEE5' : '#8A8B7E',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                {aim ? 'Confirm aim →' : 'Long-press the map to aim'}
              </Text>
            </Pressable>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Re-place ball"
                onPress={() => setRoundState('PLACE_BALL')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 6 }}
              >
                <Text style={{ ...KICKER, color: '#8A8B7E' }}>← Re-place ball</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip aim point"
                onPress={skipAim}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 6 }}
              >
                <Text style={{ ...KICKER, color: '#8A8B7E' }}>Skip aim</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ball ? 'Mark ball at current position' : 'Drop the ball on the map first'}
              accessibilityState={{ disabled: !ball || saving }}
              onPress={markBallHere}
              disabled={!ball || saving}
              style={{
                backgroundColor: ball ? '#1F3D2C' : '#EBE5D6',
                borderRadius: 2,
                paddingVertical: 14,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  color: ball ? '#F2EEE5' : '#8A8B7E',
                  fontSize: 14,
                  fontWeight: '600',
                  letterSpacing: 0.3,
                }}
              >
                {saving
                  ? 'Saving…'
                  : ball
                    ? 'Mark ball here →'
                    : 'Drop the ball to mark'}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={roundPin ? 'Move pin' : 'Place pin'}
              onPress={() => setPinPlacementOpen(true)}
              style={{
                paddingVertical: 8,
                alignItems: 'center',
                marginBottom: 10,
              }}
            >
              <Text
                style={{
                  ...KICKER,
                  color: nearPin ? '#A66A1F' : '#8A8B7E',
                }}
              >
                {roundPin
                  ? 'Move pin'
                  : nearPin
                    ? 'On the green — place today\'s pin'
                    : 'On the green'}
              </Text>
            </Pressable>
            {totalShotsThisHole > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={holeNumber < 18 ? 'Finish hole and continue' : 'Finish round'}
                onPress={finishHole}
                style={{
                  borderWidth: 1,
                  borderColor: '#1F3D2C',
                  paddingVertical: 12,
                  alignItems: 'center',
                  marginBottom: 10,
                  borderRadius: 2,
                }}
              >
                <Text
                  style={{
                    color: '#1F3D2C',
                    fontSize: 13,
                    fontWeight: '600',
                    letterSpacing: 0.3,
                  }}
                >
                  {holeNumber < 18 ? `Finish hole · next →` : 'Finish round'}
                </Text>
              </Pressable>
            )}
          </>
        )}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous hole"
            accessibilityState={{ disabled: holeNumber === 1 }}
            onPress={() => navigateHole(-1)}
            disabled={holeNumber === 1}
            style={{
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
              paddingVertical: 6,
              paddingHorizontal: 12,
              opacity: holeNumber === 1 ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 12, color: '#1C211C' }}>← Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setScorecardOpen(true)}
            style={{ flex: 1, alignItems: 'center' }}
            accessibilityLabel="Open scorecard"
          >
            <Text
              style={{
                ...KICKER,
                color: '#5C6356',
                marginBottom: 4,
              }}
            >
              Scorecard ▾
            </Text>
            <ScorecardPreview
              holes={holes}
              holeScores={holeScores}
              currentHoleNumber={holeNumber}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next hole"
            accessibilityState={{ disabled: holeNumber === 18 }}
            onPress={() => navigateHole(1)}
            disabled={holeNumber === 18}
            style={{
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
              paddingVertical: 6,
              paddingHorizontal: 12,
              opacity: holeNumber === 18 ? 0.4 : 1,
            }}
          >
            <Text style={{ fontSize: 12, color: '#1C211C' }}>Next →</Text>
          </Pressable>
        </View>
      </View>

      <ShotLogger
        key={shotNumber}
        visible={loggerOpen}
        shotNumber={shotNumber}
        isPutt={false}
        puttDistanceFt={
          ball
            ? Math.round(distanceYards(ball, roundPin ?? storedPin ?? ball) * 3)
            : undefined
        }
        onSave={(v) => persistShot(v)}
        onSkip={() => persistShot(null)}
        onClose={closeLogger}
      />

      <Modal
        visible={roundState === 'PUTTING'}
        transparent
        animationType="slide"
        onRequestClose={closePuttingSheet}
      >
        {/* React Native's <Modal> renders to a separate native window on
            Android, so the app-root GestureHandlerRootView doesn't apply
            inside. Wrap the modal contents in their own root to restore
            the GreenDiagram aim-handle pan gesture (broke after the
            Reanimated refactor). */}
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <PuttingSheet
              shotNumber={shotNumber}
              initialDistanceFt={
                ball && (roundPin ?? storedPin)
                  ? Math.round(
                      distanceYards(ball, (roundPin ?? storedPin) as LatLng) * 3,
                    )
                  : undefined
              }
              onSave={persistPutt}
              onClose={closePuttingSheet}
            />
          </View>
        </GestureHandlerRootView>
      </Modal>

      <ConfirmDialog
        visible={confirmDelete}
        title="Delete this round?"
        message="Hole scores and shots are removed too. This cannot be undone."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={handleDeleteRound}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmDialog
        visible={confirmLeave}
        title="Leave round?"
        message="Your progress is saved and you can resume from the home screen."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={() => {
          setConfirmLeave(false)
          router.replace('/(app)')
        }}
        onCancel={() => setConfirmLeave(false)}
      />

      <ConfirmDialog
        visible={confirmEnd}
        title={`End round after hole ${holeNumber}?`}
        message={`Your round will be saved with ${totalShotsThisHole > 0 ? holeNumber : holeNumber - 1} hole(s) of detail. SG and totals are computed from what's logged so far.`}
        confirmLabel="End round"
        cancelLabel="Cancel"
        busy={ending}
        onConfirm={handleEndRound}
        onCancel={() => setConfirmEnd(false)}
      />

      <Modal
        visible={scorecardOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setScorecardOpen(false)}
      >
        <ScorecardModal
          holes={holes}
          holeScores={holeScores}
          currentHoleNumber={holeNumber}
          onJumpToHole={(n) => {
            setScorecardOpen(false)
            if (n !== holeNumber) {
              router.replace(`/(app)/round/${id}/hole/${n}`)
            }
          }}
          onChangePar={async (holeId, newPar) => {
            // Optimistic update so the cell reflects the tap immediately.
            // Roll back if the DB write fails so the UI doesn't lie.
            const prev = holes.find((h) => h.id === holeId)?.par ?? 4
            setHoles((cur) =>
              cur.map((h) => (h.id === holeId ? { ...h, par: newPar } : h)),
            )
            const { error: parErr } = await supabase
              .from('holes')
              .update({ par: newPar })
              .eq('id', holeId)
            if (parErr) {
              setHoles((cur) =>
                cur.map((h) => (h.id === holeId ? { ...h, par: prev } : h)),
              )
            }
          }}
          onClose={() => setScorecardOpen(false)}
        />
      </Modal>
    </View>
  )
}

