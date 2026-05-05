import { useMemo } from 'react'
import { Text, View } from 'react-native'
import { formatSG } from '@oga/core'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  fontFamily: 'JetBrainsMono-Medium',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

const SG_KEYS = [
  { key: 'sg_off_tee', label: 'Off tee' },
  { key: 'sg_approach', label: 'Approach' },
  { key: 'sg_around_green', label: 'Around green' },
  { key: 'sg_putting', label: 'Putting' },
] as const

interface SGRow {
  sg_off_tee: number | null
  sg_approach: number | null
  sg_around_green: number | null
  sg_putting: number | null
}

// Average each SG category across the rounds, then render a diverging
// bar per category with the value floated at the bar end.
export function SGBreakdown({ rounds }: { rounds: SGRow[] }) {
  const { breakdown, maxAbs } = useMemo(() => {
    const bd = SG_KEYS.map((c) => {
      const values = rounds
        .map((r) => r[c.key])
        .filter((v): v is number => v !== null)
      const avg =
        values.length === 0
          ? 0
          : values.reduce((a, b) => a + b, 0) / values.length
      return { ...c, value: Number(avg.toFixed(2)) }
    })
    const maxAbsValue = Math.max(...bd.map((b) => Math.abs(b.value)), 0.5)
    return { breakdown: bd, maxAbs: maxAbsValue }
  }, [rounds])

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
        <Text style={KICKER}>SG breakdown</Text>
      </View>
      <View style={{ gap: 14 }}>
        {breakdown.map((b) => (
          <SGBar key={b.key} label={b.label} value={b.value} max={maxAbs} />
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
      <Text style={{ color: '#1C211C', fontSize: 13, width: 100 }}>
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
        style={{
          color,
          fontSize: 15,
          fontStyle: 'italic',
          fontWeight: '500',
          width: 56,
          textAlign: 'right',
          fontVariant: ['tabular-nums'],
        }}
      >
        {formatSG(value)}
      </Text>
    </View>
  )
}
