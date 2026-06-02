import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { formatSG } from '@oga/core'
import { deleteRound, getProfile, getRecentSGData } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useActiveRound } from '../../hooks/useActiveRound'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ResumeRoundBanner } from '../../components/home/ResumeRoundBanner'
import { SGBreakdown } from '../../components/home/SGBreakdown'
import { SGTrendChart } from '../../components/home/SGTrendChart'
import {
  LogPastRoundCTA,
  StartLiveRoundCTA,
} from '../../components/home/RoundCTAs'
import {
  RecentRoundsList,
  type RecentRoundRow,
} from '../../components/home/RecentRoundsList'
import { LearnPreview } from '../../components/home/LearnPreview'

type Profile = Database['public']['Tables']['profiles']['Row']

interface RecentRound extends RecentRoundRow {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
}

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  fontFamily: 'JetBrainsMono-Medium',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function Home() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rounds, setRounds] = useState<RecentRound[]>([])
  const activeRound = useActiveRound()
  const [pending, setPending] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

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
        setRounds((prev) => prev.filter((r) => r.id !== id))
      } finally {
        setDeleting(false)
        setPendingDelete(null)
      }
    },
    [user],
  )

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[home/getProfile]', error.message)
        return
      }
      if (data) setProfile(data as unknown as Profile)
    })
    getRecentSGData(supabase, user.id, 20).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[home/getRecentSGData]', error.message)
        return
      }
      if (data) setRounds(data as RecentRound[])
    })
    return () => {
      active = false
    }
  }, [user?.id])

  useEffect(() => {
    pendingCount().then(setPending)
    syncPendingShots()
      .then(() => pendingCount().then(setPending))
      .catch(() => undefined)
  }, [])

  // Skip rounds with no sg_total — null → 0 would anchor the line
  // at zero on rounds the user never finalized SG for, and the SG
  // breakdown averages (which filter nulls) would no longer match.
  // Use a separate ordinal counter (not the source-array index) so the
  // x values stay 1..N over the kept rounds — flatMap's `i` runs over
  // the full reversed array including null-filtered entries, which
  // would otherwise produce sparse ordinals like [1, 3, 5] and a
  // visually gapped axis.
  const trend = useMemo(() => {
    let seq = 0
    return [...rounds]
      .reverse()
      .flatMap((r) =>
        r.sg_total == null ? [] : [{ x: ++seq, y: r.sg_total }],
      )
  }, [rounds])

  const homeStats = useMemo(() => {
    const avgs = SG_KEYS.map((c) => {
      const values = rounds.map((r) => r[c.key]).filter((v): v is number => v !== null)
      const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
      return { ...c, value: Number(avg.toFixed(2)) }
    })
    const scoreRounds = rounds.filter((r) => r.total_score !== null)
    const avgScore = scoreRounds.length > 0
      ? scoreRounds.reduce((s, r) => s + (r.total_score ?? 0), 0) / scoreRounds.length
      : null
    const totalSG = avgs.reduce((s, a) => s + a.value, 0)
    const sorted = [...avgs].sort((a, b) => b.value - a.value)
    return { avgScore, totalSG, weakest: sorted[sorted.length - 1]!, strongest: sorted[0]! }
  }, [rounds])

  const eyebrow =
    profile?.handicap_index != null
      ? `Handicap ${profile.handicap_index}`
      : 'Welcome'
  const firstName = profile?.username?.split(/\s+/)[0]

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar eyebrow={eyebrow} title={profile?.username ?? 'Home'} />
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <Text
          style={{
            color: '#1C211C',
            fontSize: 28,
            fontStyle: 'italic',
            fontWeight: '500',
            lineHeight: 32,
            marginBottom: 6,
          }}
        >
          {firstName ? `Good round, ${firstName}.` : 'Good round.'}
        </Text>
        <Text style={{ color: '#5C6356', fontSize: 14, marginBottom: 10 }}>
          Last {rounds.length} round{rounds.length === 1 ? '' : 's'}
        </Text>
        <Pressable onPress={scrollToLearn} hitSlop={6} style={{ marginBottom: 22 }}>
          <Text style={{ color: '#8A8B7E', fontSize: 13, fontStyle: 'italic' }}>
            ↓ New to a stat? The yardage book's at the bottom.
          </Text>
        </Pressable>

        {rounds.length > 0 && (
          <>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 16,
                fontStyle: 'italic',
                lineHeight: 24,
                marginBottom: 22,
              }}
            >
              {homeStats.weakest.value >= 0 ? (
                <>Everything is net positive. <Text style={{ fontWeight: '600' }}>{homeStats.strongest.label}</Text> leads at {fmtSG(homeStats.strongest.value)} a round.</>
              ) : (
                <><Text style={{ fontWeight: '600' }}>{homeStats.weakest.label}.</Text> Your biggest leak — costing about {fmtAbs(homeStats.weakest.value)} a round. {homeStats.strongest.label.toLowerCase()} is the bright spot at {fmtSG(homeStats.strongest.value)}.</>
              )}
            </Text>

            <View style={{ marginBottom: 28 }}>
              <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF', paddingTop: 14, marginBottom: 14 }}>
                <Text style={KICKER}>By the numbers</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                <HomeTile label="Avg score" value={homeStats.avgScore != null ? homeStats.avgScore.toFixed(1) : '—'} />
                <HomeTile
                  label="SG total"
                  value={formatSG(homeStats.totalSG)}
                  valueColor={homeStats.totalSG > 0 ? '#1F3D2C' : homeStats.totalSG < 0 ? '#A33A2A' : '#1C211C'}
                />
                <HomeTile label="Rounds" value={rounds.length.toString()} />
                <HomeTile label="Categories" value={SG_KEYS.length.toString()} />
              </View>
            </View>
          </>
        )}

        {activeRound && <ResumeRoundBanner round={activeRound} />}
        {!activeRound && <StartLiveRoundCTA />}
        <LogPastRoundCTA />

        {pending > 0 && (
          <View
            style={{
              borderTopWidth: 1,
              borderBottomWidth: 1,
              borderColor: '#D9D2BF',
              paddingVertical: 12,
              marginBottom: 18,
            }}
          >
            <Text style={{ ...KICKER, marginBottom: 4 }}>Sync queue</Text>
            <Text style={{ color: '#A66A1F', fontSize: 13 }}>
              {pending} shot{pending === 1 ? '' : 's'} waiting to sync.
            </Text>
          </View>
        )}

        {rounds.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: '#D9D2BF',
              backgroundColor: '#FBF8F1',
              padding: 22,
              borderRadius: 4,
            }}
          >
            <Text
              style={{
                color: '#1C211C',
                fontSize: 22,
                fontStyle: 'italic',
                fontWeight: '500',
              }}
            >
              No rounds yet.
            </Text>
            <Text
              style={{
                color: '#5C6356',
                fontSize: 14,
                marginTop: 8,
                lineHeight: 20,
              }}
            >
              Log your first round to start tracking strokes gained.
            </Text>
          </View>
        ) : (
          <>
            <SGBreakdown rounds={rounds} />
            <SGTrendChart data={trend} />
          </>
        )}

        <RecentRoundsList
          rounds={rounds}
          onRequestDelete={(id, name) => setPendingDelete({ id, name })}
        />

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
    </View>
  )
}

function HomeTile({
  label,
  value,
  valueColor = '#1C211C',
}: {
  label: string
  value: string
  valueColor?: string
}) {
  return (
    <View
      style={{
        width: '47%',
        backgroundColor: '#FBF8F1',
        borderWidth: 1,
        borderColor: '#D9D2BF',
        borderRadius: 4,
        padding: 14,
      }}
    >
      <Text style={{ color: '#8A8B7E', fontSize: 10, fontWeight: '500', fontFamily: 'JetBrainsMono-Medium', letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </Text>
      <Text style={{ color: valueColor, fontSize: 28, fontStyle: 'italic', fontWeight: '500', fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  )
}

function fmtSG(value: number): string {
  return value === 0 ? 'even' : `${formatSG(value)} strokes`
}

function fmtAbs(value: number): string {
  return `${Math.abs(value).toFixed(1)} strokes`
}
