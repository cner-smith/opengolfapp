import { Text, View } from 'react-native'
import { formatBandLabel, formatSG, type ApproachBandStat } from '@oga/core'
import { useUnits } from '../../hooks/useUnits'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// Stats rows under the headline tiles (DESIGN.md Stat tile: tiles for the
// headline numbers, divided rows for the rest). Split out of stats.tsx for size.

const sgTone = (v: number | null) => (v == null || v === 0 ? P.inkDim : v > 0 ? P.forest : P.neg)

export function LedgerRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderColor: P.line,
        paddingVertical: 10,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>{label}</Text>
        {note && (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 2 }]}>
            {note}
          </Text>
        )}
      </View>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 22 }]}>{value}</Text>
    </View>
  )
}

// Approach band as a bar either side of zero, scaled to `max` (the largest
// magnitude among the bands) so the bars compare.
export function ApproachBandRow({ band, max }: { band: ApproachBandStat; max: number }) {
  const { unit, toDisplay } = useUnits()
  const v = band.avgSg
  const half = v == null ? 0 : Math.min(1, Math.abs(v) / max) * 50
  return (
    <View style={{ borderBottomWidth: 1, borderColor: P.line, paddingVertical: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>
          {formatBandLabel(band, unit, toDisplay)}
          <Text style={{ color: P.inkDim, fontSize: 12 }}>
            {band.shots > 0 ? `  ${band.shots} shot${band.shots === 1 ? '' : 's'}` : '  no shots yet'}
          </Text>
        </Text>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: sgTone(v), fontSize: 20 }]}>
          {v == null ? '—' : formatSG(v)}
        </Text>
      </View>
      <View style={{ height: 10, marginTop: 6 }}>
        <View style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 1, backgroundColor: '#8A8B7E' }} />
        {v != null && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              height: 10,
              backgroundColor: sgTone(v),
              left: v >= 0 ? '50%' : `${50 - half}%`,
              width: `${half}%`,
            }}
          />
        )}
      </View>
    </View>
  )
}
