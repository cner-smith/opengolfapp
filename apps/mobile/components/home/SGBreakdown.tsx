import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { barScale, formatSG, sgBreakdown, type SGBreakdownKey, type SGRoundLike } from '@oga/core'
import { TYPE } from '../../lib/typography'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const SG_LABELS: Record<SGBreakdownKey, string> = {
  sg_off_tee: 'Off tee',
  sg_approach: 'Approach',
  sg_around_green: 'Around green',
  sg_putting: 'Putting',
}

export function SGBreakdown({ rounds }: { rounds: SGRoundLike[] }) {
  const { breakdown, maxAbs } = useMemo(() => sgBreakdown(rounds), [rounds])
  const scale = barScale(maxAbs)

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
        <Text style={[TYPE.kicker, KICKER]}>SG breakdown</Text>
      </View>
      <View style={{ gap: 14 }}>
        {breakdown.map((b) => (
          <SGBar key={b.key} label={SG_LABELS[b.key]} value={b.value} max={scale} />
        ))}
      </View>
    </View>
  )
}

function SGBar({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = Math.min(Math.abs(value) / max, 1) * 50
  const isPositive = value > 0
  const color = value > 0 ? '#1F3D2C' : value < 0 ? '#A33A2A' : '#8A8B7E'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={[TYPE.body, { color: '#1C211C', fontSize: 13, width: 100 }]}>
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
        {formatSG(value)}
      </Text>
    </View>
  )
}
