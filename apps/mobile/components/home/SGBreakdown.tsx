import { Text, View } from 'react-native'
import { barScale, formatSG, type HomeSummaryArea } from '@oga/core'
import { TYPE } from '../../lib/typography'
import { SectionHead } from '../paper/Section'

export function SGBreakdown({ areas, maxAbs, count }: { areas: HomeSummaryArea[]; maxAbs: number; count: number }) {
  const scale = barScale(maxAbs)

  return (
    <View style={{ marginBottom: 22 }}>
      <SectionHead title="Strokes gained" />
      <Text style={[TYPE.body, { color: '#5C6356', fontSize: 13, marginTop: -6, marginBottom: 12 }]}>
        Per round, last {count} round{count === 1 ? '' : 's'}.
      </Text>
      <View style={{ gap: 14 }}>
        {areas.map((a) => (
          <SGBar key={a.key} label={a.label} value={a.value} max={scale} />
        ))}
      </View>
    </View>
  )
}

export function SGBar({
  label,
  value,
  max,
  bold,
}: {
  label: string
  /** null = no round has this category: no bar, "—". */
  value: number | null
  max: number
  bold?: boolean
}) {
  const v = value ?? 0
  const pct = Math.min(Math.abs(v) / max, 1) * 50
  const isPositive = v > 0
  const color = v > 0 ? '#1F3D2C' : v < 0 ? '#A33A2A' : '#8A8B7E'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={[bold ? TYPE.bodyBold : TYPE.body, { color: '#1C211C', fontSize: 13, width: 124 }]}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 8, position: 'relative' }}>
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 4,
            height: 1,
            backgroundColor: '#D9D2BF',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: '50%',
            width: 1,
            backgroundColor: '#9F9580',
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 1,
            bottom: 1,
            left: isPositive ? '50%' : `${50 - pct}%`,
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </View>
      <Text
        style={[
          TYPE.serif,
          {
            color,
            fontSize: 15,
            width: 56,
            textAlign: 'right',
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {value == null ? '—' : formatSG(value)}
      </Text>
    </View>
  )
}
