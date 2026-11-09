import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { DeviceEventEmitter, Pressable, ScrollView, Text, View } from 'react-native'
import { formatSG, homeSummary, isStaleEmptyRound } from '@oga/core'
import { deleteRound, getProfile, getRecentRounds } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useActiveRound } from '../../hooks/useActiveRound'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'
import { clearScreenCache, getCached, setCached } from '../../lib/screenCache'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Entrance } from '../../components/ui/Entrance'
import { ResumeRoundBanner } from '../../components/home/ResumeRoundBanner'
import { SGBreakdown } from '../../components/home/SGBreakdown'
import { SGTrendChart } from '../../components/home/SGTrendChart'
import {
  ImportHistoryLink,
  LogPastRoundCTA,
  StartLiveRoundCTA,
} from '../../components/home/RoundCTAs'
import {
  RecentRoundsList,
  type RecentRoundRow,
} from '../../components/home/RecentRoundsList'
import { LearnPreview } from '../../components/home/LearnPreview'
import { IntroTour } from '../../components/onboarding/IntroTour'
import { introTourSeen, markIntroTourSeen } from '../../lib/introTour'
import { TYPE } from '../../lib/typography'
import { PaperTile, SectionHead, StatTile } from '../../components/paper/Section'
import { FONT_CAP, P } from '../../components/paper/tokens'
import { PaperSurface } from '../../components/paper/Paper'

type Profile = Database['public']['Tables']['profiles']['Row']

interface RecentRound extends RecentRoundRow {
  created_at: string
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
}

export default function Home() {
  const { user } = useAuth()
  const router = useRouter()
  const { replayTour } = useLocalSearchParams<{ replayTour?: string }>()
  // Seed from the screen cache so a revisit renders instantly; the focus
  // fetch below always re-runs and replaces this (#599).
  const [profile, setProfile] = useState<Profile | null>(
    () => getCached<Profile>('home:profile') ?? null,
  )
  const [rounds, setRounds] = useState<RecentRound[]>(
    () => getCached<RecentRound[]>('home:rounds') ?? [],
  )
  // A genuinely-new user has no cache → starts true (rounds not loaded yet);
  // a returning user with cache → starts false, harmless since their
  // rounds.length === 0 is already false. Drives the intro-tour anti-race gate.
  const [roundsLoading, setRoundsLoading] = useState(
    () => getCached<RecentRound[]>('home:rounds') == null,
  )
  const activeRound = useActiveRound()
  const [pending, setPending] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [tourSeen, setTourSeen] = useState<boolean | null>(null) // null = not yet read

  // The "yardage book" preview lives at the bottom of the scroll; the hint
  // up top scrolls to it (captured y is relative to the scroll content
  // since the preview is a direct child of the contentContainer).
  const scrollRef = useRef<ScrollView>(null)
  const learnYRef = useRef(0)
  const scrollToLearn = useCallback(() => {
    scrollRef.current?.scrollTo({ y: learnYRef.current, animated: true })
  }, [])

  const handleDelete = useCallback(
    async (id: string) => {
      if (!user) return
      setDeleting(true)
      try {
        const { error } = await deleteRound(supabase, id, user.id)
        if (error) throw error
        // Wipe ALL cached screens — a stale rounds-list or round-detail
        // cache would resurrect the deleted round as a ghost (#705 redux).
        clearScreenCache()
        // The round screen stays mounted behind this one; tell it (#613).
        DeviceEventEmitter.emit('oga:roundDeleted', id)
        setRounds((prev) => prev.filter((r) => r.id !== id))
      } finally {
        setDeleting(false)
        setPendingDelete(null)
      }
    },
    [user],
  )

  // Focus effect, not a mount effect: router.replace('/(app)') after a
  // delete can land on an already-mounted home instance, and a mount-only
  // fetch then keeps showing the deleted round until the app restarts —
  // the user swipe-deletes a ghost that's already gone server-side (#705).
  // Same pattern as useActiveRound's banner query directly above.
  useFocusEffect(
    useCallback(() => {
      if (!user) return
      let active = true
      getProfile(supabase, user.id).then(({ data, error }) => {
        if (!active) return
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[home/getProfile]', error.message)
          return
        }
        if (data) {
          setProfile(data as unknown as Profile)
          setCached('home:profile', data)
        }
      })
      // 2× buffer so the stats can reach 20 whole rounds past any partials (#935).
      getRecentRounds(supabase, user.id, 40).then(({ data, error }) => {
        if (!active) return
        if (error) {
          // eslint-disable-next-line no-console
          console.error('[home/getRecentRounds]', error.message)
          // Deliberately leave roundsLoading=true here — a fetch error means we
          // don't actually know the round count, so keep the intro-tour gate
          // suppressed (fail closed) rather than risk a false zero-data trigger.
          return
        }
        if (data) {
          // Old rounds with no scored hole stay off Home (#1055).
          const kept = (data as RecentRound[]).filter((r) => !isStaleEmptyRound(r))
          setRounds(kept)
          setCached('home:rounds', kept)
        }
        setRoundsLoading(false)
      })
      return () => {
        active = false
      }
    }, [user?.id]),
  )

  useFocusEffect(
    useCallback(() => {
      // The flag is per account: re-read when the signed-in user changes.
      if (!user) return
      let active = true
      introTourSeen(user.id).then((seen) => {
        if (active) setTourSeen(seen)
      })
      return () => {
        active = false
      }
    }, [user?.id]),
  )

  // A user with any round history (or a live round) is not a first-run user;
  // persist "seen" so deleting down to zero rounds can't re-trigger the intro
  // tour. This runs independently of the tourSeen read above, so it also
  // covers an existing user whose "seen" flag was never set (the flag is
  // brand-new — see autoShow comment below).
  useEffect(() => {
    if (user && (rounds.length > 0 || activeRound)) {
      setTourSeen(true)
      markIntroTourSeen(user.id)
    }
  }, [user?.id, rounds.length, activeRound])

  // Auto-show ONLY for a genuinely-new user: flag unseen AND a fully-LOADED
  // Home with zero rounds and no active round. Gating on the flag alone would
  // show the tour to the entire existing base (the flag is brand-new); and an
  // activeRound is excluded from the rounds list, so check it explicitly —
  // otherwise a mid-round user sees "Start my first round" and orphans their
  // live round into a duplicate. Do NOT trigger before rounds load
  // (empty-initial-state != zero rounds), so require the loading flag false.
  const autoShow =
    tourSeen === false && !roundsLoading && rounds.length === 0 && !activeRound
  // Replay (Task 6) navigates here with ?replayTour=1 and bypasses the
  // zero-data gate — an explicit request works for any user. `!pendingDelete`
  // keeps the tour Modal from co-presenting with the delete ConfirmDialog (#293).
  const showTour = !pendingDelete && (replayTour === '1' || autoShow)
  // Synchronous hide (recomputes showTour=false); markIntroTourSeen() persists
  // fire-and-forget, and clearing the replay param stops a re-focus re-firing it.
  const dismissTour = () => {
    setTourSeen(true)
    if (user) markIntroTourSeen(user.id)
    router.setParams({ replayTour: undefined })
  }

  useEffect(() => {
    if (!user) return
    pendingCount(user.id).then(setPending)
    syncPendingShots()
      .then(() => pendingCount(user.id).then(setPending))
      .catch(() => undefined)
  }, [user?.id])

  // The newest 20 whole rounds' summary, shared with the web Dashboard
  // (#1427): ended-early rounds stay out (#911), a missing SG category is not
  // counted, and a round with no SG is not a trend point.
  const summary = useMemo(() => homeSummary(rounds), [rounds])
  const wholeRounds = summary.whole
  // x is an ordinal over the kept rounds, so the points sit evenly spaced.
  const trend = useMemo(() => summary.trend.map((t, i) => ({ x: i + 1, y: t.sg, date: t.date })), [summary])

  const firstName = profile?.username?.split(/\s+/)[0]
  const hour = new Date().getHours()
  const hello = `Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}`

  return (
    <PaperSurface style={{ flex: 1 }}>
      <IntroTour
        visible={showTour}
        onDismiss={dismissTour}
        onStartRound={() => {
          dismissTour()
          router.push('/(app)/round/new?mode=live')
        }}
      />
      <AppBar title="Home" />
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Entrance index={0}>
        <Text
          style={[
            TYPE.serif,
            {
              color: '#1C211C',
              fontSize: 28,
              lineHeight: 32,
              marginBottom: 6,
            },
          ]}
        >
          {firstName ? `${hello}, ${firstName}.` : `${hello}.`}
        </Text>
        <Text style={[TYPE.body, { color: '#5C6356', fontSize: 14, marginBottom: 10 }]}>
          {wholeRounds.length === 0
            ? 'No full rounds yet'
            : `Last ${wholeRounds.length} round${wholeRounds.length === 1 ? '' : 's'}`}
          {profile?.handicap_index != null ? ` · Handicap ${profile.handicap_index}` : ''}
        </Text>
        <Pressable onPress={scrollToLearn} hitSlop={6} style={{ marginBottom: 22 }}>
          <Text style={[TYPE.bodyItalic, { color: '#8A8B7E', fontSize: 13 }]}>
            ↓ New to a stat? The yardage book's at the bottom.
          </Text>
        </Pressable>
        </Entrance>

        {summary.finding != null && (
          <Entrance index={1}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 19, lineHeight: 25, marginBottom: 20 }]}>
              {summary.finding}
            </Text>
          </Entrance>
        )}

        <Entrance index={2}>
          {activeRound && <ResumeRoundBanner round={activeRound} />}
          {!activeRound && <StartLiveRoundCTA />}
          <LogPastRoundCTA />
        </Entrance>

        {wholeRounds.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 28 }}>
            <StatTile style={{ flex: 1 }} label="Average score" value={summary.avgScore != null ? summary.avgScore.toFixed(1) : '—'} />
            <StatTile
              style={{ flex: 1 }}
              label="Strokes gained"
              value={formatSG(summary.totalSG)}
              valueColor={summary.totalSG > 0 ? P.forest : summary.totalSG < 0 ? P.neg : P.ink}
            />
          </View>
        )}

        {pending > 0 && (
          <View style={{ marginBottom: 18 }}>
            <SectionHead title="Sync queue" style={{ marginBottom: 4 }} />
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.warn, fontSize: 13 }]}>
              {pending} shot{pending === 1 ? '' : 's'} waiting to sync.
            </Text>
          </View>
        )}

        <Entrance index={3}>
        {wholeRounds.length === 0 ? (
          <PaperTile style={{ marginBottom: 28 }} innerStyle={{ padding: 22 }}>
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[
                TYPE.serif,
                {
                  color: P.ink,
                  fontSize: 22,
                },
              ]}
            >
              {rounds.length === 0 ? 'No rounds yet.' : 'No full rounds yet.'}
            </Text>
            <Text
              maxFontSizeMultiplier={FONT_CAP}
              style={[
                TYPE.body,
                {
                  color: P.inkDim,
                  fontSize: 14,
                  marginTop: 8,
                  lineHeight: 20,
                },
              ]}
            >
              {rounds.length === 0
                ? 'Log your first round, or bring your history from another app, to start tracking strokes gained.'
                : 'Finish a full round to see your strokes gained.'}
            </Text>
            {/* The start-round actions sit above this tile; the import is
                the other way in for a player switching apps. */}
            {rounds.length === 0 && (
              <View style={{ marginTop: 10 }}>
                <ImportHistoryLink />
              </View>
            )}
          </PaperTile>
        ) : (
          <View style={{ marginBottom: 28 }}>
            <SGBreakdown areas={summary.areas} maxAbs={summary.maxAbs} count={wholeRounds.length} />
            <SGTrendChart data={trend} />
          </View>
        )}
        </Entrance>

        <Entrance index={4}>
          <RecentRoundsList
            // Exclude the active round — it already shows as the Resume banner
            // above. Without this it renders in both places, so deleting it
            // clears both and reads as "deleted two rounds". (#639)
            rounds={rounds.filter((r) => r.id !== activeRound?.id)}
            onRequestDelete={(id, name) => setPendingDelete({ id, name })}
          />
        </Entrance>

        <View
          onLayout={(e) => {
            learnYRef.current = e.nativeEvent.layout.y
          }}
        >
          <LearnPreview />
        </View>
      </ScrollView>
      <ConfirmDialog
        visible={!!pendingDelete}
        title="Delete this round?"
        message={
          pendingDelete
            ? `${pendingDelete.name} will be removed along with its hole scores and shots. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete.id)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </PaperSurface>
  )
}
