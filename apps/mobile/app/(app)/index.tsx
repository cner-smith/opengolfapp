import { useEffect, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
import { getProfile, getRecentSGData } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'
import { AppBar } from '../../components/ui/AppBar'

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

export default function Home() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rounds, setRounds] = useState<RecentRound[]>([])
  const [pending, setPending] = useState(0)
  const screenWidth = Dimensions.get('window').width

  useEffect(() => {
    if (!user) return
    let active = true
    getProfile(supabase, user.id).then(({ data }) => {
      if (active && data) setProfile(data)
    })
    getRecentSGData(supabase, user.id, 20).then(({ data }) => {
      if (active && data) setRounds(data as RecentRound[])
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

  return (
    <View className="flex-1 bg-oga-bg-page">
      <AppBar
        eyebrow={eyebrow}
        title={profile?.username ?? 'Home'}
      />
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        <Link href="/(app)/round/new" asChild>
          <Pressable
            style={{
              backgroundColor: '#111111',
              borderRadius: 10,
              paddingVertical: 14,
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 13, fontWeight: '500' }}>
              + Start round
            </Text>
          </Pressable>
        </Link>

        {pending > 0 && (
          <View
            style={{
              backgroundColor: '#FAEEDA',
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#854F0B', fontSize: 12 }}>
              {pending} shot{pending === 1 ? '' : 's'} waiting to sync
            </Text>
          </View>
        )}

        {rounds.length === 0 ? (
          <Card>
            <Text
              style={{ color: '#111111', fontSize: 15, fontWeight: '500' }}
            >
              No rounds logged yet
            </Text>
            <Text
              style={{
                color: '#888880',
                fontSize: 13,
                marginTop: 6,
              }}
            >
              Log your first round to start tracking strokes gained.
            </Text>
          </Card>
        ) : (
          <>
            <Card label="SG breakdown">
              <View style={{ gap: 10 }}>
                {breakdown.map((b) => (
                  <SGBar key={b.key} label={b.label} value={b.value} max={maxAbs} />
                ))}
              </View>
            </Card>

            <View style={{ height: 12 }} />

            <Card label="SG total trend">
              <VictoryChart
                height={200}
                width={screenWidth - 56}
                padding={{ top: 10, right: 16, bottom: 28, left: 32 }}
              >
                <VictoryAxis
                  style={{
                    axis: { stroke: '#E4E4E0' },
                    tickLabels: { fontSize: 9, fill: '#888880' },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: '#E4E4E0' },
                    tickLabels: { fontSize: 9, fill: '#888880' },
                    grid: { stroke: '#F0F0EC', strokeDasharray: '0' },
                  }}
                />
                <VictoryLine
                  data={trend}
                  style={{ data: { stroke: '#1D9E75', strokeWidth: 2 } }}
                />
              </VictoryChart>
            </Card>

            <View style={{ height: 12 }} />
          </>
        )}

        <Text
          style={{
            color: '#888880',
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 6,
          }}
        >
          Recent rounds
        </Text>
        {rounds.length === 0 ? (
          <Text style={{ color: '#888880', fontSize: 13 }}>No rounds yet.</Text>
        ) : (
          rounds.slice(0, 5).map((r) => (
            <Link key={r.id} href={`/(app)/round/${r.id}`} asChild>
              <Pressable
                style={{
                  backgroundColor: '#FFFFFF',
                  borderRadius: 10,
                  borderWidth: 0.5,
                  borderColor: '#E4E4E0',
                  padding: 12,
                  marginBottom: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text
                    style={{ color: '#111111', fontSize: 14, fontWeight: '500' }}
                  >
                    {r.courses?.name ?? 'Round'}
                  </Text>
                  <Text style={{ color: '#888880', fontSize: 11 }}>
                    {r.played_at}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text
                    style={{
                      color: '#111111',
                      fontSize: 16,
                      fontWeight: '500',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {r.total_score ?? '—'}
                  </Text>
                  <SGPill value={r.sg_total} />
                </View>
              </Pressable>
            </Link>
          ))
        )}
      </ScrollView>
    </View>
  )
}

function Card({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 0.5,
        borderColor: '#E4E4E0',
        padding: 14,
      }}
    >
      {label && (
        <Text
          style={{
            color: '#888880',
            fontSize: 11,
            fontWeight: '500',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {label}
        </Text>
      )}
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
  const fill = value > 0 ? '#1D9E75' : value < 0 ? '#E24B4A' : '#AAAAAA'
  const textColor = value > 0 ? '#0F6E56' : value < 0 ? '#A32D2D' : '#888880'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <Text style={{ color: '#888880', fontSize: 12, width: 92 }}>{label}</Text>
      <View
        style={{
          flex: 1,
          height: 7,
          backgroundColor: '#F0F0EC',
          borderRadius: 4,
          position: 'relative',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1,
            backgroundColor: '#E4E4E0',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: isPositive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            backgroundColor: fill,
            borderRadius: 4,
          }}
        />
      </View>
      <Text
        style={{
          color: textColor,
          fontSize: 12,
          fontWeight: '500',
          width: 44,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value > 0 ? '+' : ''}
        {value.toFixed(2)}
      </Text>
    </View>
  )
}

function SGPill({ value }: { value: number | null }) {
  if (value === null) {
    return <Text style={{ color: '#AAAAAA', fontSize: 11 }}>—</Text>
  }
  const pos = value > 0
  const neg = value < 0
  const bg = pos ? '#E1F5EE' : neg ? '#FCEBEB' : '#F1EFE8'
  const fg = pos ? '#0F6E56' : neg ? '#A32D2D' : '#5F5E5A'
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          color: fg,
          fontSize: 11,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        SG {value > 0 ? '+' : ''}
        {value.toFixed(2)}
      </Text>
    </View>
  )
}
