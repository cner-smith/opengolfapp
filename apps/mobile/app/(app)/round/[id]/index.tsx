import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { PressableTouch } from '../../../../components/ui/PressableTouch'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  formatSG,
  pickRoundFocus,
  roundFocusHeadline,
  selectNudgeDrills,
  type RoundFocus,
} from '@oga/core'
import {
  deleteRound,
  getDrills,
  getProfile,
  updateRound,
  upsertHoleScore,
} from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../../lib/supabase'
import { completeRound } from '../../../../lib/completeRound'
import { ShareableScorecardCard } from '../../../../components/round/ShareableScorecardCard'
import { RoundTeeSelector } from '../../../../components/round/RoundTeeSelector'
import { PastHoleShotsSheet } from '../../../../components/round/PastHoleShotsSheet'
import { PastRoundMap } from '../../../../components/round/PastRoundMap'
import { ScoreCell, TabSwitcher } from '../../../../components/round/PastScorecardParts'
import type { LatLng } from '../../../../components/round/HoleMap'
import LiveRoundSession from '../../../../components/round/LiveRoundSession'
import { useAuth } from '../../../../hooks/useAuth'
import { useUnits } from '../../../../hooks/useUnits'
import { FONT, TYPE } from '../../../../lib/typography'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']
type DrillRow = Database['public']['Tables']['drills']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

// Round entry route. Live (incomplete) rounds redirect into the hole
// flow; completed rounds render a read-only summary so a player viewing
// a past round from the home list isn't dropped back into the
// Mark-ball / Set-aim state machine.
export default function RoundIndex() {
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
  // Scorecard ⇄ Map tabs (#514): the scorecard edits scores/putts/details,
  // the map places ball + aim geometry. `mapHole` is the hole the map is
  // focused on; its prev/next nav drives it.
  const [view, setView] = useState<'scorecard' | 'map'>('scorecard')
  const [mapHole, setMapHole] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirectToLive, setRedirectToLive] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [savingSG, setSavingSG] = useState(false)
  const [shareTone, setShareTone] = useState<'light' | 'dark'>('light')
  // Selected hole for the read-only shots sheet. The sheet is the
  // entire past-round drill-down — we deliberately do NOT navigate
  // back into the live HoleScreen route on tap (mode=past would drop
  // the player into the place-ball state machine on a finalized round).
  const [shotsForHole, setShotsForHole] = useState<HoleRow | null>(null)
  const shareCardRef = useRef<View>(null)
  const { unit } = useUnits()
  const { user } = useAuth()
  // "Today's focus" nudge data — fetched lazily, only when the round has a leak.
  const [nudgeFacilities, setNudgeFacilities] = useState<string[]>([])
  const [nudgeDrills, setNudgeDrills] = useState<DrillRow[]>([])

  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      try {
        const { data: r, error: rErr } = await supabase
          .from('rounds')
          .select('*, courses(name, lat, lng)')
          .eq('id', id)
          .single()
        if (rErr || !r) throw rErr ?? new Error('Round not found')
        if (!active) return
        const row = r as RoundRow & {
          courses?: { name: string | null; lat: number | null; lng: number | null } | null
        }
        setRound(row)
        setCourseName(row.courses?.name ?? 'Round')
        setCourseCenter(
          row.courses?.lat != null && row.courses?.lng != null
            ? { lat: row.courses.lat, lng: row.courses.lng }
            : null,
        )
        // Live round signal: total_score is null while a LIVE round is in
        // progress. Past-round entry (#514) persists a total_score sentinel
        // at creation and lands here on the editable scorecard — never the
        // live map. The `mode !== 'past'` guard is belt-and-suspenders for
        // the first render before the sentinel round row is re-read.
        if (row.total_score == null && mode !== 'past') {
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
  }, [id])

  // "Today's focus" nudge (parity with web RoundSummary). No react-query on
  // mobile — gate the profile + drills fetch by hand, like web's
  // useProfile→useDrills.
  useEffect(() => {
    if (!round || round.total_score == null || !user) return
    const focus = pickRoundFocus(round)
    if (!focus) return
    let active = true
    ;(async () => {
      const { data: profile, error: pErr } = await getProfile(supabase, user.id)
      if (!active || pErr || !profile) return
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

  // Stable across renders — passing an inline arrow caused
  // LiveRoundSession's onHoleChange-keyed effect to re-fire on every
  // parent render, looping with router.setParams.
  const syncHoleToUrl = useCallback(
    (next: number) => router.setParams({ hole: String(next) }),
    [router],
  )

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
        onHoleChange={syncHoleToUrl}
      />
    )
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
  if (error || !round) {
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
        <Text style={[TYPE.body, { color: '#A33A2A', fontSize: 13 }]}>
          {error ?? 'Round not found'}
        </Text>
      </View>
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
      Alert.alert(
        'Leave this round?',
        "It isn't finished. Your scores and shots are saved — resume it anytime from Recent rounds on the Home screen.",
        [
          { text: 'Keep logging', style: 'cancel' },
          {
            text: 'Leave',
            style: 'destructive',
            onPress: () => router.replace('/(app)'),
          },
        ],
      )
      return
    }
    router.replace('/(app)')
  }

  // Delete the whole round. Mirrors web RoundHeader's Delete (RLS-gated
  // on user_id via deleteRound). No "End round early" here — this is the
  // past-round / review surface, not the live tracker (#514).
  function handleDelete() {
    if (!round || !user || deleting) return
    Alert.alert(
      'Delete round?',
      'This permanently removes the round and all its shots.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true)
            const { error: delErr } = await deleteRound(supabase, round.id, user.id)
            if (delErr) {
              setDeleting(false)
              Alert.alert('Delete failed', delErr.message)
              return
            }
            router.replace('/(app)')
          },
        },
      ],
    )
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
          .select('*, courses(name, lat, lng)')
          .eq('id', round.id)
          .single(),
        supabase.from('hole_scores').select('*').eq('round_id', round.id),
      ])
      if (rRes.data) {
        let saved = rRes.data as RoundRow & {
          courses?: { name: string | null } | null
        }
        // completeRound writes `total_score: totalScore || null`, so an
        // all-zero past round comes back null — which would re-strand it on
        // the live map on next open (#514). Preserve the non-null sentinel.
        if (saved.total_score == null) {
          await updateRound(supabase, round.id, { total_score: 0 }, user.id)
          saved = { ...saved, total_score: 0 }
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

  const sgRows: { label: string; value: number | null }[] = [
    { label: 'Off tee', value: round.sg_off_tee },
    { label: 'Approach', value: round.sg_approach },
    { label: 'Around green', value: round.sg_around_green },
    { label: 'Putting', value: round.sg_putting },
  ]
  const focus = pickRoundFocus(round)

  let runningScore = 0
  let runningPar = 0
  for (const h of sortedHoles) {
    const hs = scoresByHoleId.get(h.id)
    if (hs?.score != null && hs.score > 0) {
      runningScore += hs.score
      runningPar += h.par
    }
  }
  const diff = runningScore - runningPar

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingTop: insets.top + 14,
          paddingBottom: 14,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={handleLeave}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)' }}>← Home</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.45)', marginBottom: 4 }}>
            {round.played_at}
          </Text>
          <Text
            style={[TYPE.serif, {
              color: '#F2EEE5',
              fontSize: 17,
              fontWeight: '500',
              fontStyle: 'italic',
            }]}
          >
            {courseName}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share scorecard"
          accessibilityState={{ disabled: sharing }}
          onPress={handleShare}
          disabled={sharing}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6, opacity: sharing ? 0.5 : 1 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)' }}>
            {sharing ? 'Rendering…' : 'Share →'}
          </Text>
        </Pressable>
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
            }}
            holes={sortedHoles}
            scoresByHoleId={scoresByHoleId}
            tone={shareTone}
          />
        </View>
      </View>

      <TabSwitcher view={view} onChange={setView} />

      {view === 'scorecard' && (
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <View>
            <Text style={{ ...KICKER, marginBottom: 4 }}>Total</Text>
            <Text
              style={[TYPE.serifUpright, {
                color: '#1C211C',
                fontSize: 36,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }]}
            >
              {runningPar === 0 ? '—' : runningScore}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...KICKER, marginBottom: 4 }}>To par</Text>
            <Text
              style={[TYPE.serifUpright, {
                color:
                  diff < 0 ? '#1F3D2C' : diff > 0 ? '#A33A2A' : '#5C6356',
                fontSize: 28,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }]}
            >
              {runningPar === 0
                ? '—'
                : diff === 0
                  ? 'E'
                  : diff > 0
                    ? `+${diff}`
                    : `${diff}`}
            </Text>
          </View>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 14,
            marginBottom: 18,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 12 }}>Strokes gained</Text>
          {sgRows.map((row) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
              }}
            >
              <Text style={[TYPE.body, { color: '#1C211C', fontSize: 13 }]}>{row.label}</Text>
              <Text
                style={[TYPE.kicker, {
                  color:
                    row.value == null
                      ? '#8A8B7E'
                      : row.value > 0
                        ? '#1F3D2C'
                        : row.value < 0
                          ? '#A33A2A'
                          : '#5C6356',
                  fontSize: 13,
                  fontVariant: ['tabular-nums'],
                  fontWeight: '500',
                }]}
              >
                {row.value == null ? '—' : formatSG(row.value)}
              </Text>
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 8,
              marginTop: 4,
              borderTopWidth: 1,
              borderColor: '#EBE5D6',
            }}
          >
            <Text style={[TYPE.bodyBold, { color: '#1C211C', fontSize: 14, fontWeight: '600' }]}>
              Total
            </Text>
            <Text
              style={[TYPE.kicker, {
                color:
                  round.sg_total == null
                    ? '#8A8B7E'
                    : round.sg_total > 0
                      ? '#1F3D2C'
                      : round.sg_total < 0
                        ? '#A33A2A'
                        : '#5C6356',
                fontSize: 14,
                fontVariant: ['tabular-nums'],
                fontWeight: '600',
              }]}
            >
              {round.sg_total == null ? '—' : formatSG(round.sg_total)}
            </Text>
          </View>
        </View>

        {focus && (
          <RoundNudge
            focus={focus}
            picks={selectNudgeDrills(nudgeDrills, nudgeFacilities)}
          />
        )}

        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 14,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>Scorecard</Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: '#D9D2BF',
            }}
          >
            <Text style={{ ...KICKER, flex: 1, color: '#8A8B7E' }}>Hole</Text>
            <Text style={{ ...KICKER, width: 32, textAlign: 'right', color: '#8A8B7E' }}>
              Par
            </Text>
            <Text style={{ ...KICKER, width: 52, textAlign: 'right', color: '#8A8B7E' }}>
              Score
            </Text>
            <Text style={{ ...KICKER, width: 48, textAlign: 'right', color: '#8A8B7E' }}>
              Putts
            </Text>
            <Text style={{ ...KICKER, width: 84, textAlign: 'right', color: '#8A8B7E' }}>
              Shots
            </Text>
          </View>
          {sortedHoles.map((h) => {
            const hs = scoresByHoleId.get(h.id)
            const score = hs?.score ?? 0
            const putts = hs?.putts ?? null
            const d = score > 0 ? score - h.par : null
            const shotCount = hs ? holeScoreShotCount.get(hs.id) ?? 0 : 0
            const scoreColor =
              d == null
                ? '#1C211C'
                : d < 0
                  ? '#1F3D2C'
                  : d > 0
                    ? '#A33A2A'
                    : '#5C6356'
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottomWidth: 1,
                  borderColor: '#EBE5D6',
                  paddingHorizontal: 6,
                }}
              >
                <Text style={[TYPE.kicker, { flex: 1, fontSize: 15, color: '#1C211C' }]}>
                  {h.number}
                </Text>
                <Text
                  style={[TYPE.kicker, {
                    width: 32,
                    textAlign: 'right',
                    fontSize: 15,
                    color: '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }]}
                >
                  {h.par}
                </Text>
                <ScoreCell
                  value={score}
                  width={52}
                  color={scoreColor}
                  label={`Hole ${h.number} score`}
                  onCommit={(n) => persistHoleScore(h.id, { score: n })}
                />
                <ScoreCell
                  value={putts}
                  width={48}
                  color="#5C6356"
                  label={`Hole ${h.number} putts`}
                  onCommit={(n) => persistHoleScore(h.id, { putts: n > 0 ? n : null })}
                />
                <PressableTouch
                  accessibilityRole="button"
                  accessibilityLabel={
                    shotCount > 0
                      ? `Hole ${h.number}, ${shotCount} shots, edit`
                      : `Hole ${h.number}, add shots`
                  }
                  onPress={() => setShotsForHole(h)}
                  android_ripple={{ color: '#EBE5D6' }}
                  style={{ width: 84, paddingVertical: 12, alignItems: 'flex-end' }}
                >
                  <Text
                    style={[TYPE.body, {
                      fontSize: 13,
                      color: shotCount > 0 ? '#1F3D2C' : '#8A8B7E',
                    }]}
                  >
                    {shotCount > 0
                      ? `${shotCount} shot${shotCount === 1 ? '' : 's'} →`
                      : '+ add →'}
                  </Text>
                </PressableTouch>
              </View>
            )
          })}
        </View>

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

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save strokes gained"
          accessibilityState={{ disabled: savingSG }}
          onPress={handleSaveSG}
          disabled={savingSG}
          style={{
            marginTop: 28,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: savingSG ? '#5C6356' : '#1F3D2C',
            borderRadius: 2,
            opacity: savingSG ? 0.7 : 1,
          }}
        >
          <Text style={{ ...KICKER, color: '#F2EEE5' }}>
            {savingSG ? 'Saving…' : 'Save SG'}
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete round"
          accessibilityState={{ disabled: deleting }}
          onPress={handleDelete}
          disabled={deleting}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{
            marginTop: 16,
            paddingVertical: 12,
            alignItems: 'center',
            opacity: deleting ? 0.5 : 1,
          }}
        >
          <Text style={{ ...KICKER, color: '#A33A2A' }}>
            {deleting ? 'Deleting…' : 'Delete round'}
          </Text>
        </Pressable>
      </ScrollView>
      )}

      {view === 'map' && round && user && (
        <PastRoundMap
          roundId={round.id}
          userId={user.id}
          holes={sortedHoles}
          holeScores={holeScores}
          shots={shots}
          courseCenter={courseCenter}
          holeNumber={mapHole}
          onHoleChange={setMapHole}
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
            ? shots.filter(
                (s) =>
                  s.hole_score_id ===
                  scoresByHoleId.get(shotsForHole.id)?.id,
              )
            : []
        }
        unit={unit}
        onClose={() => setShotsForHole(null)}
        onShotUpdated={(updated) =>
          setShots((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
        }
      />
    </View>
  )
}

// Co-located post-round nudge — mirrors the web RoundSummary's RoundNudge.
// Chips are non-interactive: mobile has no drill-library route yet (the
// practice tab is a teaser), so there's nowhere honest to send a tap.
function RoundNudge({ focus, picks }: { focus: RoundFocus; picks: DrillRow[] }) {
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: '#D9D2BF',
        paddingTop: 14,
        marginBottom: 18,
      }}
    >
      <Text style={{ ...KICKER, marginBottom: 8 }}>Today's focus</Text>
      <Text
        style={[TYPE.serif, {
          color: '#1C211C',
          fontSize: 16,
          lineHeight: 22,
          fontStyle: 'italic',
          marginBottom: picks.length ? 12 : 0,
        }]}
      >
        {roundFocusHeadline(focus)}
      </Text>
      {picks.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {picks.map((drill) => (
            <View
              key={drill.id}
              style={{
                borderWidth: 1,
                borderColor: '#1F3D2C',
                borderRadius: 2,
                paddingVertical: 6,
                paddingHorizontal: 10,
              }}
            >
              <Text style={[TYPE.body, { color: '#1F3D2C', fontSize: 13 }]}>
                {drill.name}
                {drill.duration_min ? ` · ${drill.duration_min}m` : ''}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
