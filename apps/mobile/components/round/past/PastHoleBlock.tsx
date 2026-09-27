import { Text, View } from 'react-native'
import { TYPE } from '../../../lib/typography'
import { GolfMark } from '../../paper/GolfMark'
import { HeroRow } from '../../paper/HeroRow'
import { Icon } from '../../paper/icons'
import { PaperSurface } from '../../paper/Paper'
import { P } from '../../paper/tokens'
import { NavButton } from '../LiveRoundHeader'

export type HoleResult =
  | { scored: true; score: number; toPar: number | null; putts: number | null }
  | { scored: false; shots: number }

interface PastHoleBlockProps {
  holeNumber: number
  holeCount: number
  par: number | null
  yardsLabel: string | null
  result: HoleResult
  distance: { value: string; unit: string } | null
  expected: number | null
  onPrev: () => void
  onNext: () => void
}

// Past-round Map tab hole block (#611 §19.2): the live header's rows minus
// Card / ⋮, continuing the round header's paper, with this hole's result in
// the corner (§19.9 A). One ink rule under the whole header lands here.
export function PastHoleBlock(p: PastHoleBlockProps) {
  const sub = [
    p.par != null ? `Par ${p.par}` : null,
    p.yardsLabel,
    p.result.scored ? `scored ${p.result.score}` : 'no score yet',
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <PaperSurface style={{ borderTopWidth: 1, borderTopColor: P.line, borderBottomWidth: 1, borderBottomColor: P.ink }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 50, paddingHorizontal: 2 }}>
        <NavButton label="Previous hole" onPress={p.onPrev} disabled={p.holeNumber <= 1}>
          <Icon.prev size={20} />
        </NavButton>
        <View style={{ flex: 1, alignItems: 'center', paddingVertical: 3 }}>
          <Text
            numberOfLines={1}
            style={[TYPE.serif, { alignSelf: 'stretch', textAlign: 'center', fontSize: 22, lineHeight: 26, color: P.ink }]}
          >
            {`Hole ${p.holeNumber}`}
          </Text>
          <Text style={[TYPE.body, { fontSize: 13, lineHeight: 17, color: P.ink, textAlign: 'center' }]}>{sub}</Text>
        </View>
        <NavButton label="Next hole" onPress={p.onNext} disabled={p.holeNumber >= p.holeCount}>
          <Icon.next size={20} />
        </NavButton>
      </View>
      <HeroRow distance={p.distance} expected={p.expected} trailing={<ResultCorner result={p.result} />} />
    </PaperSurface>
  )
}

function ResultCorner({ result }: { result: HoleResult }) {
  const lines = result.scored
    ? [
        result.toPar == null ? null : result.toPar === 0 ? 'E' : result.toPar > 0 ? `+${result.toPar}` : `−${-result.toPar}`,
        result.putts == null ? null : `${result.putts} putt${result.putts === 1 ? '' : 's'}`,
      ].filter(Boolean)
    : [`${result.shots} shot${result.shots === 1 ? '' : 's'}`, 'so far']
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginLeft: 6, paddingBottom: 3 }}
      accessible
      accessibilityLabel={
        result.scored ? `Scored ${result.score}. ${lines.join(', ')}` : `No score yet, ${lines.join(' ')}`
      }
    >
      {result.scored ? (
        <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Text maxFontSizeMultiplier={1} style={[TYPE.serif, { fontSize: 24, lineHeight: 30, color: P.ink }]}>
            {result.score}
          </Text>
          {result.toPar != null && <GolfMark toPar={result.toPar} />}
        </View>
      ) : (
        <View
          style={{
            width: 36,
            height: 36,
            borderWidth: 1.3,
            borderStyle: 'dashed',
            borderColor: P.ink35,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text maxFontSizeMultiplier={1} style={[TYPE.serif, { fontSize: 20, color: P.ink35 }]}>
            —
          </Text>
        </View>
      )}
      {lines.length > 0 && (
        <Text style={[TYPE.body, { fontSize: 12, lineHeight: 15, color: P.ink }]}>{lines.join('\n')}</Text>
      )}
    </View>
  )
}
