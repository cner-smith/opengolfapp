import { useState } from 'react'
import { Text, View } from 'react-native'
import Svg, { Circle, Polyline } from 'react-native-svg'
import { formatBandLabel, formatSG, sparkPoints, type ApproachBandStat, type PuttSplit } from '@oga/core'
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

// The last rounds under a headline tile's number (#1354): no axis, a dot and
// the exact value on the latest round, no trend words. Empty draws nothing.
const SPARK_H = 20
const DOT = 2.5

export function Sparkline({ values }: { values: number[] }) {
  const [w, setW] = useState(0)
  if (values.length === 0) return null
  const pts = w > 0 ? sparkPoints(values, w - DOT, SPARK_H) : []
  const last = pts[pts.length - 1]
  const latest = Math.round(values[values.length - 1]!)
  return (
    <View
      accessible
      accessibilityLabel={`Last ${values.length} rounds: ${values.map((v) => Math.round(v)).join(', ')}. Latest ${latest}.`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}
    >
      <View style={{ flex: 1, height: SPARK_H + DOT * 2 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {last && (
          <Svg width={w} height={SPARK_H + DOT * 2}>
            <Polyline
              points={pts.map((p) => `${p.x},${p.y + DOT}`).join(' ')}
              fill="none"
              stroke={P.inkDim}
              strokeWidth={1.25}
              strokeLinejoin="round"
            />
            <Circle cx={last.x} cy={last.y + DOT} r={DOT} fill={P.ink} />
          </Svg>
        )}
      </View>
      <Text
        maxFontSizeMultiplier={FONT_CAP}
        style={[TYPE.serif, { color: P.ink, fontSize: 12, minWidth: 16, top: last ? last.y + DOT - (SPARK_H + DOT * 2) / 2 : 0 }]}
      >
        {latest}
      </Text>
    </View>
  )
}

// Putts per hole as one strip (#1355): 1, 2, 3+ left to right, each told
// apart by position, label and tone (light, mid, ink), never colour alone.
const PUTT_TONE = [P.raised, 'rgba(92,99,86,.55)', P.ink] as const
const PUTT_WORD = { '1': 'one putt', '2': 'two', '3+': 'three or more' } as const
const PUTT_ALIGN = ['left', 'center', 'right'] as const

export function PuttStrip({ split }: { split: PuttSplit | null }) {
  return (
    <View style={{ borderBottomWidth: 1, borderColor: P.line, paddingTop: 10, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 15 }]}>Putts per hole</Text>
        {split && (
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12 }]}>{split.holes} holes</Text>
        )}
      </View>
      {split ? (
        <View
          accessible
          accessibilityLabel={split.buckets.map((b) => `${PUTT_WORD[b.putts]}: ${Math.round(b.pct)}%, ${b.count} holes`).join('; ')}
        >
          <View style={{ flexDirection: 'row', height: 14, marginTop: 10, borderWidth: 1, borderColor: P.lineStrong }}>
            {split.buckets.map((b, i) => (
              <View
                key={b.putts}
                style={{
                  width: `${b.pct}%`,
                  backgroundColor: PUTT_TONE[i],
                  borderLeftWidth: i > 0 && b.count > 0 ? 1 : 0,
                  borderColor: P.chrome,
                }}
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 8, gap: 8 }}>
            {split.buckets.map((b, i) => (
              <View key={b.putts} style={{ flex: 1 }}>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 18, textAlign: PUTT_ALIGN[i] }]}>
                  {Math.round(b.pct)}%
                </Text>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 2, textAlign: PUTT_ALIGN[i] }]}>
                  {PUTT_WORD[b.putts]} · {b.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, marginTop: 4 }]}>Needs putts logged</Text>
      )}
    </View>
  )
}
