import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
import { getRecentSGData } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { AppBar } from '../../components/ui/AppBar'

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getRecentSGData(supabase, user.id, n).then(({ data }: { data: any }) => {
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

  const ordered = [...rounds].reverse()

  return (
    <View style={{ flex: 1, backgroundColor: '#F4F4F0' }}>
      <AppBar
        eyebrow="Performance"
        title="Strokes Gained"
        right={
          <View
            style={{
              flexDirection: 'row',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 7,
              padding: 2,
            }}
          >
            {N_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setN(opt)}
                style={{
                  paddingHorizontal: 9,
                  paddingVertical: 4,
                  borderRadius: 5,
                  backgroundColor: n === opt ? '#FFFFFF' : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: n === opt ? '#111111' : 'rgba(255,255,255,0.55)',
                    fontSize: 11,
                    fontWeight: '500',
                  }}
                >
                  L{opt}
                </Text>
              </Pressable>
            ))}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 32 }}>
        {loading ? (
          <Text style={{ color: '#888880', fontSize: 13 }}>Loading…</Text>
        ) : rounds.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FFFFFF',
              borderWidth: 0.5,
              borderColor: '#E4E4E0',
              borderRadius: 10,
              padding: 24,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#111111', fontSize: 15, fontWeight: '500' }}>
              No rounds with strokes gained yet
            </Text>
            <Text
              style={{
                color: '#888880',
                fontSize: 13,
                marginTop: 6,
                textAlign: 'center',
              }}
            >
              Finalize a round to see SG trends per category.
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 12,
              }}
            >
              {avgs.map((s) => (
                <View
                  key={s.key}
                  style={{
                    width: '48%',
                    backgroundColor: '#FFFFFF',
                    borderWidth: 0.5,
                    borderColor: '#E4E4E0',
                    borderRadius: 10,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: s.color,
                      }}
                    />
                    <Text style={{ color: '#888880', fontSize: 11 }}>{s.label}</Text>
                  </View>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: '500',
                      color:
                        s.value > 0
                          ? '#0F6E56'
                          : s.value < 0
                            ? '#A32D2D'
                            : '#888880',
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {s.value > 0 ? '+' : ''}
                    {s.value.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 0.5,
                borderColor: '#E4E4E0',
                borderRadius: 10,
                padding: 12,
              }}
            >
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
                SG by category — last {rounds.length} rounds
              </Text>
              <VictoryChart
                height={260}
                width={screenWidth - 56}
                padding={{ top: 16, right: 12, bottom: 28, left: 32 }}
              >
                <VictoryAxis
                  tickFormat={(t) =>
                    new Date(t).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })
                  }
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
                    grid: { stroke: '#F0F0EC' },
                  }}
                />
                {SERIES.map((s) => (
                  <VictoryLine
                    key={s.key}
                    data={ordered.map((r) => ({
                      x: new Date(r.played_at).getTime(),
                      y: r[s.key] ?? 0,
                    }))}
                    style={{ data: { stroke: s.color, strokeWidth: 2 } }}
                  />
                ))}
              </VictoryChart>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 12,
                  marginTop: 8,
                }}
              >
                {SERIES.map((s) => (
                  <View
                    key={s.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: s.color,
                      }}
                    />
                    <Text style={{ color: '#888880', fontSize: 10 }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  )
}
