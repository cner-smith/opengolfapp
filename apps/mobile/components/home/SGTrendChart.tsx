import { Text, View, useWindowDimensions } from 'react-native'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'

const KICKER: import('react-native').TextStyle = {
  color: '#8A8B7E',
  fontSize: 10,
  fontWeight: '500',
  fontFamily: 'JetBrainsMono-Medium',
  letterSpacing: 1.4,
  textTransform: 'uppercase',
}

interface SGTrendChartProps {
  data: { x: number; y: number }[]
}

const HEIGHT = 200
const BOTTOM = 28
// Pin x-axis to chart bottom regardless of where y=0 falls.
// Victory's independent axis defaults to crossing y=0 in domain space —
// with negative SG values the line drifts into the middle of the plot.
const X_AXIS_Y = HEIGHT - BOTTOM

export function SGTrendChart({ data }: SGTrendChartProps) {
  const { width: screenWidth } = useWindowDimensions()
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
        <Text style={KICKER}>SG total trend</Text>
      </View>
      <VictoryChart
        height={HEIGHT}
        width={screenWidth - 36}
        padding={{ top: 12, right: 16, bottom: BOTTOM, left: 32 }}
      >
        <VictoryAxis
          offsetY={X_AXIS_Y}
          style={{
            axis: { stroke: '#D9D2BF' },
            tickLabels: {
              fontSize: 9,
              fill: '#8A8B7E',
              fontFamily: 'JetBrainsMono-Medium',
            },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          style={{
            axis: { stroke: '#D9D2BF' },
            tickLabels: {
              fontSize: 9,
              fill: '#8A8B7E',
              fontFamily: 'JetBrainsMono-Medium',
            },
            grid: { stroke: '#EBE5D6', strokeDasharray: '0' },
          }}
        />
        <VictoryLine
          data={data}
          style={{ data: { stroke: '#1F3D2C', strokeWidth: 1.5 } }}
        />
      </VictoryChart>
    </View>
  )
}
