import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import type { Database } from '@oga/supabase'
import type { ResolvedHole } from '@oga/core'
import { useSwipeToDismiss } from '../ui/useSwipeToDismiss'
import { FONT, TYPE } from '../../lib/typography'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
  fontFamily: FONT.mono,
}

interface ScorecardModalProps {
  holes: HoleRow[]
  holeScores: HoleScoreRow[]
  /** Tee-resolved par (hole_tees override for the round's selected tee,
   *  if any, over base holes.par), keyed by hole number. Renders all
   *  holes, not just the active one, so it needs the full map rather
   *  than useHoleData's single-hole resolvedHole. */
  resolvedHoleByNumber: Map<number, ResolvedHole>
  currentHoleNumber: number
  onJumpToHole: (n: number) => void
  /** Tap-to-cycle par 3 → 4 → 5 → 3 for holes that came back with no
   *  layout data (yards null + tee coords null — typical OSM-only rows).
   *  Optional so callers that don't yet wire the update can still mount
   *  the modal read-only. */
  onChangePar?: (holeId: string, newPar: number) => void
  onClose: () => void
}

export function ScorecardModal({
  holes,
  holeScores,
  resolvedHoleByNumber,
  currentHoleNumber,
  onJumpToHole,
  onChangePar,
  onClose,
}: ScorecardModalProps) {
  const scoresByHoleId = useMemo(
    () => new Map(holeScores.map((hs) => [hs.hole_id, hs])),
    [holeScores],
  )
  const sorted = useMemo(
    () => [...holes].sort((a, b) => a.number - b.number),
    [holes],
  )
  const hasSyntheticHoles = sorted.some(
    (h) => !h.yards && h.tee_lat == null,
  )
  const [hintDismissed, setHintDismissed] = useState(false)
  const { pan, cardStyle } = useSwipeToDismiss(onClose)
  let runningTotal = 0
  let runningPar = 0
  return (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} />
      <Animated.View
        style={[
          {
            backgroundColor: '#FBF8F1',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            paddingHorizontal: 18,
            paddingTop: 14,
            paddingBottom: 28,
            maxHeight: '85%',
          },
          cardStyle,
        ]}
      >
        <GestureDetector gesture={pan}>
          <View style={{ alignItems: 'center', paddingBottom: 14 }}>
            <View
              style={{
                width: 32,
                height: 4,
                borderRadius: 2,
                backgroundColor: '#D9D2BF',
              }}
            />
          </View>
        </GestureDetector>
        <Text
          style={{
            ...KICKER,
            color: '#8A8B7E',
            marginBottom: 6,
          }}
        >
          Scorecard
        </Text>
        {hasSyntheticHoles && !hintDismissed && onChangePar && (
          <View
            style={{
              marginBottom: 10,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderWidth: 1,
              borderColor: '#D9D2BF',
              borderRadius: 2,
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
            }}
          >
            <Text style={[TYPE.body, { flex: 1, fontSize: 13, color: '#5C6356', lineHeight: 18 }]}>
              No course layout found. Par defaults to 4 — tap to edit.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss notice"
              onPress={() => setHintDismissed(true)}
              hitSlop={8}
            >
              <Text style={{ ...KICKER, color: '#8A8B7E' }}>Dismiss</Text>
            </Pressable>
          </View>
        )}
        <ScrollView
          style={{ maxHeight: '90%' }}
          showsVerticalScrollIndicator={false}
        >
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
          {sorted.map((h) => {
            const hs = scoresByHoleId.get(h.id)
            // Treat 0 the same as null — `hole_scores` rows can be
            // pre-created with score=0 before any shots are logged, and
            // counting those as played pulls the running total deeply
            // under par for unplayed holes (the live round looked like
            // -71 after hole 1).
            const rawScore = hs?.score
            const score = rawScore != null && rawScore > 0 ? rawScore : null
            // Per-round par override (#710), then tee-resolved par —
            // resolvedHoleByNumber already folds the round override in.
            const par = resolvedHoleByNumber.get(h.number)?.par ?? hs?.par ?? h.par
            if (score != null) {
              runningTotal += score
              runningPar += par
            }
            const diff = score != null ? score - par : null
            const active = h.number === currentHoleNumber
            // Editable par only for holes that came back without any
            // layout data — for OSM-mapped holes par is authoritative
            // and should be display-only.
            const isSynthetic = !h.yards && h.tee_lat == null
            const parEditable = !!onChangePar && isSynthetic
            return (
              <Pressable
                key={h.id}
                accessibilityRole="button"
                accessibilityLabel={`Jump to hole ${h.number}, par ${par}${score != null ? `, score ${score}` : ''}`}
                accessibilityState={{ selected: active }}
                onPress={() => onJumpToHole(h.number)}
                style={{
                  flexDirection: 'row',
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderColor: '#EBE5D6',
                  backgroundColor: active ? '#EBE5D6' : 'transparent',
                  paddingHorizontal: 6,
                  borderRadius: 2,
                }}
              >
                <Text
                  style={[TYPE.kicker, {
                    flex: 1,
                    fontSize: 15,
                    color: '#1C211C',
                    fontWeight: active ? '600' : '400',
                  }]}
                >
                  {h.number}
                </Text>
                {parEditable ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Par ${par}, tap to change`}
                    onPress={() => {
                      const next = par === 3 ? 4 : par === 4 ? 5 : 3
                      onChangePar?.(h.id, next)
                    }}
                    hitSlop={6}
                    style={{
                      width: 44,
                      alignItems: 'flex-end',
                      paddingVertical: 2,
                      paddingHorizontal: 4,
                    }}
                  >
                    <Text
                      style={[TYPE.kicker, {
                        fontSize: 15,
                        color: '#5C6356',
                        fontVariant: ['tabular-nums'],
                        textDecorationLine: 'underline',
                        textDecorationStyle: 'dotted',
                        textDecorationColor: '#9F9580',
                      }]}
                    >
                      {par}
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={[TYPE.kicker, {
                      width: 44,
                      textAlign: 'right',
                      fontSize: 15,
                      color: '#5C6356',
                      fontVariant: ['tabular-nums'],
                    }]}
                  >
                    {par}
                  </Text>
                )}
                <Text
                  style={[TYPE.kicker, {
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color: score != null ? '#1C211C' : '#8A8B7E',
                    fontVariant: ['tabular-nums'],
                    fontWeight: '500',
                  }]}
                >
                  {score ?? '—'}
                </Text>
                <Text
                  style={[TYPE.kicker, {
                    width: 56,
                    textAlign: 'right',
                    fontSize: 15,
                    color:
                      diff == null
                        ? '#8A8B7E'
                        : diff < 0
                          ? '#1F3D2C'
                          : diff > 0
                            ? '#A33A2A'
                            : '#5C6356',
                    fontVariant: ['tabular-nums'],
                  }]}
                >
                  {diff == null ? '—' : diff === 0 ? 'E' : diff > 0 ? `+${diff}` : `${diff}`}
                </Text>
              </Pressable>
            )
          })}
          <View
            style={{
              flexDirection: 'row',
              paddingVertical: 12,
              borderTopWidth: 1,
              borderColor: '#9F9580',
              marginTop: 4,
              paddingHorizontal: 6,
            }}
          >
            <Text style={[TYPE.bodyBold, { flex: 1, fontSize: 14, fontWeight: '600', color: '#1C211C' }]}>
              Total played
            </Text>
            <Text
              style={[TYPE.kicker, {
                width: 44,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: '600',
                color: '#1C211C',
                fontVariant: ['tabular-nums'],
              }]}
            >
              {runningPar}
            </Text>
            <Text
              style={[TYPE.kicker, {
                width: 56,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: '600',
                color: '#1C211C',
                fontVariant: ['tabular-nums'],
              }]}
            >
              {runningTotal}
            </Text>
            <Text
              style={[TYPE.kicker, {
                width: 56,
                textAlign: 'right',
                fontSize: 14,
                fontWeight: '600',
                color:
                  runningPar === 0
                    ? '#8A8B7E'
                    : runningTotal - runningPar < 0
                      ? '#1F3D2C'
                      : runningTotal - runningPar > 0
                        ? '#A33A2A'
                        : '#5C6356',
                fontVariant: ['tabular-nums'],
              }]}
            >
              {runningPar === 0
                ? '—'
                : runningTotal === runningPar
                  ? 'E'
                  : runningTotal - runningPar > 0
                    ? `+${runningTotal - runningPar}`
                    : `${runningTotal - runningPar}`}
            </Text>
          </View>
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close scorecard"
          onPress={onClose}
          style={{
            marginTop: 14,
            paddingVertical: 12,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#D9D2BF',
            borderRadius: 2,
          }}
        >
          <Text style={{ ...KICKER, color: '#5C6356' }}>Close</Text>
        </Pressable>
      </Animated.View>
    </View>
  )
}
