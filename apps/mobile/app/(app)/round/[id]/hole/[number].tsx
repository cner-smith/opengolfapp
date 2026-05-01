import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
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
import { combinedPuttResult } from '@oga/core'
import { deleteRound } from '@oga/supabase'
import { ConfirmDialog } from '../../../../../components/ui/ConfirmDialog'
import { useUnits } from '../../../../../hooks/useUnits'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']

const FALLBACK_CENTER: LatLng = { lat: 40.0, lng: -75.0 }
const PIN_PROMPT_RADIUS_YARDS = 80

// Live-round state machine. Each shot loops through:
//   PLACE_BALL → SET_AIM → SHOT_DETAIL → PLACE_BALL
// PLACE_BALL: GPS auto-places ball, player drags to refine, confirms with
//   "Mark ball here →".
// SET_AIM: camera rotates so play direction is up; long-press drops aim.
// SHOT_DETAIL: ShotLogger sheet open; save returns to PLACE_BALL.
type RoundState = 'PLACE_BALL' | 'SET_AIM' | 'SHOT_DETAIL'

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
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [aim, setAim] = useState<LatLng | null>(null)
  const [ball, setBall] = useState<LatLng | null>(null)
  // local_id of the just-saved pending shot, so the next PLACE_BALL
  // can fill in that shot's end_lat/end_lng with the new ball position.
  const lastSavedShotLocalIdRef = useRef<number | null>(null)
  const [remoteShotCount, setRemoteShotCount] = useState(0)
  const [remotePuttCount, setRemotePuttCount] = useState(0)
  // Single source of truth for unsynced shots on this hole. Local counts
  // are derived via useMemo so an optimistic save and a slow re-load can't
  // disagree about how many shots / putts the user has logged.
  const [pendingForHole, setPendingForHole] = useState<PendingShot[]>([])
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
  const center: LatLng = useMemo(() => {
    if (tee) return tee
    if (ball) return ball
    return FALLBACK_CENTER
  }, [tee?.lat, tee?.lng, ball?.lat, ball?.lng])

  const loadAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const { data: r, error: rErr } = await supabase
        .from('rounds')
        .select('*')
        .eq('id', id)
        .single()
      if (rErr || !r) throw rErr ?? new Error('Round not found')
      setRound(r)

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
  useEffect(() => {
    if (!currentHoleScore) return
    let active = true
    ;(async () => {
      const [shotRes, puttRes, local] = await Promise.all([
        supabase
          .from('shots')
          .select('id', { count: 'exact', head: true })
          .eq('hole_score_id', currentHoleScore.id),
        supabase
          .from('shots')
          .select('id', { count: 'exact', head: true })
          .eq('hole_score_id', currentHoleScore.id)
          .or('club.eq.putter,lie_type.eq.green'),
        pendingShotsForHoleScore(currentHoleScore.id),
      ])
      if (!active) return
      setRemoteShotCount(shotRes.count ?? 0)
      setRemotePuttCount(puttRes.count ?? 0)
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

  // Auto-place ball at current GPS position once per hole. Also keep
  // gpsPosition fresh so we can detect when the player walks onto the green.
  // Skipped in past-round mode since the player isn't on the course.
  // Functional setBall preserves any manual placement (prev wins) without
  // needing `ball` in deps — which would re-fire the GPS request mid-hole.
  useEffect(() => {
    if (!currentHole) return
    if (isPastMode) return
    let active = true
    ;(async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync()
        if (perm.status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        if (!active) return
        const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude }
        setGpsPosition(pos)
        setBall((prev) => prev ?? pos)
      } catch {
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
    }
  }, [currentHole?.id, isPastMode])

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
      setBall(null)
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
      // Re-acquire GPS so the next PLACE_BALL frames the player's new
      // position. Skipped in past-round mode where GPS is meaningless.
      if (!isPastMode) {
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
          .then((loc) => {
            const pos = { lat: loc.coords.latitude, lng: loc.coords.longitude }
            setGpsPosition(pos)
            setBall(pos)
          })
          .catch(() => undefined)
      }
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

  async function markBallHere() {
    if (!ball) {
      Alert.alert('Place the ball first', 'Tap the map to drop the ball.')
      return
    }
    // Fill in the previous shot's landing — this position is where it
    // ended. Pending rows get patched in SQLite; synced rows get a
    // best-effort remote update.
    const prevLocalId = lastSavedShotLocalIdRef.current
    if (prevLocalId != null) {
      const ballSnapshot = ball
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
    setAim(null)
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

  function navigateHole(delta: number) {
    const next = holeNumber + delta
    if (next < 1 || next > 18) return
    router.replace(`/(app)/round/${id}/hole/${next}`)
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
          onPress={() => router.replace('/(app)')}
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
        <Pressable
          onPress={() => setConfirmDelete(true)}
          accessibilityLabel="Delete round"
          style={{ paddingHorizontal: 4 }}
        >
          <Text
            style={{
              ...KICKER,
              color: 'rgba(163,58,42,0.85)',
            }}
          >
            Delete · Shot {shotNumber}
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          aim={aim}
          ball={ball}
          phase={
            pinPlacementOpen
              ? 'PIN'
              : roundState === 'SET_AIM'
                ? 'SET_AIM'
                : 'PLACE_BALL'
          }
          onSetAim={setAim}
          onSetBall={setBall}
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
          <Pressable
            onPress={() => setPinPlacementOpen(false)}
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 10,
              borderRadius: 2,
            }}
          >
            <Text
              style={{
                color: '#1F3D2C',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              Cancel pin placement
            </Text>
          </Pressable>
        ) : roundState === 'SET_AIM' ? (
          <>
            <Pressable
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
                onPress={() => setRoundState('PLACE_BALL')}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ padding: 6 }}
              >
                <Text style={{ ...KICKER, color: '#8A8B7E' }}>← Re-place ball</Text>
              </Pressable>
              <Pressable
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
          <View style={{ flex: 1 }}>
            <ScorecardPreview
              holes={holes}
              holeScores={holeScores}
              currentHoleNumber={holeNumber}
            />
          </View>
          <Pressable
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
    </View>
  )
}

function ScorecardPreview({
  holes,
  holeScores,
  currentHoleNumber,
}: {
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  currentHoleNumber: number
}) {
  const scoresByHoleId = new Map(holeScores.map((hs) => [hs.hole_id, hs]))
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {holes.map((h) => {
          const hs = scoresByHoleId.get(h.id)
          const active = h.number === currentHoleNumber
          return (
            <View
              key={h.id}
              style={{
                width: 26,
                height: 26,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 2,
                backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '500',
                  color: active ? '#F2EEE5' : '#5C6356',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {hs && hs.score ? hs.score : h.number}
              </Text>
            </View>
          )
        })}
      </View>
    </ScrollView>
  )
}
