import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { formatSG } from '@oga/core'
import type { Database } from '@oga/supabase'
import { supabase } from '../../../../lib/supabase'

type RoundRow = Database['public']['Tables']['rounds']['Row']
type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

// Round entry route. Live (incomplete) rounds redirect into the hole
// flow; completed rounds render a read-only summary so a player viewing
// a past round from the home list isn't dropped back into the
// Mark-ball / Set-aim state machine.
export default function RoundIndex() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [round, setRound] = useState<RoundRow | null>(null)
  const [holes, setHoles] = useState<HoleRow[]>([])
  const [holeScores, setHoleScores] = useState<HoleScoreRow[]>([])
  const [courseName, setCourseName] = useState<string>('Round')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let active = true
    ;(async () => {
      try {
        const { data: r, error: rErr } = await supabase
          .from('rounds')
          .select('*, courses(name)')
          .eq('id', id)
          .single()
        if (rErr || !r) throw rErr ?? new Error('Round not found')
        if (!active) return
        const row = r as RoundRow & { courses?: { name: string | null } | null }
        setRound(row)
        setCourseName(row.courses?.name ?? 'Round')
        // Live round signal: total_score is set when the round completes
        // (either Finish round or End round early). Anything else is
        // still in progress — drop into the hole flow.
        if (row.total_score == null) {
          router.replace(`/(app)/round/${id}/hole/1?mode=live`)
          return
        }
        const [hRes, hsRes] = await Promise.all([
          supabase
            .from('holes')
            .select('*')
            .eq('course_id', row.course_id)
            .order('number'),
          supabase.from('hole_scores').select('*').eq('round_id', row.id),
        ])
        if (!active) return
        if (hRes.error) throw hRes.error
        if (hsRes.error) throw hsRes.error
        setHoles(hRes.data ?? [])
        setHoleScores(hsRes.data ?? [])
      } catch (err) {
        if (!active) return
        setError((err as Error).message)
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [id])

  const scoresByHoleId = useMemo(
    () => new Map(holeScores.map((hs) => [hs.hole_id, hs])),
    [holeScores],
  )
  const sortedHoles = useMemo(
    () => [...holes].sort((a, b) => a.number - b.number),
    [holes],
  )

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
        }}
      >
        <ActivityIndicator color="#1F3D2C" />
      </View>
    )
  }
  if (error || !round) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F2EEE5',
          padding: 18,
        }}
      >
        <Text style={{ color: '#A33A2A', fontSize: 13 }}>
          {error ?? 'Round not found'}
        </Text>
      </View>
    )
  }

  const sgRows: { label: string; value: number | null }[] = [
    { label: 'Off tee', value: round.sg_off_tee },
    { label: 'Approach', value: round.sg_approach },
    { label: 'Around green', value: round.sg_around_green },
    { label: 'Putting', value: round.sg_putting },
  ]

  let runningScore = 0
  let runningPar = 0
  for (const h of sortedHoles) {
    const hs = scoresByHoleId.get(h.id)
    if (hs?.score != null && hs.score > 0) {
      runningScore += hs.score
      runningPar += h.par
    }
  }
  const diff = runningScore - runningPar

  return (
    <View style={{ flex: 1, backgroundColor: '#F2EEE5' }}>
      <View
        style={{
          backgroundColor: '#1C211C',
          paddingTop: 52,
          paddingBottom: 14,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Pressable
          onPress={() => router.replace('/(app)')}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={{ padding: 6 }}
        >
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.6)' }}>← Home</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ ...KICKER, color: 'rgba(242,238,229,0.45)', marginBottom: 4 }}>
            {round.played_at}
          </Text>
          <Text
            style={{
              color: '#F2EEE5',
              fontSize: 17,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
          >
            {courseName}
          </Text>
        </View>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <View>
            <Text style={{ ...KICKER, marginBottom: 4 }}>Total</Text>
            <Text
              style={{
                color: '#1C211C',
                fontSize: 36,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }}
            >
              {round.total_score ?? '—'}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ ...KICKER, marginBottom: 4 }}>To par</Text>
            <Text
              style={{
                color:
                  diff < 0 ? '#1F3D2C' : diff > 0 ? '#A33A2A' : '#5C6356',
                fontSize: 28,
                fontWeight: '500',
                fontVariant: ['tabular-nums'],
              }}
            >
              {runningPar === 0
                ? '—'
                : diff === 0
                  ? 'E'
                  : diff > 0
                    ? `+${diff}`
                    : `${diff}`}
            </Text>
          </View>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 14,
            marginBottom: 18,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 12 }}>Strokes gained</Text>
          {sgRows.map((row) => (
            <View
              key={row.label}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: 6,
              }}
            >
              <Text style={{ color: '#1C211C', fontSize: 13 }}>{row.label}</Text>
              <Text
                style={{
                  color:
                    row.value == null
                      ? '#8A8B7E'
                      : row.value > 0
                        ? '#1F3D2C'
                        : row.value < 0
                          ? '#A33A2A'
                          : '#5C6356',
                  fontSize: 13,
                  fontVariant: ['tabular-nums'],
                  fontWeight: '500',
                }}
              >
                {row.value == null ? '—' : formatSG(row.value)}
              </Text>
            </View>
          ))}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              paddingTop: 8,
              marginTop: 4,
              borderTopWidth: 1,
              borderColor: '#EBE5D6',
            }}
          >
            <Text style={{ color: '#1C211C', fontSize: 14, fontWeight: '600' }}>
              Total
            </Text>
            <Text
              style={{
                color:
                  round.sg_total == null
                    ? '#8A8B7E'
                    : round.sg_total > 0
                      ? '#1F3D2C'
                      : round.sg_total < 0
                        ? '#A33A2A'
                        : '#5C6356',
                fontSize: 14,
                fontVariant: ['tabular-nums'],
                fontWeight: '600',
              }}
            >
              {round.sg_total == null ? '—' : formatSG(round.sg_total)}
            </Text>
          </View>
        </View>

        <View
          style={{
            borderTopWidth: 1,
            borderColor: '#D9D2BF',
            paddingTop: 14,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>Scorecard</Text>
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderColor: '#D9D2BF',
            }}
          >
            <Text style={{ ...KICKER, flex: 1, color: '#8A8B7E' }}>Hole</Text>
            <Text
              style={{ ...KICKER, width: 44, textAlign: 'right', color: '#8A8B7E' }}
            >
              Par
            </Text>
            <Text
              style={{ ...KICKER, width: 56, textAlign: 'right', color: '#8A8B7E' }}
            >
              Score
            </Text>
            <Text
              style={{ ...KICKER, width: 56, textAlign: 'right', color: '#8A8B7E' }}
            >
              +/−
            </Text>
          </View>
          {sortedHoles.map((h) => {
            const hs = scoresByHoleId.get(h.id)
            const score = hs?.score ?? null
            const d = score != null && score > 0 ? score - h.par : null
            return (
              <View
                key={h.id}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: '#EBE5D6',
                  paddingHorizontal: 6,
                }}
              >
                <Text
                  style={{
                    flex: 1,
                    fontSize: 15,
                    color: '#1C211C',
                  }}
                >
                  {h.number}
                </Text>
                <Text
                  style={{
                    width: 44,
                    textAlign: 'right',
                    fontSize: 15,
                    color: '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {h.par}
                </Text>
                <Text
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color: score != null && score > 0 ? '#1C211C' : '#8A8B7E',
                    fontVariant: ['tabular-nums'],
                    fontWeight: '500',
                  }}
                >
                  {score != null && score > 0 ? score : '—'}
                </Text>
                <Text
                  style={{
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color:
                      d == null
                        ? '#8A8B7E'
                        : d < 0
                          ? '#1F3D2C'
                          : d > 0
                            ? '#A33A2A'
                            : '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {d == null ? '—' : d === 0 ? 'E' : d > 0 ? `+${d}` : `${d}`}
                </Text>
              </View>
            )
          })}
        </View>
      </ScrollView>
    </View>
  )
}
