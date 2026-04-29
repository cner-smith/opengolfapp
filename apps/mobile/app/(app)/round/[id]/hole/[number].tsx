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
import { HoleMap, type LatLng } from '../../../../../components/round/HoleMap'
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

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type RoundRow = Database['public']['Tables']['rounds']['Row']

const FALLBACK_CENTER: LatLng = { lat: 40.0, lng: -75.0 }

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

  const currentHole = useMemo(
    () => holes.find((h) => h.number === holeNumber) ?? null,
    [holes, holeNumber],
  )
  const currentHoleScore = useMemo(
    () => holeScores.find((hs) => hs.hole_id === currentHole?.id) ?? null,
    [holeScores, currentHole?.id],
  )

  const center: LatLng = useMemo(() => {
    if (currentHole?.pin_lat != null && currentHole.pin_lng != null) {
      return { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
    }
    if (currentHole?.tee_lat != null && currentHole.tee_lng != null) {
      return { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
    }
    if (ball) return ball
    return FALLBACK_CENTER
  }, [currentHole, ball])

  const pin: LatLng | null =
    currentHole?.pin_lat != null && currentHole.pin_lng != null
      ? { lat: currentHole.pin_lat, lng: currentHole.pin_lng }
      : null
  const tee: LatLng | null =
    currentHole?.tee_lat != null && currentHole.tee_lng != null
      ? { lat: currentHole.tee_lat, lng: currentHole.tee_lng }
      : null

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

  // Auto-place ball at current GPS position once per hole.
  useEffect(() => {
    if (ball || !currentHole) return
    let active = true
    ;(async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync()
        if (perm.status !== 'granted') return
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        })
        if (!active) return
        setBall({ lat: loc.coords.latitude, lng: loc.coords.longitude })
      } catch {
        // GPS not available — user will tap to place.
      }
    })()
    return () => {
      active = false
    }
  }, [currentHole?.id])

  const shotNumber = remoteShotCount + localShotCount + 1
  const isPutt = currentHole?.par !== undefined && shotNumber > 0 // refined per logger

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
      lie_slope: meta?.lieSlope ?? null,
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
      <View className="flex-1 items-center justify-center bg-fairway-50">
        <ActivityIndicator />
      </View>
    )
  }
  if (error || !round || !currentHole || !currentHoleScore) {
    return (
      <View className="flex-1 items-center justify-center bg-fairway-50 p-4">
        <Text className="text-red-700">
          {error ?? `Hole ${holeNumber} not found for this round.`}
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-fairway-50">
      <View className="flex-row items-center justify-between bg-white px-4 py-2">
        <Pressable onPress={() => router.replace('/(app)')}>
          <Text className="text-sm text-fairway-700">← Home</Text>
        </Pressable>
        <Text className="font-semibold text-fairway-900">
          Hole {holeNumber} · Par {currentHole.par}
          {currentHole.yards ? ` · ${currentHole.yards} yd` : ''}
        </Text>
        <Text className="text-xs text-gray-500">Shot #{shotNumber}</Text>
      </View>

      <View className="flex-1">
        <HoleMap
          center={center}
          pin={pin}
          tee={tee}
          aim={aim}
          ball={ball}
          onSetAim={setAim}
          onSetBall={setBall}
        />
      </View>

      <View className="bg-white px-4 py-3">
        <View className="mb-3 flex-row gap-2">
          <Pressable
            onPress={openLogger}
            disabled={!ball || saving}
            className={
              ball
                ? 'flex-1 items-center rounded bg-fairway-500 py-3'
                : 'flex-1 items-center rounded bg-gray-200 py-3'
            }
          >
            <Text
              className={ball ? 'font-semibold text-white' : 'text-sm text-gray-500'}
            >
              {saving ? 'Saving…' : ball ? 'Save shot' : 'Place ball to save'}
            </Text>
          </Pressable>
        </View>
        <View className="flex-row justify-between">
          <Pressable
            onPress={() => navigateHole(-1)}
            disabled={holeNumber === 1}
            className="rounded border border-gray-200 px-4 py-2"
          >
            <Text className="text-sm">← Prev</Text>
          </Pressable>
          <ScorecardPreview
            holes={holes}
            holeScores={holeScores}
            currentHoleNumber={holeNumber}
          />
          <Pressable
            onPress={() => navigateHole(1)}
            disabled={holeNumber === 18}
            className="rounded border border-gray-200 px-4 py-2"
          >
            <Text className="text-sm">Next →</Text>
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
  const totalScore = holeScores.reduce((s, hs) => s + (hs.score || 0), 0)
  const totalPar = holes.reduce((s, h) => s + h.par, 0)
  const diff = totalScore - totalPar
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View className="flex-row items-center" style={{ gap: 4 }}>
        {holes.map((h) => {
          const hs = scoresByHoleId.get(h.id)
          const active = h.number === currentHoleNumber
          return (
            <View
              key={h.id}
              className={
                active
                  ? 'h-8 w-8 items-center justify-center rounded bg-fairway-500'
                  : 'h-8 w-8 items-center justify-center rounded bg-fairway-100'
              }
            >
              <Text
                className={
                  active ? 'text-xs font-bold text-white' : 'text-xs text-fairway-900'
                }
              >
                {hs && hs.score ? hs.score : h.number}
              </Text>
            </View>
          )
        })}
        <View className="ml-2">
          <Text className="text-xs text-gray-500">
            {totalScore || '—'} {diff !== 0 && diff !== -totalPar ? `(${diff > 0 ? '+' : ''}${diff})` : ''}
          </Text>
        </View>
      </View>
    </ScrollView>
  )
}
