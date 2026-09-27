import { useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { Database } from '@oga/supabase'
import type { ResolvedHole } from '@oga/core'
import { useSwipeToDismiss } from '../ui/useSwipeToDismiss'
import { TYPE } from '../../lib/typography'
import { PaperSurface, Rocker } from '../paper/Paper'
import { GolfMark } from '../paper/GolfMark'
import { Icon } from '../paper/icons'
import { P, R } from '../paper/tokens'

type HoleRow = Database['public']['Tables']['holes']['Row']
type HoleScoreRow = Database['public']['Tables']['hole_scores']['Row']

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

const COL = { par: 56, score: 64, toPar: 56 }

const signed = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `−${-n}`)

// Live scorecard sheet (#611 §10): paper, square top corners, golf marks
// around the scores, the current hole on raised paper with a brass bar.
// Close with ✕, a scrim tap, a swipe down, or Back.
export function ScorecardModal({
  holes,
  holeScores,
  resolvedHoleByNumber,
  currentHoleNumber,
  onJumpToHole,
  onChangePar,
  onClose,
}: ScorecardModalProps) {
  const scoresByHoleId = useMemo(() => new Map(holeScores.map((hs) => [hs.hole_id, hs])), [holeScores])
  const sorted = useMemo(() => [...holes].sort((a, b) => a.number - b.number), [holes])
  const hasSyntheticHoles = sorted.some((h) => !h.yards && h.tee_lat == null)
  const [hintDismissed, setHintDismissed] = useState(false)
  const eighteen = sorted.length > 9
  const [nine, setNine] = useState<'front' | 'back'>(currentHoleNumber > 9 ? 'back' : 'front')
  const { pan, cardStyle } = useSwipeToDismiss(onClose)
  const insets = useSafeAreaInsets()

  // Every hole's par / score, and the running to-par over the whole round.
  let run = 0
  let played = false
  const rows = sorted.map((h) => {
    const hs = scoresByHoleId.get(h.id)
    // 0 = pre-created, unplayed (counting it pulled the running total to -71).
    const score = hs?.score != null && hs.score > 0 ? hs.score : null
    // Per-round par override (#710), then tee-resolved par.
    const par = resolvedHoleByNumber.get(h.number)?.par ?? hs?.par ?? h.par
    if (score != null) {
      run += score - par
      played = true
    }
    return { h, par, score, run: score != null ? run : null }
  })
  const shown = eighteen ? rows.filter((r) => (nine === 'front' ? r.h.number <= 9 : r.h.number > 9)) : rows
  const sumPar = shown.reduce((a, r) => a + r.par, 0)
  const sumScore = shown.reduce((a, r) => a + (r.score ?? 0), 0)
  const sumToPar = shown.reduce((a, r) => a + (r.score != null ? r.score - r.par : 0), 0)
  const sub = !played ? 'No holes scored yet' : run === 0 ? 'Even so far' : `${Math.abs(run)} ${run < 0 ? 'under' : 'over'} so far`

  return (
    <View style={{ flex: 1, backgroundColor: P.scrim }}>
      <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close scorecard" />
      <Animated.View style={[{ maxHeight: '85%' }, cardStyle]}>
        <PaperSurface
          style={{
            borderTopWidth: 1,
            borderColor: P.ink,
            borderTopLeftRadius: R,
            borderTopRightRadius: R,
            paddingBottom: insets.bottom,
            flexShrink: 1,
          }}
        >
          <GestureDetector gesture={pan}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingLeft: 22 }}>
              <View style={{ flex: 1, paddingVertical: 8 }}>
                <Text style={[TYPE.serif, { fontSize: 26, lineHeight: 30, color: P.ink }]}>
                  {!eighteen ? 'Your card' : nine === 'front' ? 'Front nine' : 'Back nine'}
                </Text>
                <Text style={[TYPE.body, { fontSize: 13, color: P.ink }]}>{sub}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scorecard"
                onPress={onClose}
                style={{ width: 44, height: 44, marginRight: 8, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon.x size={20} />
              </Pressable>
            </View>
          </GestureDetector>
          {eighteen && (
            <Rocker
              options={[
                { value: 'front', label: 'Front nine' },
                { value: 'back', label: 'Back nine' },
              ]}
              value={nine}
              onChange={(v) => v && setNine(v)}
              style={{ marginHorizontal: 22, marginBottom: 8 }}
            />
          )}
          {hasSyntheticHoles && !hintDismissed && onChangePar && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingBottom: 8 }}>
              <Text style={[TYPE.body, { flex: 1, fontSize: 13, lineHeight: 18, color: P.ink }]}>
                No course layout found. Par defaults to 4 — tap a par to change it.
              </Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notice" onPress={() => setHintDismissed(true)} hitSlop={12}>
                <Icon.x size={16} />
              </Pressable>
            </View>
          )}
          <View style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: 6, paddingHorizontal: 22, borderBottomWidth: 1, borderColor: P.ink }}>
            <Text style={[TYPE.body, { flex: 1, fontSize: 12, color: P.ink }]}>Hole</Text>
            <Text style={[TYPE.body, { width: COL.par, textAlign: 'center', fontSize: 12, color: P.ink }]}>Par</Text>
            <Text style={[TYPE.body, { width: COL.score, textAlign: 'center', fontSize: 12, color: P.ink }]}>Score</Text>
            <Text style={[TYPE.body, { width: COL.toPar, textAlign: 'right', fontSize: 12, color: P.ink }]}>To par</Text>
          </View>
          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {shown.map(({ h, par, score, run: runAt }) => {
              const now = h.number === currentHoleNumber
              // Par is editable only on holes with no layout data — OSM par is authoritative.
              const parEditable = !!onChangePar && !h.yards && h.tee_lat == null
              return (
                <Pressable
                  key={h.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Go to hole ${h.number}, par ${par}${score != null ? `, score ${score}` : ''}`}
                  accessibilityState={{ selected: now }}
                  onPress={() => onJumpToHole(h.number)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    minHeight: now ? 46 : 40,
                    paddingHorizontal: 22,
                    borderBottomWidth: 1,
                    borderColor: P.line,
                    backgroundColor: now ? P.raised : 'transparent',
                  }}
                >
                  {now && (
                    <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: P.brass }} />
                  )}
                  <Text style={[TYPE.body, { flex: 1, fontSize: 15, color: P.ink }]}>
                    {h.number}
                    {now && <Text style={[TYPE.serif, { fontSize: 14 }]}>{'   '}you’re here</Text>}
                  </Text>
                  {parEditable ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Par ${par}, tap to change`}
                      onPress={() => onChangePar?.(h.id, par === 3 ? 4 : par === 4 ? 5 : 3)}
                      style={{ width: COL.par, minHeight: 40, alignItems: 'center', justifyContent: 'center' }}
                    >
                      <Text
                        style={[
                          TYPE.kicker,
                          { fontSize: 15, color: P.ink, textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
                        ]}
                      >
                        {par}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={[TYPE.kicker, { width: COL.par, textAlign: 'center', fontSize: 15, color: P.ink }]}>{par}</Text>
                  )}
                  <View style={{ width: COL.score, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={[TYPE.serif, { fontSize: 20, lineHeight: 26, color: score != null ? P.ink : P.ink35 }]}>
                      {score ?? '—'}
                    </Text>
                    {score != null && <GolfMark toPar={score - par} />}
                  </View>
                  <Text
                    style={[
                      TYPE.kicker,
                      {
                        width: COL.toPar,
                        textAlign: 'right',
                        fontSize: 15,
                        color: runAt == null ? P.ink35 : runAt < 0 ? P.neg : P.ink,
                      },
                    ]}
                  >
                    {runAt == null ? '—' : signed(runAt)}
                  </Text>
                </Pressable>
              )
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 22, borderTopWidth: 1, borderColor: P.ink }}>
            <Text style={[TYPE.serif, { flex: 1, fontSize: 18, color: P.ink }]}>
              {!eighteen ? 'Total' : nine === 'front' ? 'Out' : 'In'}
            </Text>
            <Text style={[TYPE.kicker, { width: COL.par, textAlign: 'center', fontSize: 15, color: P.ink }]}>{sumPar}</Text>
            <Text style={[TYPE.serif, { width: COL.score, textAlign: 'center', fontSize: 22, color: P.ink }]}>
              {sumScore > 0 ? sumScore : '—'}
            </Text>
            <Text
              style={[
                TYPE.kicker,
                { width: COL.toPar, textAlign: 'right', fontSize: 15, color: sumScore === 0 ? P.ink35 : sumToPar < 0 ? P.neg : P.ink },
              ]}
            >
              {sumScore > 0 ? signed(sumToPar) : '—'}
            </Text>
          </View>
        </PaperSurface>
      </Animated.View>
    </View>
  )
}
