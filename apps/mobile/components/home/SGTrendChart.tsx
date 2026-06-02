import { Text, View, useWindowDimensions } from 'react-native'
import { VictoryAxis, VictoryChart, VictoryLine } from 'victory-native'
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
const BOTTOM = 28
// Pin x-axis to chart bottom regardless of where y=0 falls.
// Victory's `bottom` transform is `y = height - offsetY`, so offsetY=BOTTOM
// lands the axis at height-BOTTOM = bottom of the chart area. The prior
// value (HEIGHT-BOTTOM=172) inverted this, placing the axis near the top
// where Victory ignores it and falls back to the y=0 data position.
const X_AXIS_Y = BOTTOM

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
        <Text style={[TYPE.kicker, KICKER]}>SG total trend</Text>
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
              fontFamily: FONT.mono,
            },
            grid: { stroke: 'transparent' },
          }}
        />
        <VictoryAxis
          dependentAxis
          tickValues={[-0.5, 0, 0.5]}
          style={{
            axis: { stroke: '#D9D2BF' },
            tickLabels: {
              fontSize: 9,
              fill: '#8A8B7E',
              fontFamily: FONT.mono,
            },
            grid: { stroke: '#EBE5D6', strokeDasharray: '0' },
          }}
        />
        {/* Zero reference line so +/- is immediately readable */}
        {data.length >= 2 && (
          <VictoryLine
            data={[{ x: data[0]!.x, y: 0 }, { x: data[data.length - 1]!.x, y: 0 }]}
            style={{ data: { stroke: '#9F9580', strokeWidth: 1, strokeDasharray: '3,3' } }}
          />
        )}
        <VictoryLine
          data={data}
          interpolation="monotoneX"
          style={{ data: { stroke: '#1F3D2C', strokeWidth: 1.5 } }}
        />
      </VictoryChart>
    </View>
  )
}
