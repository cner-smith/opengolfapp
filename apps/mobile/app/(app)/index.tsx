import { useCallback, useEffect, useRef, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
import { Swipeable } from 'react-native-gesture-handler'
import { formatSG } from '@oga/core'
import { deleteRound, getProfile, getRecentSGData } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'
import { AppBar } from '../../components/ui/AppBar'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'

type Profile = Database['public']['Tables']['profiles']['Row']

interface RecentRound {
  id: string
  played_at: string
  total_score: number | null
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  sg_total: number | null
  courses?: { name: string | null } | null
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
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export default function Home() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rounds, setRounds] = useState<RecentRound[]>([])
  const [pending, setPending] = useState(0)
  const [pendingDelete, setPendingDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map())
  const screenWidth = Dimensions.get('window').width

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
        swipeRefs.current.delete(id)
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

  const breakdown = SG_KEYS.map((c) => {
    const values = rounds.map((r) => r[c.key]).filter((v): v is number => v !== null)
    const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
    return { ...c, value: Number(avg.toFixed(2)) }
  })
  const maxAbs = Math.max(...breakdown.map((b) => Math.abs(b.value)), 0.5)

  const trend = [...rounds].reverse().map((r, i) => ({
    x: i + 1,
    y: r.sg_total ?? 0,
  }))

  const eyebrow =
    profile?.handicap_index != null ? `Handicap ${profile.handicap_index}` : 'Welcome'
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
          Last {rounds.length || 0} round{rounds.length === 1 ? '' : 's'}
        </Text>

        <Link href="/(app)/round/new?mode=live" asChild>
          <Pressable
            style={{
              backgroundColor: '#1F3D2C',
              borderRadius: 2,
              paddingVertical: 18,
              alignItems: 'center',
              marginBottom: 6,
            }}
          >
            <Text
              style={{
                color: '#F2EEE5',
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 0.4,
              }}
            >
              ▶  Start live round
            </Text>
          </Pressable>
        </Link>
        <Text
          style={{
            color: '#5C6356',
            fontSize: 12,
            textAlign: 'center',
            marginBottom: 14,
          }}
        >
          Track shots in real time with GPS
        </Text>

        <Link href="/(app)/round/new?mode=past" asChild>
          <Pressable
            style={{
              borderWidth: 1,
              borderColor: '#1F3D2C',
              backgroundColor: 'transparent',
              borderRadius: 2,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 22,
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
              +  Log past round
            </Text>
          </Pressable>
        </Link>

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
            <Section kicker="SG breakdown">
              <View style={{ gap: 14 }}>
                {breakdown.map((b) => (
                  <SGBar key={b.key} label={b.label} value={b.value} max={maxAbs} />
                ))}
              </View>
            </Section>

            <Section kicker="SG total trend">
              <VictoryChart
                height={200}
                width={screenWidth - 36}
                padding={{ top: 12, right: 16, bottom: 28, left: 32 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: {
                      fontSize: 9,
                      fill: '#8A8B7E',
                      fontFamily: 'JetBrainsMono-Medium',
                    },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: {
                      fontSize: 9,
                      fill: '#8A8B7E',
                      fontFamily: 'JetBrainsMono-Medium',
                    },
                    grid: { stroke: '#EBE5D6', strokeDasharray: '0' },
                  }}
                />
                <VictoryLine
                  data={trend}
                  style={{ data: { stroke: '#1F3D2C', strokeWidth: 1.5 } }}
                />
              </VictoryChart>
            </Section>
          </>
        )}

        <Section kicker="Recent rounds">
          {rounds.length === 0 ? (
            <Text style={{ color: '#8A8B7E', fontSize: 13 }}>No rounds yet.</Text>
          ) : (
            <View style={{ borderTopWidth: 1, borderColor: '#D9D2BF' }}>
              {rounds.slice(0, 5).map((r) => (
                <Swipeable
                  key={r.id}
                  ref={(ref) => {
                    swipeRefs.current.set(r.id, ref)
                  }}
                  renderRightActions={() => (
                    <Pressable
                      onPress={() => {
                        swipeRefs.current.get(r.id)?.close()
                        setPendingDelete({
                          id: r.id,
                          name: r.courses?.name ?? 'this round',
                        })
                      }}
                      style={{
                        backgroundColor: '#A33A2A',
                        justifyContent: 'center',
                        alignItems: 'center',
                        paddingHorizontal: 22,
                      }}
                    >
                      <Text
                        style={{
                          color: '#F2EEE5',
                          fontSize: 13,
                          fontWeight: '600',
                          letterSpacing: 0.3,
                        }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  )}
                  overshootRight={false}
                >
                  <Link href={`/(app)/round/${r.id}`} asChild>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingVertical: 14,
                        paddingHorizontal: 4,
                        borderBottomWidth: 1,
                        borderColor: '#D9D2BF',
                        backgroundColor: '#F2EEE5',
                      }}
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text
                          style={{
                            ...KICKER,
                            color: '#8A8B7E',
                            marginBottom: 4,
                          }}
                        >
                          {r.played_at}
                        </Text>
                        <Text
                          style={{
                            color: '#1C211C',
                            fontSize: 17,
                            fontWeight: '500',
                            fontStyle: 'italic',
                          }}
                        >
                          {r.courses?.name ?? 'Round'}
                        </Text>
                      </View>
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'baseline',
                          gap: 14,
                        }}
                      >
                        <Text
                          style={{
                            color: '#1C211C',
                            fontSize: 22,
                            fontWeight: '500',
                            fontVariant: ['tabular-nums'],
                          }}
                        >
                          {r.total_score ?? '—'}
                        </Text>
                        <SGValue value={r.sg_total} />
                      </View>
                    </Pressable>
                  </Link>
                </Swipeable>
              ))}
            </View>
          )}
        </Section>
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

function Section({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <View style={{ marginBottom: 28 }}>
      <View
        style={{
          borderTopWidth: 1,
          borderColor: '#D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <Text style={KICKER}>{kicker}</Text>
      </View>
      {children}
    </View>
  )
}

function SGBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = Math.min(Math.abs(value) / max, 1) * 50
  const isPositive = value > 0
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#8A8B7E'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ color: '#1C211C', fontSize: 13, width: 100 }}>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 8,
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 4,
            height: 1,
            backgroundColor: '#D9D2BF',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1,
            backgroundColor: '#9F9580',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 1,
            bottom: 1,
            left: isPositive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={{
          color,
          fontSize: 15,
          fontStyle: 'italic',
          fontWeight: '500',
          width: 56,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatSG(value)}
      </Text>
    </View>
  )
}

function SGValue({ value }: { value: number | null }) {
  if (value === null) {
    return <Text style={{ color: '#8A8B7E', fontSize: 17 }}>—</Text>
  }
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#5C6356'
  return (
    <Text
      style={{
        color,
        fontSize: 17,
        fontStyle: 'italic',
        fontWeight: '500',
        fontVariant: ['tabular-nums'],
      }}
    >
      {formatSG(value)}
    </Text>
  )
}
