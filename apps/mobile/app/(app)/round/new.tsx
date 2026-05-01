import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as Location from 'expo-location'
import {
  formatLocation,
  getOpenGolfApiCourse,
  searchOpenGolfApi,
  type OpenGolfApiSearchResult,
} from '@oga/core'
import {
  createCourse,
  createHoles,
  createRound,
  getCourseByExternalId,
  searchCourses,
  upsertCourseTees,
  upsertHoleScore,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'

type CourseRow = Database['public']['Tables']['courses']['Row']
type HoleInsert = Database['public']['Tables']['holes']['Insert']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

interface GpsState {
  status: 'idle' | 'pending' | 'ok' | 'denied'
  lat?: number
  lng?: number
}

export default function NewRound() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useLocalSearchParams<{ mode?: string }>()
  // Two entry points from the home tab: 'live' (GPS-tracked) and
  // 'past' (post-round entry). Default to 'live' since that's the
  // primary CTA — anyone reaching this page without a mode is most
  // likely about to play.
  const mode: 'live' | 'past' = params.mode === 'past' ? 'past' : 'live'
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [apiResults, setApiResults] = useState<OpenGolfApiSearchResult[]>([])
  const [localResults, setLocalResults] = useState<CourseRow[]>([])
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const searchAbort = useRef<AbortController | null>(null)

  // Debounce 300ms.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(id)
  }, [query])

  // Capture GPS once (best-effort) so manual / API course creation can
  // anchor hole 1 to the user's tee location.
  useEffect(() => {
    if (gps.status !== 'idle') return
    setGps({ status: 'pending' })
    ;(async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync()
        if (perm.status !== 'granted') {
          setGps({ status: 'denied' })
          return
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Low,
        })
        setGps({
          status: 'ok',
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
        })
      } catch {
        setGps({ status: 'denied' })
      }
    })()
  }, [gps.status])

  // Run search whenever debounced query changes.
  useEffect(() => {
    const term = debouncedQuery.trim()
    searchAbort.current?.abort()
    if (!term) {
      setApiResults([])
      setLocalResults([])
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    searchAbort.current = ctrl
    setSearching(true)
    Promise.allSettled([
      searchOpenGolfApi(term, ctrl.signal),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      searchCourses(supabase, term, 10).then((r: any) => r.data ?? []),
    ])
      .then(([api, local]) => {
        if (ctrl.signal.aborted) return
        setApiResults(api.status === 'fulfilled' ? api.value : [])
        setLocalResults(local.status === 'fulfilled' ? local.value : [])
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSearching(false)
      })
    return () => ctrl.abort()
  }, [debouncedQuery])

  const gpsCoords = gps.status === 'ok' ? { lat: gps.lat!, lng: gps.lng! } : null
  const noMatches =
    !searching &&
    debouncedQuery.trim().length > 0 &&
    apiResults.length === 0 &&
    localResults.length === 0

  async function startWith(courseId: string) {
    if (!user) return
    setBusy(true)
    setError(null)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: round, error: roundError } = await createRound(supabase, {
        user_id: user.id,
        course_id: courseId,
        played_at: today,
      })
      if (roundError || !round) throw roundError ?? new Error('Round insert failed')

      const { data: holes, error: holesError } = await supabase
        .from('holes')
        .select('id, number, par')
        .eq('course_id', courseId)
        .order('number')
      if (holesError) throw holesError

      await Promise.all(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (holes ?? []).map((h: any) =>
          upsertHoleScore(supabase, {
            round_id: round.id,
            hole_id: h.id,
            score: 0,
          }),
        ),
      )

      router.replace(`/(app)/round/${round.id}/hole/1?mode=${mode}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function startWithApiCourse(r: OpenGolfApiSearchResult) {
    setBusy(true)
    setError(null)
    try {
      const { data: existing } = await getCourseByExternalId(supabase, r.id)
      if (existing) {
        await startWith(existing.id)
        return
      }
      const detail = await getOpenGolfApiCourse(r.id)
      const location =
        [detail.city, detail.state].filter(Boolean).join(', ') ||
        formatLocation(r) ||
        null
      const { data: course, error: courseErr } = await createCourse(supabase, {
        name: detail.name || r.name,
        location,
        external_id: r.id,
      })
      if (courseErr || !course) throw courseErr ?? new Error('Course insert failed')

      const holes: HoleInsert[] =
        detail.holes.length > 0
          ? detail.holes.map((h, idx) => ({
              course_id: course.id,
              number: h.number,
              par: h.par,
              yards: h.yards ?? null,
              stroke_index: idx + 1,
              tee_lat: idx === 0 ? gpsCoords?.lat ?? null : null,
              tee_lng: idx === 0 ? gpsCoords?.lng ?? null : null,
            }))
          : new Array(18).fill(null).map((_, idx) => ({
              course_id: course.id,
              number: idx + 1,
              par: 4,
              stroke_index: idx + 1,
              tee_lat: idx === 0 ? gpsCoords?.lat ?? null : null,
              tee_lng: idx === 0 ? gpsCoords?.lng ?? null : null,
            }))
      const { error: holeErr } = await createHoles(supabase, holes)
      if (holeErr) throw holeErr
      if (detail.tees.length > 0) {
        await upsertCourseTees(
          supabase,
          detail.tees.map((t) => ({
            course_id: course.id,
            tee_color: t.color,
            tee_name: t.name ?? null,
            course_rating: t.rating ?? null,
            slope_rating: t.slope ?? null,
            total_yards: t.totalYards ?? null,
            par: t.par ?? null,
          })),
        )
      }
      await startWith(course.id)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  if (showManualForm) {
    return (
      <ManualCourseForm
        initialName={query}
        gpsCoords={gpsCoords}
        busy={busy}
        onCancel={() => setShowManualForm(false)}
        onCreate={async ({ name, location, pars }) => {
          setBusy(true)
          setError(null)
          try {
            const { data: course, error: courseErr } = await createCourse(
              supabase,
              { name: name.trim(), location: location?.trim() || null },
            )
            if (courseErr || !course) {
              throw courseErr ?? new Error('Course insert failed')
            }
            const holes: HoleInsert[] = pars.map((par, idx) => ({
              course_id: course.id,
              number: idx + 1,
              par,
              stroke_index: idx + 1,
              tee_lat: idx === 0 ? gpsCoords?.lat ?? null : null,
              tee_lng: idx === 0 ? gpsCoords?.lng ?? null : null,
            }))
            const { error: holeErr } = await createHoles(supabase, holes)
            if (holeErr) throw holeErr
            await startWith(course.id)
            setShowManualForm(false)
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      />
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5', padding: 18 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>
        {mode === 'past' ? 'Log past round' : 'Start live round'}
      </Text>
      <Text
        style={{
          color: '#1C211C',
          fontSize: 28,
          fontWeight: '500',
          marginBottom: 14,
          fontStyle: 'italic',
        }}
      >
        {mode === 'past' ? 'Pick the course you played' : 'Pick a course to start'}
      </Text>
      <TextInput
        placeholder="Search courses…"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        style={{
          backgroundColor: '#FBF8F1',
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 2,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 15,
          marginBottom: 14,
        }}
      />

      {searching && (
        <ActivityIndicator color="#1F3D2C" style={{ marginVertical: 8 }} />
      )}

      <ScrollView keyboardShouldPersistTaps="handled">
        {localResults.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ ...KICKER, marginBottom: 8 }}>Already imported</Text>
            {localResults.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => startWith(c.id)}
                disabled={busy}
                style={{
                  borderTopWidth: 1,
                  borderColor: '#D9D2BF',
                  paddingVertical: 14,
                  opacity: busy ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    color: '#1C211C',
                    fontSize: 15,
                    fontWeight: '500',
                  }}
                >
                  {c.name}
                </Text>
                {c.location && (
                  <Text style={{ color: '#5C6356', fontSize: 12, marginTop: 2 }}>
                    {c.location}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {apiResults.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={{ ...KICKER, marginBottom: 8 }}>OpenGolfAPI</Text>
            {apiResults.map((r) => (
              <Pressable
                key={r.id}
                onPress={() => startWithApiCourse(r)}
                disabled={busy}
                style={{
                  borderTopWidth: 1,
                  borderColor: '#D9D2BF',
                  paddingVertical: 14,
                  opacity: busy ? 0.4 : 1,
                }}
              >
                <Text
                  style={{
                    color: '#1C211C',
                    fontSize: 15,
                    fontWeight: '500',
                  }}
                >
                  {r.name}
                </Text>
                {formatLocation(r) ? (
                  <Text style={{ color: '#5C6356', fontSize: 12, marginTop: 2 }}>
                    {formatLocation(r)}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        {noMatches && (
          <Pressable
            onPress={() => setShowManualForm(true)}
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
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
              Course not found? Add it →
            </Text>
          </Pressable>
        )}

        {error && (
          <Text style={{ color: '#A33A2A', fontSize: 13, marginTop: 12 }}>
            {error}
          </Text>
        )}

        <Text style={{ ...KICKER, marginTop: 28, color: '#8A8B7E' }}>
          Course data from OpenGolfAPI · ODbL licensed
        </Text>
      </ScrollView>
    </View>
  )
}

interface ManualFormArgs {
  name: string
  location: string
  pars: number[]
}

function ManualCourseForm({
  initialName,
  gpsCoords,
  busy,
  onCancel,
  onCreate,
}: {
  initialName: string
  gpsCoords: { lat: number; lng: number } | null
  busy: boolean
  onCancel: () => void
  onCreate: (args: ManualFormArgs) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [location, setLocation] = useState('')
  const [holeCount, setHoleCount] = useState<9 | 18>(18)
  const [pars, setPars] = useState<number[]>(() => new Array(18).fill(4))

  const visiblePars = useMemo(() => pars.slice(0, holeCount), [pars, holeCount])

  function cyclePar(idx: number) {
    setPars((prev) => {
      const next = prev.slice()
      const cur = next[idx] ?? 4
      next[idx] = cur === 3 ? 4 : cur === 4 ? 5 : 3
      return next
    })
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text style={{ ...KICKER, marginBottom: 8 }}>Add course</Text>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 28,
            fontStyle: 'italic',
            fontWeight: '500',
            marginBottom: 18,
          }}
        >
          New course
        </Text>

        <Text style={{ ...KICKER, marginBottom: 8 }}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          style={inputStyle}
        />

        <Text style={{ ...KICKER, marginTop: 18, marginBottom: 8 }}>
          City, state (optional)
        </Text>
        <TextInput
          value={location}
          onChangeText={setLocation}
          autoCapitalize="words"
          style={inputStyle}
        />

        <Text style={{ ...KICKER, marginTop: 22, marginBottom: 8 }}>Holes</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip
            label="18 holes"
            active={holeCount === 18}
            onPress={() => setHoleCount(18)}
          />
          <Chip
            label="9 holes"
            active={holeCount === 9}
            onPress={() => setHoleCount(9)}
          />
        </View>

        <Text style={{ ...KICKER, marginTop: 22, marginBottom: 12 }}>
          Par per hole — tap to cycle
        </Text>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          {visiblePars.map((p, idx) => (
            <Pressable
              key={idx}
              onPress={() => cyclePar(idx)}
              style={{
                width: '11%',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Text
                style={{
                  ...KICKER,
                  fontSize: 9,
                  letterSpacing: 0.6,
                }}
              >
                {idx + 1}
              </Text>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: '#EBE5D6',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#1C211C',
                    fontSize: 15,
                    fontWeight: '500',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {p}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text
          style={{
            color: '#8A8B7E',
            fontSize: 12,
            marginTop: 18,
          }}
        >
          {gpsCoords
            ? `GPS captured (${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}) — set as hole 1 tee.`
            : 'GPS unavailable — hole coords left blank.'}
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
          <Pressable
            onPress={onCancel}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#5C6356', fontSize: 13 }}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              onCreate({ name, location, pars: visiblePars })
            }
            disabled={busy || !name.trim()}
            style={{
              flex: 2,
              backgroundColor: busy || !name.trim() ? '#9F9580' : '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: '#F2EEE5',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }}
            >
              {busy ? 'Creating…' : 'Create course →'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  )
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string
  active: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 2,
        backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
      }}
    >
      <Text
        style={{
          color: active ? '#F2EEE5' : '#1C211C',
          fontSize: 13,
          fontWeight: active ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

const inputStyle = {
  backgroundColor: '#FBF8F1',
  borderWidth: 1,
  borderColor: '#D9D2BF',
  borderRadius: 2,
  paddingHorizontal: 12,
  paddingVertical: 12,
  fontSize: 15,
  color: '#1C211C',
} as const
