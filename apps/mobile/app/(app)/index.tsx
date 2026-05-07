import { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView, Text, View } from 'react-native'
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

type Profile = Database['public']['Tables']['profiles']['Row']

interface RecentRound extends RecentRoundRow {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
}

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
  const trend = useMemo(
    () =>
      [...rounds]
        .reverse()
        .flatMap((r, i) =>
          r.sg_total == null ? [] : [{ x: i + 1, y: r.sg_total }],
        ),
    [rounds],
  )

  const eyebrow =
    profile?.handicap_index != null
      ? `Handicap ${profile.handicap_index}`
      : 'Welcome'
  const firstName = profile?.username?.split(/\s+/)[0]

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar eyebrow={eyebrow} title={profile?.username ?? 'Home'} />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
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
        <Text style={{ color: '#5C6356', fontSize: 14, marginBottom: 22 }}>
          Last {trend.length} round{trend.length === 1 ? '' : 's'}
        </Text>

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
