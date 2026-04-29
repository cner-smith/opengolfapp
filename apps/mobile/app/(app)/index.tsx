import { useEffect, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { VictoryAxis, VictoryBar, VictoryChart, VictoryLine } from 'victory-native'
import { getProfile, getRecentSGData } from '@oga/supabase'
import type { Database } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { syncPendingShots } from '../../lib/sync'
import { pendingCount } from '../../lib/db'

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

const CATEGORIES = [
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

  const breakdown = CATEGORIES.map((c) => {
    const values = rounds.map((r) => r[c.key]).filter((v): v is number => v !== null)
    const avg = values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
    return { x: c.label, y: Number(avg.toFixed(2)) }
  })

  const trend = [...rounds].reverse().map((r, i) => ({
    x: i + 1,
    y: r.sg_total ?? 0,
  }))

  const chartWidth = screenWidth - 48

  return (
    <ScrollView className="flex-1 bg-fairway-50" contentContainerStyle={{ padding: 16 }}>
      <Text className="text-2xl font-bold text-fairway-700">OGA</Text>
      {profile?.handicap_index != null ? (
        <Text className="mb-4 text-sm text-gray-500">
          Handicap {profile.handicap_index}
          {profile.skill_level ? ` · ${profile.skill_level}` : ''}
        </Text>
      ) : (
        <Text className="mb-4 text-sm text-gray-500">Live round tracker</Text>
      )}

      <Link href="/(app)/round/new" asChild>
        <Pressable className="mb-4 items-center rounded-lg bg-fairway-500 py-4">
          <Text className="text-base font-semibold text-white">+ Start round</Text>
        </Pressable>
      </Link>

      {pending > 0 && (
        <View className="mb-4 rounded bg-amber-50 p-3">
          <Text className="text-sm text-amber-900">
            {pending} shot{pending === 1 ? '' : 's'} waiting to sync
          </Text>
        </View>
      )}

      {rounds.length === 0 ? (
        <View className="mb-4 rounded-lg bg-white p-6">
          <Text className="text-sm text-gray-600">
            Log a round to see strokes-gained data here.
          </Text>
        </View>
      ) : (
        <>
          <View className="mb-4 rounded-lg bg-white p-3">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              SG breakdown (avg)
            </Text>
            <VictoryChart height={200} width={chartWidth} domainPadding={{ x: 16 }}>
              <VictoryAxis style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryBar data={breakdown} style={{ data: { fill: '#1D9E75' } }} />
            </VictoryChart>
          </View>

          <View className="mb-4 rounded-lg bg-white p-3">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              SG total trend
            </Text>
            <VictoryChart height={200} width={chartWidth}>
              <VictoryAxis style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryLine
                data={trend}
                style={{ data: { stroke: '#1D9E75', strokeWidth: 2 } }}
              />
            </VictoryChart>
          </View>
        </>
      )}

      <Text className="mb-2 text-xs font-semibold uppercase text-gray-500">
        Recent rounds
      </Text>
      {rounds.length === 0 ? (
        <Text className="text-sm text-gray-500">No rounds yet.</Text>
      ) : (
        rounds.slice(0, 5).map((r) => (
          <Link key={r.id} href={`/(app)/round/${r.id}`} asChild>
            <Pressable className="mb-2 rounded bg-white px-4 py-3">
              <Text className="font-medium text-gray-900">
                {r.courses?.name ?? 'Round'}
              </Text>
              <Text className="text-xs text-gray-500">
                {r.played_at}
                {r.total_score ? ` · ${r.total_score}` : ''}
                {r.sg_total !== null
                  ? ` · SG ${r.sg_total > 0 ? '+' : ''}${r.sg_total.toFixed(2)}`
                  : ''}
              </Text>
            </Pressable>
          </Link>
        ))
      )}
    </ScrollView>
  )
}
