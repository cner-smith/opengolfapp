import { useMemo } from 'react'
import { Text, View, useWindowDimensions } from 'react-native'
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg'
import { symmetricNiceTicks } from '@oga/core'
import { FONT, TYPE } from '../../lib/typography'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

interface SGTrendChartProps {
  data: { x: number; y: number }[]
}

const HEIGHT = 200
const PAD = { top: 12, right: 16, bottom: 28, left: 32 }

export function SGTrendChart({ data }: SGTrendChartProps) {
  const { width: screenWidth } = useWindowDimensions()
  const width = screenWidth - 36
  // Symmetric Y domain + ticks scaled to the data peak so the axis labels
  // always match the plotted line (a fixed [-0.5,0,0.5] tick set stopped
  // matching once a round's SG total ran past it).
  const sgAxis = useMemo(() => symmetricNiceTicks(data.map((d) => d.y)), [data])

  const plotW = width - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const xMin = data[0]?.x ?? 0
  const xMax = data[data.length - 1]?.x ?? 1
  const xSpan = xMax - xMin || 1
  const yMax = sgAxis.max || 1
  const px = (x: number) => PAD.left + ((x - xMin) / xSpan) * plotW
  const py = (y: number) => PAD.top + (1 - (y + yMax) / (2 * yMax)) * plotH
  const points = data.map((d) => `${px(d.x)},${py(d.y)}`).join(' ')

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
        <Text style={[TYPE.kicker, KICKER]}>SG total trend</Text>
      </View>
      <Svg width={width} height={HEIGHT}>
        {/* Y gridlines + tick labels */}
        {sgAxis.ticks.map((t) => (
          <Line key={`g${t}`} x1={PAD.left} x2={width - PAD.right} y1={py(t)} y2={py(t)} stroke="#EBE5D6" strokeWidth={1} />
        ))}
        {sgAxis.ticks.map((t) => (
          <SvgText key={`l${t}`} x={PAD.left - 6} y={py(t) + 3} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono} textAnchor="end">
            {String(t)}
          </SvgText>
        ))}
        {/* axes */}
        <Line x1={PAD.left} x2={width - PAD.right} y1={HEIGHT - PAD.bottom} y2={HEIGHT - PAD.bottom} stroke="#D9D2BF" strokeWidth={1} />
        <Line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="#D9D2BF" strokeWidth={1} />
        {/* dashed zero reference */}
        {data.length >= 2 && (
          <Line x1={PAD.left} x2={width - PAD.right} y1={py(0)} y2={py(0)} stroke="#9F9580" strokeWidth={1} strokeDasharray="3,3" />
        )}
        {/* first/last date ticks */}
        {data.length >= 2 &&
          [data[0]!, data[data.length - 1]!].map((d, i) => (
            <SvgText key={`d${i}`} x={px(d.x)} y={HEIGHT - PAD.bottom + 14} fontSize={9} fill="#8A8B7E" fontFamily={FONT.mono} textAnchor={i === 0 ? 'start' : 'end'}>
              {new Date(d.x).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </SvgText>
          ))}
        {/* SG line */}
        {data.length >= 2 && <Polyline points={points} fill="none" stroke="#1F3D2C" strokeWidth={1.5} />}
      </Svg>
    </View>
  )
}
