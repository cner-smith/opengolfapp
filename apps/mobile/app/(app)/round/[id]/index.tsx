import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { formatSG } from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../../lib/supabase'
import { ShareableScorecardCard } from '../../../../components/round/ShareableScorecardCard'
import { PastHoleShotsSheet } from '../../../../components/round/PastHoleShotsSheet'
import LiveRoundSession from '../../../../components/round/LiveRoundSession'
import { useUnits } from '../../../../hooks/useUnits'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']
type ShotRow = Database['public']['Tables']['shots']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [redirectToLive, setRedirectToLive] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [shareTone, setShareTone] = useState<'light' | 'dark'>('light')
  // Selected hole for the read-only shots sheet. The sheet is the
  // entire past-round drill-down — we deliberately do NOT navigate
  // back into the live HoleScreen route on tap (mode=past would drop
  // the player into the place-ball state machine on a finalized round).
  const [shotsForHole, setShotsForHole] = useState<HoleRow | null>(null)
  const shareCardRef = useRef<View>(null)
  const { unit } = useUnits()

  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      try {
        const { data: r, error: rErr } = await supabase
          .from('rounds')
          .select('*, courses(name)')
          .eq('id', id)
          .single()
        if (rErr || !r) throw rErr ?? new Error('Round not found')
        if (!active) return
        const row = r as RoundRow & { courses?: { name: string | null } | null }
        setRound(row)
        setCourseName(row.courses?.name ?? 'Round')
        // Live round signal: total_score is set when the round completes
        // (either Finish round or End round early). Anything else is
        // still in progress — drop into the hole flow via <Redirect>
        // on the next render so we can't navigate after unmount.
        if (row.total_score == null) {
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
  // Drives the scorecard row's tap affordance — a row is only tappable
  // if its hole has shots logged. Without this gate, the → arrow
  // promises content; tap opens a sheet that reads "No shots logged
  // for this hole." See #247.
  const holeScoreIdsWithShots = useMemo(
    () => new Set(shots.map((s) => s.hole_score_id)),
    [shots],
  )

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
        mode={mode === 'past' ? 'past' : 'live'}
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
        <Text style={{ color: '#A33A2A', fontSize: 13 }}>
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

  const sgRows: { label: string; value: number | null }[] = [
    { label: 'Off tee', value: round.sg_off_tee },
    { label: 'Approach', value: round.sg_approach },
    { label: 'Around green', value: round.sg_around_green },
    { label: 'Putting', value: round.sg_putting },
  ]

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
          onPress={() => router.replace('/(app)')}
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
            style={{
              color: '#F2EEE5',
              fontSize: 17,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
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
              style={{
                color: '#1C211C',
                fontSize: 36,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }}
            >
              {round.total_score ?? '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...KICKER, marginBottom: 4 }}>To par</Text>
            <Text
              style={{
                color:
                  diff < 0 ? '#1F3D2C' : diff > 0 ? '#A33A2A' : '#5C6356',
                fontSize: 28,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }}
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
              <Text style={{ color: '#1C211C', fontSize: 13 }}>{row.label}</Text>
              <Text
                style={{
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
                }}
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
            <Text style={{ color: '#1C211C', fontSize: 14, fontWeight: '600' }}>
              Total
            </Text>
            <Text
              style={{
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
              }}
            >
              {round.sg_total == null ? '—' : formatSG(round.sg_total)}
            </Text>
          </View>
        </View>

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
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: '#D9D2BF',
            }}
          >
            <Text style={{ ...KICKER, flex: 1, color: '#8A8B7E' }}>Hole</Text>
            <Text
              style={{ ...KICKER, width: 44, textAlign: 'right', color: '#8A8B7E' }}
            >
              Par
            </Text>
            <Text
              style={{ ...KICKER, width: 56, textAlign: 'right', color: '#8A8B7E' }}
            >
              Score
            </Text>
            <Text
              style={{ ...KICKER, width: 56, textAlign: 'right', color: '#8A8B7E' }}
            >
              +/−
            </Text>
            {/* Header spacer for the row affordance arrow. */}
            <Text style={{ width: 18, marginLeft: 6 }}> </Text>
          </View>
          {sortedHoles.map((h) => {
            const hs = scoresByHoleId.get(h.id)
            const score = hs?.score ?? null
            const d = score != null && score > 0 ? score - h.par : null
            const hasShots = hs ? holeScoreIdsWithShots.has(hs.id) : false
            return (
              <Pressable
                key={h.id}
                accessibilityRole={hasShots ? 'button' : 'text'}
                accessibilityLabel={
                  hasShots
                    ? `Hole ${h.number}, par ${h.par}, score ${score}, view shots`
                    : `Hole ${h.number}, par ${h.par}${score != null && score > 0 ? `, score ${score}` : ', not played'}`
                }
                onPress={hasShots ? () => setShotsForHole(h) : undefined}
                android_ripple={hasShots ? { color: '#EBE5D6' } : undefined}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: '#EBE5D6',
                  paddingHorizontal: 6,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: '#1C211C',
                  }}
                >
                  {h.number}
                </Text>
                <Text
                  style={{
                    width: 44,
                    textAlign: 'right',
                    fontSize: 15,
                    color: '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {h.par}
                </Text>
                <Text
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color: score != null && score > 0 ? '#1C211C' : '#8A8B7E',
                    fontVariant: ['tabular-nums'],
                    fontWeight: '500',
                  }}
                >
                  {score != null && score > 0 ? score : '—'}
                </Text>
                <Text
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color:
                      d == null
                        ? '#8A8B7E'
                        : d < 0
                          ? '#1F3D2C'
                          : d > 0
                            ? '#A33A2A'
                            : '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {d == null ? '—' : d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`}
                </Text>
                <Text
                  style={{
                    width: 18,
                    textAlign: 'right',
                    fontSize: 14,
                    color: '#8A8B7E',
                    marginLeft: 6,
                  }}
                >
                  {hasShots ? '→' : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
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
