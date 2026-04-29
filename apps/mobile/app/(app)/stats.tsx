import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import {
  VictoryAxis,
  VictoryChart,
  VictoryLegend,
  VictoryLine,
} from 'victory-native'
import { getRecentSGData } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'

const N_OPTIONS = [5, 10, 20] as const

const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1D9E75' },
  { key: 'sg_approach', label: 'Approach', color: '#E24B4A' },
  { key: 'sg_around_green', label: 'Around green', color: '#EF9F27' },
  { key: 'sg_putting', label: 'Putting', color: '#378ADD' },
] as const

interface RecentRound {
  played_at: string
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
  sg_total: number | null
  total_score: number | null
}

export default function Stats() {
  const { user } = useAuth()
  const [n, setN] = useState<number>(10)
  const [rounds, setRounds] = useState<RecentRound[]>([])
  const [loading, setLoading] = useState(true)
  const screenWidth = Dimensions.get('window').width

  useEffect(() => {
    if (!user) return
    let active = true
    setLoading(true)
    getRecentSGData(supabase, user.id, n).then(({ data }) => {
      if (!active) return
      setRounds((data as RecentRound[]) ?? [])
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [user?.id, n])

  const avgs = useMemo(
    () =>
      SERIES.map((s) => {
        const values = rounds.map((r) => r[s.key]).filter((v): v is number => v !== null)
        const a = values.length === 0 ? 0 : values.reduce((x, y) => x + y, 0) / values.length
        return { ...s, value: a }
      }),
    [rounds],
  )

  const chartWidth = screenWidth - 48
  const ordered = [...rounds].reverse()

  return (
    <ScrollView className="flex-1 bg-fairway-50" contentContainerStyle={{ padding: 16 }}>
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-fairway-700">Strokes Gained</Text>
        <View className="flex-row rounded bg-white p-1">
          {N_OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setN(opt)}
              className={
                n === opt ? 'rounded bg-fairway-500 px-3 py-1' : 'rounded px-3 py-1'
              }
            >
              <Text className={n === opt ? 'text-xs text-white' : 'text-xs text-gray-700'}>
                Last {opt}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {loading ? (
        <Text className="text-sm text-gray-500">Loading…</Text>
      ) : rounds.length === 0 ? (
        <View className="rounded-lg bg-white p-6">
          <Text className="text-sm text-gray-600">No rounds with SG data yet.</Text>
        </View>
      ) : (
        <>
          <View className="mb-4 grid grid-cols-2 gap-2" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {avgs.map((s) => (
              <View key={s.key} style={{ width: '48%' }} className="rounded-lg bg-white p-3">
                <Text className="text-xs text-gray-500">{s.label}</Text>
                <Text
                  className={
                    s.value > 0
                      ? 'text-2xl font-bold text-emerald-700'
                      : s.value < 0
                        ? 'text-2xl font-bold text-red-700'
                        : 'text-2xl font-bold text-gray-700'
                  }
                >
                  {s.value > 0 ? '+' : ''}
                  {s.value.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View className="rounded-lg bg-white p-3">
            <Text className="mb-1 text-xs font-semibold uppercase text-gray-500">
              Per-category SG over last {rounds.length} rounds
            </Text>
            <VictoryChart height={260} width={chartWidth}>
              <VictoryLegend
                x={0}
                y={0}
                orientation="horizontal"
                gutter={12}
                style={{ labels: { fontSize: 9 } }}
                data={SERIES.map((s) => ({
                  name: s.label,
                  symbol: { fill: s.color },
                }))}
              />
              <VictoryAxis style={{ tickLabels: { fontSize: 9 } }} />
              <VictoryAxis dependentAxis style={{ tickLabels: { fontSize: 9 } }} />
              {SERIES.map((s) => (
                <VictoryLine
                  key={s.key}
                  data={ordered.map((r, i) => ({ x: i + 1, y: r[s.key] ?? 0 }))}
                  style={{ data: { stroke: s.color, strokeWidth: 2 } }}
                />
              ))}
            </VictoryChart>
          </View>
        </>
      )}
    </ScrollView>
  )
}
