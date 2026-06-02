import { useRef } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Link } from 'expo-router'
import { Swipeable } from 'react-native-gesture-handler'
import { formatSG } from '@oga/core'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  fontFamily: 'Inconsolata-Medium',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

export interface RecentRoundRow {
  id: string
  played_at: string
  total_score: number | null
  sg_total: number | null
  courses?: { name: string | null } | null
}

interface RecentRoundsListProps {
  rounds: RecentRoundRow[]
  onRequestDelete: (id: string, name: string) => void
}

export function RecentRoundsList({
  rounds,
  onRequestDelete,
}: RecentRoundsListProps) {
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map())

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
        <Text style={KICKER}>Recent rounds</Text>
      </View>
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
                  accessibilityRole="button"
                  accessibilityLabel={`Delete round at ${r.courses?.name ?? 'this round'}`}
                  onPress={() => {
                    swipeRefs.current.get(r.id)?.close()
                    swipeRefs.current.delete(r.id)
                    onRequestDelete(r.id, r.courses?.name ?? 'this round')
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
                  accessibilityRole="button"
                  accessibilityLabel={`Open round at ${r.courses?.name ?? 'unknown course'} on ${r.played_at}`}
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
                    <Text style={{ ...KICKER, color: '#8A8B7E', marginBottom: 4 }}>
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
          {rounds.length > 5 && (
            <Link href="/(app)/rounds" asChild>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="See all rounds"
                style={{
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                  alignItems: 'flex-end',
                }}
              >
                <Text style={{ color: '#8A8B7E', fontSize: 13, fontWeight: '500' }}>
                  See all rounds →
                </Text>
              </Pressable>
            </Link>
          )}
        </View>
      )}
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
