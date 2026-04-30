import { useEffect, useMemo, useState } from 'react'
import { Dimensions, Pressable, ScrollView, Text, View } from 'react-native'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
import { getRecentSGData } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { AppBar } from '../../components/ui/AppBar'

const N_OPTIONS = [5, 10, 20] as const

const SERIES = [
  { key: 'sg_off_tee', label: 'Off tee', color: '#1F3D2C' },
  { key: 'sg_approach', label: 'Approach', color: '#A33A2A' },
  { key: 'sg_around_green', label: 'Around green', color: '#A66A1F' },
  { key: 'sg_putting', label: 'Putting', color: '#5C6356' },
] as const

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

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
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <AppBar
        eyebrow="Performance"
        title="Strokes Gained"
        right={
          <View
            style={{
              flexDirection: 'row',
              borderWidth: 1,
              borderColor: 'rgba(242,238,229,0.25)',
            }}
          >
            {N_OPTIONS.map((opt, i) => {
              const active = n === opt
              return (
                <Pressable
                  key={opt}
                  onPress={() => setN(opt)}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    backgroundColor: active ? '#1F3D2C' : 'transparent',
                    borderLeftWidth: i === 0 ? 0 : 1,
                    borderColor: 'rgba(242,238,229,0.25)',
                  }}
                >
                  <Text
                    style={{
                      color: active ? '#F2EEE5' : 'rgba(242,238,229,0.6)',
                      fontSize: 11,
                      fontWeight: '600',
                      letterSpacing: 0.3,
                    }}
                  >
                    L{opt}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        }
      />

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        {loading ? (
          <Text style={{ color: '#8A8B7E', fontSize: 13 }}>Loading…</Text>
        ) : rounds.length === 0 ? (
          <View
            style={{
              backgroundColor: '#FBF8F1',
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 4,
              padding: 22,
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
              Finalize a round to see SG trends per category.
            </Text>
          </View>
        ) : (
          <>
            <Section kicker="By the numbers">
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 14,
                }}
              >
                {avgs.map((s) => (
                  <View
                    key={s.key}
                    style={{
                      width: '47%',
                      backgroundColor: '#FBF8F1',
                      borderWidth: 1,
                      borderColor: '#D9D2BF',
                      borderRadius: 4,
                      padding: 14,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 2,
                          backgroundColor: s.color,
                        }}
                      />
                      <Text style={KICKER}>{s.label}</Text>
                    </View>
                    <Text
                      style={{
                        fontSize: 26,
                        fontStyle: 'italic',
                        fontWeight: '500',
                        color:
                          s.value > 0
                            ? '#1F3D2C'
                            : s.value < 0
                              ? '#A33A2A'
                              : '#5C6356',
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {s.value > 0 ? '+' : ''}
                      {s.value.toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>

            <Section kicker={`SG by category — last ${rounds.length} rounds`}>
              <VictoryChart
                height={260}
                width={screenWidth - 36}
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
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: { fontSize: 9, fill: '#8A8B7E' },
                    grid: { stroke: 'transparent' },
                  }}
                />
                <VictoryAxis
                  dependentAxis
                  style={{
                    axis: { stroke: '#D9D2BF' },
                    tickLabels: { fontSize: 9, fill: '#8A8B7E' },
                    grid: { stroke: '#EBE5D6' },
                  }}
                />
                {SERIES.map((s) => (
                  <VictoryLine
                    key={s.key}
                    data={ordered.map((r) => ({
                      x: new Date(r.played_at).getTime(),
                      y: r[s.key] ?? 0,
                    }))}
                    style={{ data: { stroke: s.color, strokeWidth: 1.5 } }}
                  />
                ))}
              </VictoryChart>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 14,
                  marginTop: 8,
                }}
              >
                {SERIES.map((s) => (
                  <View
                    key={s.key}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <View
                      style={{ width: 10, height: 2, backgroundColor: s.color }}
                    />
                    <Text style={{ color: '#5C6356', fontSize: 11 }}>
                      {s.label}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          </>
        )}
      </ScrollView>
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
