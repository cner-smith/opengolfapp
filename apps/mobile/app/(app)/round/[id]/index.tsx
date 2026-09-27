import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  pickRoundFocus,
  resolveCourseTee,
  selectNudgeDrills,
  type CaptureMode,
} from '@oga/core'
import {
  deleteRound,
  getCourseTees,
  getDrills,
  getHoleTeesForCourse,
  getProfile,
  updateRound,
  upsertHoleScore,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../../lib/supabase'
import { completeRound } from '../../../../lib/completeRound'
import {
  clearScreenCache,
  getCached,
  setCached,
} from '../../../../lib/screenCache'
import { ShareableScorecardCard } from '../../../../components/round/ShareableScorecardCard'
import { RoundTeeSelector } from '../../../../components/round/RoundTeeSelector'
import { PastHoleShotsSheet } from '../../../../components/round/PastHoleShotsSheet'
import { PastRoundMap } from '../../../../components/round/PastRoundMap'
import { RoundScorecardTab, signed } from '../../../../components/round/past/RoundScorecardTab'
import type { LatLng } from '../../../../components/round/HoleMap'
import LiveRoundSession from '../../../../components/round/LiveRoundSession'
import { ConfirmDialog } from '../../../../components/ui/ConfirmDialog'
import { Key, KeyText, PaperSurface, Rocker } from '../../../../components/paper/Paper'
import { Icon } from '../../../../components/paper/icons'
import { P } from '../../../../components/paper/tokens'
import { useAuth } from '../../../../hooks/useAuth'
import { useUnits } from '../../../../hooks/useUnits'
import { TYPE } from '../../../../lib/typography'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type DrillRow = Database['public']['Tables']['drills']['Row']
type CourseTeeRow = Database['public']['Tables']['course_tees']['Row']
type HoleTeeRow = Database['public']['Tables']['hole_tees']['Row']

// Everything the summary view needs for a first paint, bundled under one
// `round:${id}` screen-cache key (#599).
interface RoundDetailCache {
  round: RoundRow
  courseName: string
  courseCenter: LatLng | null
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  shots: ShotRow[]
}

// This route is a hidden Tabs screen (app/(app)/_layout.tsx), and tab screens
// stay mounted: opening another round only changes `id`, so every useState /
// useRef below would carry the previous round's tab, map hole, sheets and
// data over (#944). Keying on id remounts the screen per round.
export default function RoundIndex() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <RoundScreen key={id} />
}

// Round entry route. Live (incomplete) rounds redirect into the hole
// flow; completed rounds render a read-only summary so a player viewing
// a past round from the home list isn't dropped back into the
// Mark-ball / Set-aim state machine.
function RoundScreen() {
  const { id, hole, mode } = useLocalSearchParams<{
    id: string
    hole?: string
    mode?: string
  }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [round, setRound] = useState<RoundRow | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [shots, setShots] = useState<ShotRow[]>([])
  const [courseName, setCourseName] = useState<string>('Round')
  const [courseCenter, setCourseCenter] = useState<LatLng | null>(null)
  // Played-tee detail for the share card (#562): rating/slope/yardage, matched
  // by tee id then colour (same match the web card uses) — resolveCourseTee
  // (@oga/core) is the shared version of that fallback.
  const [playedTee, setPlayedTee] = useState<CourseTeeRow | null>(null)
  // Per-tee hole overrides (yards/par/stroke_index/tee location) for the
  // resolved played tee — sparse, most courses have none yet. Fed into
  // PastRoundMap so the map/scorecard shows tee-specific data when present.
  const [holeTees, setHoleTees] = useState<HoleTeeRow[]>([])
  useEffect(() => {
    const courseId = round?.course_id
    if (!courseId) return
    let cancelled = false
    Promise.all([getCourseTees(supabase, courseId), getHoleTeesForCourse(supabase, courseId)]).then(
      ([teesRes, holeTeesRes]) => {
        if (cancelled) return
        const tee = resolveCourseTee(teesRes.data ?? [], round?.course_tee_id, round?.tee_color)
        setPlayedTee(tee)
        setHoleTees(holeTeesRes.data ?? [])
      },
    )
    return () => {
      cancelled = true
    }
  }, [round?.course_id, round?.course_tee_id, round?.tee_color])
  // Scorecard ⇄ Map tabs (#514): the scorecard edits scores/putts/details,
  // the map places ball + aim geometry. `mapHole` is the hole the map is
  // focused on; its prev/next nav drives it.
  const [view, setView] = useState<'scorecard' | 'map'>('scorecard')
  const [mapHole, setMapHole] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirectToLive, setRedirectToLive] = useState(false)
  // Bumped when the live session finalizes the round: re-runs the loader,
  // which now finds completed_at set and renders the summary (#909).
  const [loadSeq, setLoadSeq] = useState(0)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingSG, setSavingSG] = useState(false)
  const [shareTone, setShareTone] = useState<'light' | 'dark'>('light')
  // Selected hole for the read-only shots sheet. The sheet is the
  // entire past-round drill-down — we deliberately do NOT navigate
  // back into the live HoleScreen route on tap (mode=past would drop
  // the player into the place-ball state machine on a finalized round).
  const [shotsForHole, setShotsForHole] = useState<HoleRow | null>(null)
  // When the past-round map's "Edit this shot" opens the shots sheet, this
  // jumps it straight into that shot's editor (vs the shot list). Cleared on
  // close so the scorecard drill-down still opens to the list.
  const [editShotId, setEditShotId] = useState<string | null>(null)
  const shareCardRef = useRef<View>(null)
  const { unit } = useUnits()
  const { user } = useAuth()
  // "Today's focus" nudge data — fetched lazily, only when the round has a leak.
  const [nudgeFacilities, setNudgeFacilities] = useState<string[]>([])
  const [nudgeDrills, setNudgeDrills] = useState<DrillRow[]>([])
  // Captions the SG total ("vs a 14 handicap"); read off the same profile fetch.
  const [handicap, setHandicap] = useState<number | null>(null)
  // One paper confirm at a time — iOS presents one modal per presenter (#293).
  const [dialog, setDialog] = useState<'leave' | 'delete' | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    // Reset per-round state up front so a previously-viewed round's error or
    // live-redirect can't leak onto the next one — e.g. after the active round
    // is deleted from the home list, the stale `error` would otherwise keep the
    // `if (error || !round)` guard tripped for every round opened afterward.
    // Seed from the screen cache when we have this round — instant render,
    // and the fetch below still runs and replaces everything (#599).
    // Unfinished rounds are never cached (they redirect to the live session).
    const cached = getCached<RoundDetailCache>(`round:${id}`)
    if (cached) {
      setRound(cached.round)
      setCourseName(cached.courseName)
      setCourseCenter(cached.courseCenter)
      setHoles(cached.holes)
      setHoleScores(cached.holeScores)
      setShots(cached.shots)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)
    setRedirectToLive(false)
    ;(async () => {
      try {
        // A deleted round returns null rather than throwing PGRST116 "cannot
        // coerce the result to a single JSON object".
        const { data: r, error: rErr } = await supabase
          .from('rounds')
          .select('*, courses(name, lat, lng, facilities(name))')
          .eq('id', id)
          .maybeSingle()
        if (rErr || !r) throw rErr ?? new Error('Round not found')
        if (!active) return
        const row = r as RoundRow & {
          courses?: {
            name: string | null
            lat: number | null
            lng: number | null
            facilities?: { name: string | null } | null
          } | null
        }
        setRound(row)
        setCourseName(
          row.courses?.facilities?.name
            ? `${row.courses.facilities.name} — ${row.courses.name}`
            : (row.courses?.name ?? 'Round'),
        )
        setCourseCenter(
          row.courses?.lat != null && row.courses?.lng != null
            ? { lat: row.courses.lat, lng: row.courses.lng }
            : null,
        )
        // Only redirect into the live state machine for a round that is
        // genuinely unfinished: never finalized (completed_at null) AND has
        // no score yet. completed_at is the canonical finalized flag, so a
        // finalized round always opens the read-only tabbed view even if its
        // total_score is null. The total_score guard keeps seeded past rounds
        // (scored but no completed_at) out of the live map too; the
        // `mode !== 'past'` guard covers the past-logger creation race.
        const unfinished = row.completed_at == null && row.total_score == null
        if (unfinished && mode !== 'past') {
          if (active) setRedirectToLive(true)
          return
        }
        const [hRes, hsRes] = await Promise.all([
          supabase
            .from('holes')
            .select('*')
            .eq('course_id', row.course_id)
            .order('number'),
          supabase.from('hole_scores').select('*').eq('round_id', row.id),
        ])
        if (!active) return
        if (hRes.error) throw hRes.error
        if (hsRes.error) throw hsRes.error
        setHoles(hRes.data ?? [])
        setHoleScores(hsRes.data ?? [])
        // Shots are fetched in the useFocusEffect below — re-focus
        // after an end-round (when pending shots are still syncing
        // via fire-and-forget background sync) self-heals the count.
        // See #246.
      } catch (err) {
        if (!active) return
        setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id, loadSeq])

  // "Today's focus" nudge (parity with web RoundSummary). No react-query on
  // mobile — gate the profile + drills fetch by hand, like web's
  // useProfile→useDrills.
  useEffect(() => {
    if (!round || round.total_score == null || !user) return
    const focus = pickRoundFocus(round)
    let active = true
    ;(async () => {
      const { data: profile, error: pErr } = await getProfile(supabase, user.id)
      if (!active || pErr || !profile) return
      setHandicap(
        (profile as { handicap_index?: number | null }).handicap_index ?? null,
      )
      if (!focus) return
      setNudgeFacilities(profile.facilities ?? [])
      const { data: drills, error: dErr } = await getDrills(supabase, {
        category: focus.category,
        skillLevel: profile.skill_level ?? undefined,
      })
      if (!active || dErr) return
      setNudgeDrills(drills ?? [])
    })()
    return () => {
      active = false
    }
  }, [round, user?.id])

  // Hooks must run unconditionally before any branch return — these
  // memos are needed by the read-only summary path below, but lifting
  // them above the redirectToLive early-return keeps render-1 (loading)
  // and render-2 (live-session mount) on the same hook count.
  const scoresByHoleId = useMemo(
    () => new Map(holeScores.map((hs) => [hs.hole_id, hs])),
    [holeScores],
  )
  const sortedHoles = useMemo(
    () => [...holes].sort((a, b) => a.number - b.number),
    [holes],
  )
  // Per-hole shot counts for the scorecard "Shots" affordance. Every row
  // is tappable now that the scorecard is editable (#514) — the count just
  // distinguishes "N shots →" from "+ add →".
  const holeScoreShotCount = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of shots) m.set(s.hole_score_id, (m.get(s.hole_score_id) ?? 0) + 1)
    return m
  }, [shots])
  // Shots grouped by hole_score_id, built once — the scorecard's FIR/GIR
  // fallback reads this O(1) per row instead of filtering the full `shots`
  // array per hole (was O(shots×holes) in the render body).
  const shotsByHoleScoreId = useMemo(() => {
    const m = new Map<string, ShotRow[]>()
    for (const s of shots) {
      const arr = m.get(s.hole_score_id)
      if (arr) arr.push(s)
      else m.set(s.hole_score_id, [s])
    }
    return m
  }, [shots])

  // Refetch shots on screen focus. The end-round write order is:
  // total_score + hole_scores first, then pending shot inserts trickle
  // into the `shots` table via background sync. A player who reaches
  // this screen mid-sync sees the totals row diverge from the per-hole
  // drill-down sheet until a refetch. Initial mount fires this once
  // (after holeScores populates and the callback identity changes),
  // and every subsequent focus refires — so the common path
  // (end-round → home → back to scorecard) self-heals. See #246.
  useFocusEffect(
    useCallback(() => {
      if (holeScores.length === 0) return
      let active = true
      const holeScoreIds = holeScores.map((hs) => hs.id)
      supabase
        .from('shots')
        .select('*')
        .in('hole_score_id', holeScoreIds)
        .order('shot_number')
        .then(({ data, error }) => {
          if (!active || error) return
          setShots(data ?? [])
        })
      return () => {
        active = false
      }
    }, [holeScores]),
  )

  // Mirror the settled screen state into the cache — covers both the fetch
  // AND local edits (scorecard/sheet mutations setState here), so a revisit
  // seeds post-edit data instead of a stale flash (#599).
  useEffect(() => {
    if (!id || loading || error || redirectToLive || !round) return
    setCached(`round:${id}`, {
      round,
      courseName,
      courseCenter,
      holes,
      holeScores,
      shots,
    } satisfies RoundDetailCache)
  }, [
    id,
    loading,
    error,
    redirectToLive,
    round,
    courseName,
    courseCenter,
    holes,
    holeScores,
    shots,
  ])

  // Stable across renders — passing an inline arrow caused
  // LiveRoundSession's onHoleChange-keyed effect to re-fire on every
  // parent render, looping with router.setParams.
  const syncHoleToUrl = useCallback(
    (next: number) => router.setParams({ hole: String(next) }),
    [router],
  )
  const onRoundCompleted = useCallback(() => setLoadSeq((n) => n + 1), [])

  // In-progress rounds mount the live session here — the path-segmented
  // hole route is deprecated, see #264. holeNumber is component state
  // inside LiveRoundSession; the ?hole= search param is just the URL
  // mirror so a deep-link / refresh lands on the right hole.
  if (redirectToLive && id) {
    const initialHole = (() => {
      const n = Number(hole)
      return Number.isFinite(n) && n >= 1 && n <= 18 ? n : 1
    })()
    return (
      <LiveRoundSession
        roundId={id}
        initialHoleNumber={initialHole}
        // Past entry no longer routes here (#514) — the redirect above is
        // gated on `mode !== 'past'`, so this branch is always a live round.
        // The LiveRoundSession `mode`/isPastMode plumbing is now dead and can
        // be removed in a follow-up cleanup.
        mode="live"
        captureMode={(round?.capture_mode ?? 'track_patterns') as CaptureMode}
        onHoleChange={syncHoleToUrl}
        onRoundCompleted={onRoundCompleted}
      />
    )
  }

  if (loading) {
    return (
      <PaperSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={P.forest} />
      </PaperSurface>
    )
  }
  if (error || !round) {
    return (
      <PaperSurface style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 22 }}>
        <Text style={[TYPE.body, { color: P.neg, fontSize: 15, textAlign: 'center' }]}>
          {error ?? 'Round not found'}
        </Text>
      </PaperSurface>
    )
  }

  // Captures the off-screen ShareableScorecardCard via
  // react-native-view-shot, then hands the resulting tmpfile URI to
  // expo-sharing's native share sheet. Falls back to an alert if
  // sharing isn't available on this device (rare — Android always has
  // it, iOS always has it). The capture happens against the off-screen
  // wrapper a few hundred pixels off the left edge so the user never
  // sees the card flicker into view.
  async function handleShare() {
    if (sharing || !shareCardRef.current) return
    setSharing(true)
    try {
      const uri = await captureRef(shareCardRef, {
        format: 'png',
        quality: 1,
        result: 'tmpfile',
      })
      const available = await Sharing.isAvailableAsync()
      if (!available) {
        Alert.alert('Sharing unavailable', 'This device cannot share files.')
        return
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share scorecard',
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[round/share]', err)
      Alert.alert('Share failed', (err as Error).message)
    } finally {
      setSharing(false)
    }
  }

  // Leaving a not-yet-finalized round (completed_at null) warns first and
  // points the player at where to resume it — a logged-but-unfinished past
  // round otherwise looks like a finished "0" round in the list (#514 QA).
  function handleLeave() {
    if (round && round.completed_at == null) {
      setDialog('leave')
      return
    }
    router.replace('/(app)')
  }

  // Delete the whole round. Mirrors web RoundHeader's Delete (RLS-gated
  // on user_id via deleteRound). No "End round early" here — this is the
  // past-round / review surface, not the live tracker (#514).
  async function confirmDelete() {
    if (!round || !user || deleting) return
    setDeleting(true)
    try {
      const { error: delErr } = await deleteRound(supabase, round.id, user.id)
      if (delErr) throw delErr
      // Wipe ALL cached screens — home/list/detail caches would
      // resurrect the deleted round as a ghost (#705 redux).
      clearScreenCache()
      setDialog(null)
      router.replace('/(app)')
    } catch (e) {
      // Reset so the `deleting` guard can't wedge the button on retry;
      // surface the reason instead of hanging on "Deleting…" forever.
      setDeleting(false)
      setDialog(null)
      Alert.alert('Delete failed', (e as Error).message)
    }
  }

  // Save SG / finalize (#514). Mirrors web's "Save SG + finalize" — runs
  // the same completeRound pass the live End-round uses: computes per-hole +
  // round SG from the placed shots and writes totals back. Safe to re-run
  // (it's idempotent over the current DB state), so editing then re-saving
  // recomputes. completeRound's pending-shot sync is a no-op for past rounds
  // (they write straight to Supabase, never the local queue).
  async function handleSaveSG() {
    if (!round || !user || savingSG) return
    setSavingSG(true)
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
      // Refetch round + hole_scores so the SG breakdown + totals reflect the
      // computed values without leaving the screen.
      const [rRes, hsRes] = await Promise.all([
        supabase
          .from('rounds')
          .select('*, courses(name, lat, lng, facilities(name))')
          .eq('id', round.id)
          .maybeSingle(),
        supabase.from('hole_scores').select('*').eq('round_id', round.id),
      ])
      if (rRes.data) {
        const saved = rRes.data as RoundRow & {
          courses?: { name: string | null } | null
        }
        setRound(saved)
      }
      if (hsRes.data) setHoleScores(hsRes.data)
    } catch (err) {
      Alert.alert('Save SG failed', (err as Error).message)
    } finally {
      setSavingSG(false)
    }
  }

  // Inline scorecard edits (#514). Upsert the hole_score, patch local
  // state, and keep rounds.total_score in sync so the Total header + the
  // home list reflect the running score without a Save-SG round trip.
  // total_score stays non-null (sentinel preserved) so routing never
  // regresses to the live map.
  async function persistHoleScore(
    holeId: string,
    patch: { score?: number; putts?: number | null },
  ) {
    if (!round || !user) return
    const existing = scoresByHoleId.get(holeId)
    const { data, error: hsErr } = await upsertHoleScore(supabase, {
      round_id: round.id,
      hole_id: holeId,
      score: patch.score ?? existing?.score ?? 0,
      ...(patch.putts !== undefined ? { putts: patch.putts } : {}),
    })
    if (hsErr || !data) {
      Alert.alert('Save failed', hsErr?.message ?? 'Could not save score')
      return
    }
    const updatedRow = data as HoleScoreRow
    const nextList = (() => {
      const idx = holeScores.findIndex((hs) => hs.hole_id === holeId)
      if (idx === -1) return [...holeScores, updatedRow]
      const n = holeScores.slice()
      n[idx] = updatedRow
      return n
    })()
    setHoleScores(nextList)
    // Recompute rounds.total_score from the entered scores. Putts edits
    // don't move the total, so skip the round write for those.
    if (patch.score !== undefined) {
      const byHole = new Map(nextList.map((hs) => [hs.hole_id, hs]))
      let total = 0
      for (const h of sortedHoles) {
        const s = byHole.get(h.id)?.score
        if (s != null && s > 0) total += s
      }
      // Write first, then reflect locally — an optimistic setRound here left
      // the header total contradicting the DB with no rollback on failure.
      const { error: rErr } = await updateRound(
        supabase,
        round.id,
        { total_score: total },
        user.id,
      )
      if (rErr) {
        Alert.alert('Save failed', rErr.message)
        return
      }
      setRound((prev) => (prev ? { ...prev, total_score: total } : prev))
    }
  }

  const focus = pickRoundFocus(round)

  let runningScore = 0
  let runningPar = 0
  for (const h of sortedHoles) {
    const hs = scoresByHoleId.get(h.id)
    if (hs?.score != null && hs.score > 0) {
      runningScore += hs.score
      // Per-round par override (#710) — hole_scores.par wins over the
      // course hole's par when the player corrected it.
      runningPar += hs.par ?? h.par
    }
  }

  // "Fri 25 Sep". played_at is a DATE; a bare 'YYYY-MM-DD' parses as UTC,
  // which is a day early in US zones — pin it to local midnight.
  const played = new Date(`${round.played_at}T00:00:00`)
  const dateLabel = Number.isNaN(played.getTime())
    ? round.played_at
    : `${DAYS[played.getDay()]} ${played.getDate()} ${MONTHS[played.getMonth()]}`

  return (
    <PaperSurface style={{ flex: 1 }}>
      {/* Round header (#611 §19.1), above both tabs. On the Map tab it runs
          on into PastRoundMap's hole block, which draws the rule under both. */}
      <View
        style={{
          paddingTop: insets.top,
          borderBottomWidth: view === 'scorecard' ? 1 : 0,
          borderColor: P.ink,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingRight: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Home"
            onPress={handleLeave}
            style={{ width: 44, height: 44, marginLeft: 2, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon.back size={24} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0, paddingLeft: 4, paddingRight: 8 }}>
            <Text numberOfLines={1} style={[TYPE.serif, { fontSize: 20, lineHeight: 25, color: P.ink }]}>
              {courseName}
            </Text>
            <Text numberOfLines={1} style={[TYPE.body, { fontSize: 13, color: P.ink }]}>
              {dateLabel}
              {sortedHoles.length > 0 ? ` · ${sortedHoles.length} holes` : ''}
              {runningPar > 0 && (
                <>
                  {' · '}
                  <Text style={[TYPE.serif, { fontSize: 15 }]}>{runningScore}</Text> ({signed(runningScore - runningPar)})
                </>
              )}
            </Text>
          </View>
          <Key
            accessibilityLabel="Share scorecard"
            onPress={handleShare}
            disabled={sharing}
            faceStyle={{ minHeight: 44, paddingHorizontal: 10, flexDirection: 'row', gap: 6 }}
          >
            <Icon.share size={18} color={sharing ? P.ink35 : P.ink} />
            <KeyText disabled={sharing}>{sharing ? 'Rendering…' : 'Share'}</KeyText>
          </Key>
        </View>
        <Rocker
          options={[
            { value: 'scorecard', label: 'Scorecard' },
            { value: 'map', label: 'Map' },
          ]}
          value={view}
          onChange={(v) => v && setView(v)}
          style={{ marginTop: 2, marginHorizontal: 12, marginBottom: 13 }}
        />
      </View>

      {/* Off-screen render target for react-native-view-shot. The View
          is laid out far off the left edge so it's never visible to
          the player; collapsable={false} keeps RN from optimising
          out an "empty" subtree the rasteriser still needs to read. */}
      <View
        pointerEvents="none"
        collapsable={false}
        style={{ position: 'absolute', left: -10000, top: 0 }}
      >
        <View ref={shareCardRef} collapsable={false}>
          <ShareableScorecardCard
            round={{
              played_at: round.played_at,
              tee_color: round.tee_color,
              total_score: round.total_score,
              sg_off_tee: round.sg_off_tee,
              sg_approach: round.sg_approach,
              sg_around_green: round.sg_around_green,
              sg_putting: round.sg_putting,
              sg_total: round.sg_total,
              courseName,
              course_rating: playedTee?.course_rating ?? null,
              slope_rating: playedTee?.slope_rating ?? null,
              total_yards: playedTee?.total_yards ?? null,
            }}
            holes={sortedHoles}
            scoresByHoleId={scoresByHoleId}
            tone={shareTone}
          />
        </View>
      </View>

      {view === 'scorecard' && (
        <RoundScorecardTab
          round={round}
          holes={sortedHoles}
          scoresByHoleId={scoresByHoleId}
          shotCountByHoleScoreId={holeScoreShotCount}
          shotsByHoleScoreId={shotsByHoleScoreId}
          runningScore={runningScore}
          runningPar={runningPar}
          handicap={handicap}
          focus={focus}
          drills={focus ? selectNudgeDrills(nudgeDrills, nudgeFacilities) : []}
          onCommit={persistHoleScore}
          onOpenShots={(h) => {
            setShotsForHole(h)
            // The empty sheet points to the Map tab — open it on this hole (#918).
            setMapHole(h.number)
          }}
        >
          {user && (
            <RoundTeeSelector
              courseId={round.course_id}
              roundId={round.id}
              userId={user.id}
              currentTeeId={round.course_tee_id}
              onChange={(tee) =>
                setRound((r) =>
                  r ? { ...r, course_tee_id: tee.id, tee_color: tee.color } : r,
                )
              }
            />
          )}

          <Key
            accessibilityLabel="Save strokes gained"
            tone="primary"
            onPress={handleSaveSG}
            disabled={savingSG}
            style={{ marginTop: 28 }}
            faceStyle={{ minHeight: 50, paddingHorizontal: 12 }}
          >
            <KeyText tone="primary" bold size={16} disabled={savingSG}>
              {savingSG ? 'Saving…' : 'Save SG'}
            </KeyText>
          </Key>

          <Key
            accessibilityLabel="Delete round"
            onPress={() => !deleting && user && setDialog('delete')}
            disabled={deleting}
            style={{ marginTop: 14, alignSelf: 'flex-start' }}
            faceStyle={{ minHeight: 44, paddingHorizontal: 14 }}
          >
            <KeyText disabled={deleting} style={deleting ? undefined : { color: P.neg }}>
              {deleting ? 'Deleting…' : 'Delete round'}
            </KeyText>
          </Key>
        </RoundScorecardTab>
      )}

      {view === 'map' && round && user && (
        <PastRoundMap
          roundId={round.id}
          userId={user.id}
          completed={round.completed_at != null}
          holes={sortedHoles}
          holeScores={holeScores}
          holeTees={holeTees}
          resolvedCourseTeeId={playedTee?.id ?? null}
          shots={shots}
          unit={unit}
          courseCenter={courseCenter}
          holeNumber={mapHole}
          onHoleChange={setMapHole}
          onEditShot={(shotId) => {
            const hole = sortedHoles.find((h) => h.number === mapHole)
            if (hole) {
              setEditShotId(shotId)
              setShotsForHole(hole)
            }
          }}
          onShotUpserted={(s) =>
            setShots((prev) => {
              const i = prev.findIndex((x) => x.id === s.id)
              if (i === -1) return [...prev, s]
              const n = prev.slice()
              n[i] = s
              return n
            })
          }
          onShotRemoved={(shotId) =>
            setShots((prev) => prev.filter((x) => x.id !== shotId))
          }
          onHoleScoreChanged={(hs) =>
            setHoleScores((prev) => prev.map((x) => (x.id === hs.id ? hs : x)))
          }
        />
      )}
      <PastHoleShotsSheet
        visible={shotsForHole != null}
        holeNumber={shotsForHole?.number ?? null}
        par={shotsForHole?.par ?? null}
        shots={
          shotsForHole
            ? shotsByHoleScoreId.get(scoresByHoleId.get(shotsForHole.id)?.id ?? '') ?? []
            : []
        }
        unit={unit}
        initialShotId={editShotId}
        onClose={() => {
          setShotsForHole(null)
          setEditShotId(null)
        }}
        onShotUpdated={(updated) =>
          setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
      />
      <ConfirmDialog
        visible={dialog === 'leave'}
        title="Leave this round?"
        message="It isn't finished. Your scores and shots are saved — resume it anytime from Recent rounds on the Home screen."
        cancelLabel="Keep logging"
        confirmLabel="Leave"
        destructive
        onConfirm={() => {
          setDialog(null)
          router.replace('/(app)')
        }}
        onCancel={() => setDialog(null)}
      />
      <ConfirmDialog
        visible={dialog === 'delete'}
        title="Delete round?"
        message="This permanently removes the round and all its shots."
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDialog(null)}
      />
    </PaperSurface>
  )
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
