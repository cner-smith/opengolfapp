import { Text, View } from 'react-native'
import { ArticleHeader, C, KICKER, P } from '../primitives'
import { FONT } from '../../../lib/typography'

export function BenchmarksArticle() {
  return (
    <View>
      <ArticleHeader kicker="By the numbers" title="Where the field sits." />
      <P>
        Reference benchmarks for the stats this app tracks, from a 25-handicap
        weekend round up to the PGA Tour. Use the table to see where you sit
        relative to the bracket above and below your handicap.
      </P>

      {BENCHMARKS.map((b) => (
        <View
          key={b.label}
          style={{
            borderWidth: 1,
            borderColor: C.line,
            backgroundColor: C.surface,
            borderRadius: 4,
            padding: 14,
            marginBottom: 10,
          }}
        >
          <Text style={{ ...KICKER, marginBottom: 8 }}>{b.label}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
            <Stat label="PGA" value={b.pga} />
            <Stat label="Scratch" value={b.scratch} />
            <Stat label="Mid" value={b.mid} />
            <Stat label="High" value={b.high} />
          </View>
        </View>
      ))}

      <Text style={{ ...KICKER, marginTop: 14, lineHeight: 14 }}>
        Benchmarks based on Mark Broadie's strokes gained research and PGA
        Tour ShotLink data. Amateur averages approximate.
      </Text>
    </View>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: 80 }}>
      <Text style={{ ...KICKER, color: C.inkDim, fontSize: 9, marginBottom: 4 }}>
        {label}
      </Text>
      <Text
        style={{
          color: C.ink,
          fontFamily: FONT.body,
          fontSize: 17,
          fontWeight: '500',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  )
}

const BENCHMARKS = [
  {
    label: 'Avg score',
    pga: '69.5',
    scratch: '72',
    mid: '82 at 10 hcp',
    high: '92 at 20 hcp',
  },
  { label: 'GIR %', pga: '67%', scratch: '50%', mid: '30%', high: '15%' },
  { label: 'Putts / round', pga: '29', scratch: '32', mid: '34', high: '36' },
  {
    label: 'Driving distance',
    pga: '294 yd',
    scratch: '250 yd',
    mid: '220 yd',
    high: '190 yd',
  },
]
