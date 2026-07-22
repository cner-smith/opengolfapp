import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import * as Location from 'expo-location'
import {
  CAPTURE_MODES,
  CAPTURE_MODE_LABELS,
  formatLocation,
  getOpenGolfApiCourse,
  inferHoleCount,
  isProbableSameCourse,
  resolveFacilityResults,
  searchOpenGolfApi,
  todayLocalDate,
  type CaptureMode,
  type OpenGolfApiSearchResult,
} from '@oga/core'
import {
  createCourse,
  createHoles,
  createRound,
  deleteRound,
  getCourseByExternalId,
  getFacilitiesByIds,
  getFacilityUnits,
  searchCourses,
  searchFacilities,
  upsertCourseTees,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../hooks/useAuth'
import { FONT, TYPE } from '../../../lib/typography'
import { TeePicker } from '../../../components/round/RoundTeeSelector'
import { PressableTouch } from '../../../components/ui/PressableTouch'

type CourseRow = Database['public']['Tables']['courses']['Row']
type FacilityRow = Database['public']['Tables']['facilities']['Row']
type HoleInsert = Database['public']['Tables']['holes']['Insert']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
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
  const [facilityResults, setFacilityResults] = useState<FacilityRow[]>([])
  // Facility-first drill-down: tapping a facility card fetches its units and
  // sets `facility` — the results list swaps to just that facility's units
  // until the query changes or the user taps Back. Mirrors web CourseSearch.
  const [facility, setFacility] = useState<FacilityRow | null>(null)
  const [units, setUnits] = useState<CourseRow[]>([])
  const [facilityError, setFacilityError] = useState(false)
  // Monotonic token so a slow getFacilityUnits response from an earlier
  // facility tap can't overwrite the units of a facility tapped later.
  const facilityReqRef = useRef(0)
  const [searching, setSearching] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showManualForm, setShowManualForm] = useState(false)
  // Once a course is resolved we step to a lightweight setup view (tee pick)
  // before creating the round — mirrors web's NewRoundPage, where tee is an
  // up-front field. Null = still on the course-search screen.
  const [pendingCourse, setPendingCourse] = useState<{
    id: string
    name: string
  } | null>(null)
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const searchAbort = useRef<AbortController | null>(null)
  // Synchronous double-tap guard for round creation. `busy` state updates a
  // tick later, so a fast double-tap on "Start round" could fire startWith
  // twice and create two rounds — a ref blocks the second call immediately.
  // (Mirrors persistShotInFlightRef in useShotActions.) (#639)
  const startInFlightRef = useRef(false)
  const insets = useSafeAreaInsets()

  // Debounce 300ms.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(id)
  }, [query])

  // A new search always clears facility drill-down — otherwise a fresh
  // query could strand the picker inside a stale facility whose units no
  // longer match what was typed. Mirrors web CourseSearch.
  useEffect(() => {
    // Invalidate any in-flight openFacility so a late response can't re-open
    // a facility the user has navigated away from.
    facilityReqRef.current++
    setFacility(null)
    setUnits([])
    setFacilityError(false)
  }, [query])

  // Capture GPS once (best-effort) so manual / API course creation can
  // anchor hole 1 to the user's tee location. Past-round entry is
  // historical — never prompt for location in that mode.
  useEffect(() => {
    if (mode !== 'live') return
    if (gps.status !== 'idle') return
    setGps({ status: 'pending' })
    ;(async () => {
      try {
        // expo-location's permission request can hang on Android if the
        // activity is recreated mid-dialog. Race against a 10s timeout —
        // same mechanism as useHoleState.ts; see #278.
        const perm = await Promise.race([
          Location.requestForegroundPermissionsAsync(),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('perm-timeout')), 10_000),
          ),
        ]).catch((e: Error) => {
          // eslint-disable-next-line no-console
          console.warn('[round/new perm-timeout]', e.message)
          return { status: 'undetermined' as const }
        })
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
  }, [gps.status, mode])

  // Run search whenever debounced query changes. Facility-first: local
  // results split into standalone courses (no facility_id) and facility
  // units. Units are never dropped from the result set — a unit's facility
  // is re-anchored in via getFacilitiesByIds so a search for e.g. "Lake
  // Hefner South" still surfaces the "Lake Hefner Golf Club" facility card
  // even when the name match wasn't on the facility row itself. Mirrors
  // web's useCourseSearch exactly.
  useEffect(() => {
    const term = debouncedQuery.trim()
    searchAbort.current?.abort()
    if (!term) {
      setApiResults([])
      setLocalResults([])
      setFacilityResults([])
      setSearching(false)
      return
    }
    const ctrl = new AbortController()
    searchAbort.current = ctrl
    setSearching(true)
    ;(async () => {
      const [api, local, facilitySearch] = await Promise.allSettled([
        searchOpenGolfApi(term, ctrl.signal),
        searchCourses(supabase, term, 10, ctrl.signal).then(({ data, error }) => {
          // Abort propagates here as a PostgrestError shape with code:'' and
          // message starting "AbortError:" — but the cleanest gate is the
          // signal itself, robust to postgrest-js error-shape drift. See
          // #291.
          if (ctrl.signal.aborted) return [] as CourseRow[]
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[round/new searchCourses]', error.message)
            return [] as CourseRow[]
          }
          return (data ?? []) as unknown as CourseRow[]
        }),
        searchFacilities(supabase, term, 10, ctrl.signal).then(({ data, error }) => {
          if (ctrl.signal.aborted) return [] as FacilityRow[]
          if (error) {
            // eslint-disable-next-line no-console
            console.warn('[round/new searchFacilities]', error.message)
            return [] as FacilityRow[]
          }
          return (data ?? []) as unknown as FacilityRow[]
        }),
      ])
      if (ctrl.signal.aborted) return
      const localRows: CourseRow[] = local.status === 'fulfilled' ? local.value : []
      const byName: FacilityRow[] =
        facilitySearch.status === 'fulfilled' ? facilitySearch.value : []
      const { standalone, facilities } = await resolveFacilityResults(
        localRows,
        byName,
        async (ids) => {
          const r = await getFacilitiesByIds(supabase, ids)
          return (r.data ?? []) as unknown as FacilityRow[]
        },
      )
      if (ctrl.signal.aborted) return
      const apiRaw: OpenGolfApiSearchResult[] =
        api.status === 'fulfilled' ? api.value : []
      const apiDeduped = apiRaw.filter(
        (h) =>
          !localRows.some((c) => isProbableSameCourse(h, c)) &&
          !facilities.some((f) =>
            isProbableSameCourse(h, { name: f.name, state: f.state }),
          ),
      )
      setApiResults(apiDeduped)
      setLocalResults(standalone)
      setFacilityResults(facilities)
    })().finally(() => {
      if (!ctrl.signal.aborted) setSearching(false)
    })
    return () => ctrl.abort()
  }, [debouncedQuery])

  const gpsCoords = gps.status === 'ok' ? { lat: gps.lat!, lng: gps.lng! } : null
  const hasResults =
    apiResults.length > 0 || localResults.length > 0 || facilityResults.length > 0
  // Pin "Add it" below the results whenever there's a query to name the
  // course from — not only on an empty search. Near-but-wrong fuzzy
  // matches used to trap the user with no way to add the course they
  // actually meant (#472). Mirrors web CourseSearch.
  const showAddNew = !searching && debouncedQuery.trim().length > 0

  async function openFacility(f: FacilityRow) {
    const reqId = ++facilityReqRef.current
    const { data, error } = await getFacilityUnits(supabase, f.id)
    // A newer facility tap bumped the counter — drop this stale response.
    if (facilityReqRef.current !== reqId) return
    setFacility(f)
    if (error) {
      // Surface fetch failure as an error state instead of an empty facility.
      // eslint-disable-next-line no-console
      console.warn('[round/new getFacilityUnits]', error.message)
      setUnits([])
      setFacilityError(true)
      return
    }
    setFacilityError(false)
    setUnits((data ?? []) as unknown as CourseRow[])
  }

  async function startWith(
    courseId: string,
    tee?: { courseTeeId: string | null; teeColor: string | null },
    captureMode?: CaptureMode,
  ) {
    if (!user) return
    if (startInFlightRef.current) return
    startInFlightRef.current = true
    setBusy(true)
    setError(null)
    let createdRoundId: string | null = null
    try {
      const today = todayLocalDate()
      const { data: round, error: roundError } = await createRound(supabase, {
        user_id: user.id,
        course_id: courseId,
        played_at: today,
        // Past-round entry persists a total_score sentinel (0) at creation
        // so re-opening the round from the home list routes to the editable
        // scorecard, never the live map state machine. Live rounds leave
        // total_score null — that's the in-progress signal. See #514.
        ...(mode === 'past' ? { total_score: 0 } : {}),
        // Tee is optional; only record it when the player picked one in the
        // setup step. A rated tee is the input WHS differentials need (#542).
        ...(tee?.courseTeeId
          ? { course_tee_id: tee.courseTeeId, tee_color: tee.teeColor }
          : {}),
        // Capture mode steers the live flow only; past entry keeps the
        // 'track_patterns' column default.
        ...(mode === 'live' && captureMode ? { capture_mode: captureMode } : {}),
      })
      if (roundError || !round) throw roundError ?? new Error('Round insert failed')
      createdRoundId = round.id

      const { data: existingHoles, error: holesError } = await supabase
        .from('holes')
        .select('id, number, par')
        .eq('course_id', courseId)
        .order('number')
      if (holesError) throw holesError

      // Courses range from fully unmapped (most private clubs — zero
      // `holes` rows) to partially mapped (the crawler averages ~14 of 18
      // from OSM). Either way, every hole the round needs an FK target for
      // must have a real `holes` row, or hole_scores can't be created for
      // it and persistShot silently no-ops on the padded holes (#525).
      // Materialize whichever hole numbers are missing. Hole count is
      // inferred from the mapped numbers (course_tees.par is unpopulated in
      // our data — see inferHoleCount); a genuine 9-hole course stays 9.
      const existing = existingHoles ?? []
      const expectedCount = inferHoleCount(existing.map((h) => h.number))
      const byNumber = new Map<number, { id: string }>()
      for (const h of existing) byNumber.set(h.number, { id: h.id })

      const missing = Array.from(
        { length: expectedCount },
        (_, i) => i + 1,
      ).filter((n) => !byNumber.has(n))
      if (missing.length > 0) {
        // A direct holes insert is blocked by RLS (migration 0026) on any
        // course the user didn't create — which is every crawler/public
        // course. Materialize through the insert_synthetic_hole SECURITY
        // DEFINER RPC instead (it authorizes by round ownership), the same
        // path the web uses via ensureRealHole. The RPC is idempotent
        // (ON CONFLICT (course_id, number) DO NOTHING → re-select), so a
        // partial failure + retry self-heals. Par defaults to 4; later
        // enrichment / shot logging upgrades the row in place.
        const created = await Promise.all(
          missing.map((n) =>
            supabase.rpc('insert_synthetic_hole', {
              p_course_id: courseId,
              p_number: n,
              p_par: 4,
              p_round_id: round.id,
            }),
          ),
        )
        const failed = created.find((r) => r.error)
        if (failed?.error) throw failed.error
        created.forEach((r, i) => {
          byNumber.set(missing[i]!, { id: r.data as string })
        })
      }

      // Single batch insert beats per-hole round-trips; round was just
      // created so there's nothing to conflict against.
      const holeScoreRows = Array.from(byNumber.values()).map((h) => ({
        round_id: round.id,
        hole_id: h.id,
        score: 0,
      }))
      if (holeScoreRows.length > 0) {
        const { error: hsError } = await supabase
          .from('hole_scores')
          .insert(holeScoreRows)
        if (hsError) throw hsError
      }

      // Setup fully succeeded — clear so the catch below won't roll it back.
      createdRoundId = null
      router.replace({
        pathname: '/(app)/round/[id]',
        params: { id: round.id, hole: '1', mode },
      })
    } catch (err) {
      // Roll back a partially-created round so a failed hole / hole_scores
      // setup doesn't leave a stray blank round in the list. (#639)
      if (createdRoundId) {
        // best-effort rollback — ignore any delete failure
        try {
          await deleteRound(supabase, createdRoundId, user.id)
        } catch {
          /* noop */
        }
      }
      setError((err as Error).message)
    } finally {
      setBusy(false)
      startInFlightRef.current = false
    }
  }

  async function startWithApiCourse(r: OpenGolfApiSearchResult) {
    setBusy(true)
    setError(null)
    try {
      const { data: existing } = await getCourseByExternalId(supabase, r.id)
      if (existing) {
        setPendingCourse({ id: existing.id, name: existing.name })
        setBusy(false)
        return
      }
      const detail = await getOpenGolfApiCourse(r.id)
      const city = detail.city ?? r.city ?? null
      const state = detail.state ?? r.state ?? null
      const candidateName = detail.name || r.name
      const { data: localMatches } = await searchCourses(supabase, candidateName, 5)
      const dupe = (localMatches ?? []).find((c) =>
        isProbableSameCourse(
          { name: candidateName, state },
          { name: c.name, state: c.state },
        ),
      )
      if (dupe) {
        setPendingCourse({ id: dupe.id, name: dupe.name })
        setBusy(false)
        return
      }
      // `created_by` required by holes INSERT policy (migration 0026):
      // the followup createHoles call below RLS-fails on courses with
      // created_by IS NULL.
      if (!user) throw new Error('not authenticated')
      const { data: course, error: courseErr } = await createCourse(supabase, {
        name: detail.name || r.name,
        city,
        state,
        external_id: r.id,
        created_by: user.id,
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
      setPendingCourse({ id: course.id, name: detail.name || r.name })
      setBusy(false)
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
            const trimmed = location?.trim() ?? ''
            const commaIdx = trimmed.indexOf(',')
            const city =
              commaIdx >= 0
                ? trimmed.slice(0, commaIdx).trim() || null
                : trimmed || null
            const state =
              commaIdx >= 0 ? trimmed.slice(commaIdx + 1).trim() || null : null
            if (!user) throw new Error('not authenticated')
            const { data: course, error: courseErr } = await createCourse(
              supabase,
              { name: name.trim(), city, state, created_by: user.id },
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
            setShowManualForm(false)
            setPendingCourse({ id: course.id, name: name.trim() })
            setBusy(false)
          } catch (err) {
            setError((err as Error).message)
            setBusy(false)
          }
        }}
      />
    )
  }

  if (pendingCourse) {
    return (
      <RoundSetupStep
        courseId={pendingCourse.id}
        courseName={pendingCourse.name}
        mode={mode}
        busy={busy}
        onBack={() => setPendingCourse(null)}
        onStart={(courseTeeId, teeColor, captureMode) =>
          startWith(pendingCourse.id, { courseTeeId, teeColor }, captureMode)
        }
      />
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5', paddingTop: insets.top + 14, paddingHorizontal: 18, paddingBottom: 18 }}>
      <Text style={{ ...KICKER, marginBottom: 6 }}>
        {mode === 'past' ? 'Log past round' : 'Start live round'}
      </Text>
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 28,
          marginBottom: 14,
        }]}
      >
        {mode === 'past' ? 'Pick the course you played' : 'Pick a course to start'}
      </Text>
      <TextInput
        placeholder="Search courses…"
        placeholderTextColor="#8A8B7E"
        value={query}
        onChangeText={setQuery}
        autoCapitalize="words"
        style={[TYPE.body, {
          // Explicit ink color — without it Android falls back to the system
          // theme's text color, which is invisible on the cream input in dark
          // mode. Matches the manual-course inputs (inputStyle).
          color: '#1C211C',
          backgroundColor: '#FBF8F1',
          borderWidth: 1,
          borderColor: '#D9D2BF',
          borderRadius: 2,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontSize: 15,
          marginBottom: 14,
        }]}
      />

      {searching && (
        <ActivityIndicator color="#1F3D2C" style={{ marginVertical: 8 }} />
      )}

      <ScrollView keyboardShouldPersistTaps="handled">
        {facility ? (
          <View style={{ marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <PressableTouch
                onPress={() => {
                  facilityReqRef.current++
                  setFacility(null)
                  setUnits([])
                  setFacilityError(false)
                }}
              >
                <Text style={{ ...KICKER, color: '#1F3D2C' }}>‹ Back</Text>
              </PressableTouch>
              <Text style={KICKER}>{facility.name}</Text>
            </View>
            {units.map((unit) => (
              <PressableTouch
                key={unit.id}
                onPress={() =>
                  setPendingCourse({
                    id: unit.id,
                    name: `${facility.name} — ${unit.unit_name ?? unit.name}`,
                  })
                }
                disabled={busy}
                style={{
                  borderTopWidth: 1,
                  borderColor: '#D9D2BF',
                  paddingVertical: 14,
                  opacity: busy ? 0.4 : 1,
                }}
              >
                <Text
                  style={[TYPE.bodyBold, {
                    color: '#1C211C',
                    fontSize: 15,
                    fontWeight: '500',
                  }]}
                >
                  {unit.unit_name ?? unit.name}
                </Text>
              </PressableTouch>
            ))}
            {units.length === 0 && (
              <Text
                style={[TYPE.body, {
                  color: facilityError ? '#A33A2A' : '#8A8B7E',
                  fontSize: 13,
                  paddingVertical: 14,
                }]}
              >
                {facilityError
                  ? "Couldn't load courses — go back and try again."
                  : 'No courses listed.'}
              </Text>
            )}
          </View>
        ) : (
          <>
            {facilityResults.length > 0 && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ ...KICKER, marginBottom: 8 }}>Facilities</Text>
                {facilityResults.map((f) => (
                  <PressableTouch
                    key={f.id}
                    onPress={() => openFacility(f)}
                    disabled={busy}
                    style={{
                      borderTopWidth: 1,
                      borderColor: '#D9D2BF',
                      paddingVertical: 14,
                      opacity: busy ? 0.4 : 1,
                    }}
                  >
                    <Text
                      style={[TYPE.bodyBold, {
                        color: '#1C211C',
                        fontSize: 15,
                        fontWeight: '500',
                      }]}
                    >
                      {f.name}
                    </Text>
                    {(() => {
                      const where = [f.city, f.state].filter((s) => !!s).join(', ')
                      return where ? (
                        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12, marginTop: 2 }]}>
                          {where}
                        </Text>
                      ) : null
                    })()}
                  </PressableTouch>
                ))}
              </View>
            )}

            {(localResults.length > 0 || apiResults.length > 0) && (
              <View style={{ marginBottom: 14 }}>
                <Text style={{ ...KICKER, marginBottom: 8 }}>Courses</Text>
                {localResults.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => setPendingCourse({ id: c.id, name: c.name })}
                    disabled={busy}
                    style={{
                      borderTopWidth: 1,
                      borderColor: '#D9D2BF',
                      paddingVertical: 14,
                      opacity: busy ? 0.4 : 1,
                    }}
                  >
                    <Text
                      style={[TYPE.bodyBold, {
                        color: '#1C211C',
                        fontSize: 15,
                        fontWeight: '500',
                      }]}
                    >
                      {c.name}
                    </Text>
                    {(() => {
                      const where = [c.city, c.state].filter((s) => !!s).join(', ')
                      return where ? (
                        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12, marginTop: 2 }]}>
                          {where}
                        </Text>
                      ) : null
                    })()}
                  </Pressable>
                ))}
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
                      style={[TYPE.bodyBold, {
                        color: '#1C211C',
                        fontSize: 15,
                        fontWeight: '500',
                      }]}
                    >
                      {r.name}
                    </Text>
                    {formatLocation(r) ? (
                      <Text style={[TYPE.body, { color: '#5C6356', fontSize: 12, marginTop: 2 }]}>
                        {formatLocation(r)}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}

        {!facility && showAddNew && (
          <Pressable
            onPress={() => setShowManualForm(true)}
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: hasResults ? 8 : 0,
            }}
          >
            <Text
              style={[TYPE.bodyBold, {
                color: '#1F3D2C',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }]}
            >
              {hasResults ? "Don't see your course? Add it →" : 'Course not found? Add it →'}
            </Text>
          </Pressable>
        )}

        {error && (
          <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13, marginTop: 12 }]}>
            {error}
          </Text>
        )}

        <Text style={{ ...KICKER, marginTop: 28, color: '#8A8B7E' }}>
          Course data from OpenGolfAPI, GolfCourseAPI, and ©{' '}
          {/* OSM's ODbL attribution guidelines ask for a link to the copyright
              page where possible — RN can, via Linking. */}
          <Text
            onPress={() =>
              Linking.openURL('https://www.openstreetmap.org/copyright')
            }
            style={{ textDecorationLine: 'underline' }}
          >
            OpenStreetMap
          </Text>{' '}
          contributors (ODbL)
        </Text>
      </ScrollView>
    </View>
  )
}

// Setup step shown after a course is resolved but before the round is
// created — mirrors web's NewRoundPage where the tee is an up-front field.
// Tee is optional so it never blocks pace of play; "Start round" works with
// no tee picked, and the scorecard can still set it later.
function RoundSetupStep({
  courseId,
  courseName,
  mode,
  busy,
  onBack,
  onStart,
}: {
  courseId: string
  courseName: string
  mode: 'live' | 'past'
  busy: boolean
  onBack: () => void
  onStart: (
    courseTeeId: string | null,
    teeColor: string | null,
    captureMode: CaptureMode,
  ) => void
}) {
  const insets = useSafeAreaInsets()
  const [teeId, setTeeId] = useState<string | null>(null)
  const [teeColor, setTeeColor] = useState<string | null>(null)
  const [captureMode, setCaptureMode] = useState<CaptureMode>('track_patterns')

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F2EEE5',
        paddingTop: insets.top + 14,
        paddingHorizontal: 18,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 6 }}>
        {mode === 'past' ? 'Log past round' : 'Start live round'}
      </Text>
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 28,
          marginBottom: 18,
        }]}
      >
        {courseName}
      </Text>

      <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {mode === 'live' && (
          <View style={{ marginBottom: 22 }}>
            <Text style={{ ...KICKER, marginBottom: 8 }}>
              How do you want to track it?
            </Text>
            {CAPTURE_MODES.map((cm) => {
              const active = captureMode === cm
              return (
                <Pressable
                  key={cm}
                  onPress={() => setCaptureMode(cm)}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? '#1F3D2C' : '#D9D2BF',
                    backgroundColor: active ? '#1F3D2C' : '#FBF8F1',
                    borderRadius: 2,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <Text
                    style={[TYPE.bodyBold, {
                      color: active ? '#F2EEE5' : '#1C211C',
                      fontSize: 15,
                      fontWeight: '600',
                      marginBottom: 2,
                    }]}
                  >
                    {CAPTURE_MODE_LABELS[cm].title}
                  </Text>
                  <Text
                    style={[TYPE.body, {
                      color: active ? '#C7D3C0' : '#8A8B7E',
                      fontSize: 12,
                    }]}
                  >
                    {CAPTURE_MODE_LABELS[cm].subtitle}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}

        <Text style={{ ...KICKER, marginBottom: 4 }}>Tee played</Text>
        <Text style={[TYPE.body, { color: '#8A8B7E', fontSize: 12, marginBottom: 12 }]}>
          Optional — add the tee's rating and slope for a handicap differential.
          You can set it later from the scorecard.
        </Text>

        <TeePicker
          courseId={courseId}
          selectedTeeId={teeId}
          onSelect={(t) => {
            setTeeId(t.id)
            setTeeColor(t.tee_color)
          }}
          busy={busy}
        />
      </ScrollView>

      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          paddingVertical: 14,
          paddingBottom: insets.bottom + 14,
        }}
      >
        <Pressable
          onPress={onBack}
          disabled={busy}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: busy ? 0.5 : 1,
          }}
        >
          <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13 }]}>Back</Text>
        </Pressable>
        <Pressable
          onPress={() => onStart(teeId, teeColor, captureMode)}
          disabled={busy}
          style={{
            flex: 2,
            backgroundColor: busy ? '#9F9580' : '#1F3D2C',
            borderRadius: 2,
            paddingVertical: 14,
            alignItems: 'center',
          }}
        >
          <Text
            style={[TYPE.bodyBold, {
              color: '#F2EEE5',
              fontSize: 14,
              fontWeight: '600',
              letterSpacing: 0.3,
            }]}
          >
            {busy ? 'Starting…' : mode === 'past' ? 'Log round →' : 'Start round →'}
          </Text>
        </Pressable>
      </View>
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
      <ScrollView
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={{ ...KICKER, marginBottom: 8 }}>Add course</Text>
        <Text
          style={[TYPE.serif, {
            color: '#1C211C',
            fontSize: 28,
            marginBottom: 18,
          }]}
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
                  style={[TYPE.serifUpright, {
                    color: '#1C211C',
                    fontSize: 15,
                    fontWeight: '500',
                    fontVariant: ['tabular-nums'],
                  }]}
                >
                  {p}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Text
          style={[TYPE.body, {
            color: '#8A8B7E',
            fontSize: 12,
            marginTop: 18,
          }]}
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
            <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13 }]}>Cancel</Text>
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
              style={[TYPE.bodyBold, {
                color: '#F2EEE5',
                fontSize: 14,
                fontWeight: '600',
                letterSpacing: 0.3,
              }]}
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
        style={[active ? TYPE.bodyBold : TYPE.body, {
          color: active ? '#F2EEE5' : '#1C211C',
          fontSize: 13,
          fontWeight: active ? '600' : '400',
        }]}
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
  fontFamily: FONT.body,
} as const
