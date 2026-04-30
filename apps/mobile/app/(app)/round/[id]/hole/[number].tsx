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
  type HoleMapMode,
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
  type ShotPayload,
} from '../../../../../lib/db'
import { syncPendingShots } from '../../../../../lib/sync'
import { distanceYards } from '../../../../../lib/maps'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']

const FALLBACK_CENTER: LatLng = { lat: 40.0, lng: -75.0 }
const PIN_PROMPT_RADIUS_YARDS = 80

const KICKER: import('react-native').TextStyle = {
  fontSize: 10,
  fontWeight: '600',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function HoleScreen() {
  const { id, number } = useLocalSearchParams<{ id: string; number: string }>()
  const holeNumber = Number(number)
  const router = useRouter()
  const { user } = useAuth()

  const [round, setRound] = useState<RoundRow | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [aim, setAim] = useState<LatLng | null>(null)
  const [ball, setBall] = useState<LatLng | null>(null)
  const lastEndRef = useRef<LatLng | null>(null)
  const [remoteShotCount, setRemoteShotCount] = useState(0)
  const [localShotCount, setLocalShotCount] = useState(0)
  const [loggerOpen, setLoggerOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [mapMode, setMapMode] = useState<HoleMapMode>('shot')
  const [gpsPosition, setGpsPosition] = useState<LatLng | null>(null)

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

  const center: LatLng = useMemo(() => {
    if (roundPin) return roundPin
    if (storedPin) return storedPin
    if (tee) return tee
    if (ball) return ball
    return FALLBACK_CENTER
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundPin?.lat, roundPin?.lng, storedPin?.lat, storedPin?.lng, tee?.lat, tee?.lng, ball])

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

  // Reload remote + local shot counts whenever the active hole_score changes.
  useEffect(() => {
    if (!currentHoleScore) return
    let active = true
    ;(async () => {
      const { count } = await supabase
        .from('shots')
        .select('id', { count: 'exact', head: true })
        .eq('hole_score_id', currentHoleScore.id)
      const local = await pendingShotsForHoleScore(currentHoleScore.id)
      if (!active) return
      setRemoteShotCount(count ?? 0)
      setLocalShotCount(local.length)
      lastEndRef.current = null
    })()
    return () => {
      active = false
    }
  }, [currentHoleScore?.id])

  // Auto-place ball at current GPS position once per hole. Also keep
  // gpsPosition fresh so we can detect when the player walks onto the green.
  useEffect(() => {
    if (!currentHole) return
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
        if (!ball) setBall(pos)
      } catch {
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentHole?.id])

  // Highlight "On the green" once the player is within 80 yd of the stored
  // pin AND a per-round pin hasn't been captured yet.
  const nearPin = useMemo(() => {
    if (roundPin) return false
    if (!storedPin || !gpsPosition) return false
    return distanceYards(gpsPosition, storedPin) <= PIN_PROMPT_RADIUS_YARDS
  }, [roundPin, storedPin, gpsPosition])

  const shotNumber = remoteShotCount + localShotCount + 1

  function buildPayload(meta: ShotLoggerValue | null): ShotPayload | null {
    if (!user || !currentHoleScore) return null
    const start = lastEndRef.current ?? tee ?? null
    return {
      hole_score_id: currentHoleScore.id,
      user_id: user.id,
      shot_number: shotNumber,
      start_lat: start?.lat ?? null,
      start_lng: start?.lng ?? null,
      end_lat: ball?.lat ?? null,
      end_lng: ball?.lng ?? null,
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
      putt_result: meta?.puttResult ?? null,
      notes: meta?.notes ?? null,
    }
  }

  async function persistShot(meta: ShotLoggerValue | null) {
    const payload = buildPayload(meta)
    if (!payload) return
    setSaving(true)
    try {
      await insertPendingShot(payload)
      lastEndRef.current = ball
      setLocalShotCount((c) => c + 1)
      setAim(null)
      setBall(null)
      setLoggerOpen(false)
      // Background sync — don't await.
      syncPendingShots().catch(() => undefined)
      // Best-effort score update so the scorecard reflects shot count.
      supabase
        .from('hole_scores')
        .update({ score: shotNumber })
        .eq('id', payload.hole_score_id)
        .then(() => undefined, () => undefined)
    } catch (err) {
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
    setMapMode('shot')
    const { error: updateErr } = await supabase
      .from('hole_scores')
      .update({ pin_lat: loc.lat, pin_lng: loc.lng })
      .eq('id', currentHoleScore.id)
    if (updateErr) {
      Alert.alert('Pin save failed', updateErr.message)
    }
  }

  function openLogger() {
    if (!ball) {
      Alert.alert('Place the ball first', 'Tap the map to drop the ball.')
      return
    }
    setLoggerOpen(true)
  }

  function navigateHole(delta: number) {
    const next = holeNumber + delta
    if (next < 1 || next > 18) return
    router.replace(`/(app)/round/${id}/hole/${next}`)
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
        <Pressable onPress={() => router.replace('/(app)')}>
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
            {currentHole.yards ? ` · ${currentHole.yards} yd` : ''}
          </Text>
        </View>
        <Text
          style={{
            ...KICKER,
            color: 'rgba(242,238,229,0.6)',
            fontVariant: ['tabular-nums'],
          }}
        >
          Shot {shotNumber}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <HoleMap
          center={center}
          pin={storedPin}
          roundPin={roundPin}
          tee={tee}
          aim={aim}
          ball={ball}
          mode={mapMode}
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
        {mapMode === 'pin' ? (
          <Pressable
            onPress={() => setMapMode('shot')}
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
        ) : (
          <>
            <Pressable
              onPress={openLogger}
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
                    ? 'Save shot →'
                    : 'Place ball to save'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setMapMode('pin')}
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
        onSave={(v) => persistShot(v)}
        onSkip={() => persistShot(null)}
        onClose={() => setLoggerOpen(false)}
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
