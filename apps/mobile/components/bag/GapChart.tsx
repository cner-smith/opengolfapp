import { Text, View } from 'react-native'
import Svg, { Defs, Pattern, Rect } from 'react-native-svg'
import {
  HOLE_YARDS,
  MIN_SAMPLES_FOR_STATS,
  YARDS_TO_METERS,
  clubNoun,
  distanceUnitAbbr,
  shortClubLabel,
  wholeDistance,
  type BagClub,
  type BagGap,
  type BagGaps,
  type DistanceUnit,
} from '@oga/core'
import { TYPE } from '../../lib/typography'
import { FONT_CAP, P } from '../paper/tokens'

// My bag's gapping chart (web GapChart.tsx; keep the two in sync): one row per
// club in the bag's own order on a yardage axis, a bar where two in three of
// its shots finish, a tick at its typical distance, holes and overlaps shaded.
// The gap maths is core's bagGaps; this only draws it.

const ROW = 28
const LABEL_W = 40
const BAR = '#8FA493'
const MUTE = '#8A8B7E'
const HOLE_FILL = 'rgba(166,106,31,0.06)'
const OVERLAP_FILL = 'rgba(163,58,42,0.25)'

export type ChartClub = BagClub & { id: string }

const words = (xs: string[]) => (xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

// A shaded stretch: an overlap, or an empty one of HOLE_YARDS or more (a hole,
// or the stretch over clubs with no number, as the headline reads it).
function shaded(g: BagGap<ChartClub>): 'hole' | 'overlap' | null {
  if (!g.span) return null
  if (g.kind === 'overlap') return 'overlap'
  return g.span.high - g.span.low >= HOLE_YARDS ? 'hole' : null
}

// Diagonal amber hatching over a hole (web's repeating-linear-gradient).
function Hatch({ id }: { id: string }) {
  return (
    <Svg width="100%" height="100%" style={{ position: 'absolute' }}>
      <Defs>
        <Pattern id={id} width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={4} height={8} fill="rgba(166,106,31,0.22)" />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  )
}

export function GapChart({ gaps, unit }: { gaps: BagGaps<ChartClub>; unit: DistanceUnit }) {
  const { rungs, unmeasured, headline } = gaps
  const u = distanceUnitAbbr(unit)
  const d = (yd: number) => wholeDistance(yd, unit)
  const meta = [TYPE.body, { color: P.inkDim, fontSize: 12 }]

  if (!headline) {
    return (
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 14, lineHeight: 20, marginBottom: 22 }]}>
        Give two clubs a typical distance (open a club on the card below) and the gaps between them show here.
      </Text>
    )
  }

  const numbered = rungs.filter((r) => r.typical)
  const top = Math.max(...numbered.map((r) => r.range?.high ?? r.typical!.yards))
  const bottom = Math.min(...numbered.map((r) => r.range?.low ?? r.typical!.yards))
  // Gridlines every 50 yd, or every 50 m for a metres player.
  const step = unit === 'meters' ? 50 / YARDS_TO_METERS : 50
  const min = Math.max(0, Math.floor(bottom / step) * step)
  const max = Math.ceil((top + 12) / step) * step
  const pct = (yd: number) => ((yd - min) / (max - min)) * 100
  const ticks: number[] = []
  for (let t = min; t <= max + 0.01; t += step) ticks.push(t)
  const rowOf = (c: ChartClub) => rungs.indexOf(c)
  const measured = numbered.filter((r) => r.range).length

  const marked = gaps.gaps.filter((g) => shaded(g) != null)
  const size = (g: BagGap<ChartClub>) => g.span!.high - g.span!.low
  const ranked = [
    ...marked.filter((g) => shaded(g) === 'hole').sort((a, b) => size(b) - size(a)),
    ...marked.filter((g) => shaded(g) === 'overlap').sort((a, b) => size(b) - size(a)),
  ]

  return (
    <View style={{ marginBottom: 26 }}>
      <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 21, lineHeight: 27, marginBottom: 14 }]}>
        {headline}
      </Text>

      <View
        style={{ flexDirection: 'row', paddingRight: 30 }}
        accessible
        accessibilityLabel={numbered.map((r) => `${clubNoun(r.clubType)} ${d(r.typical!.yards)} ${u}`).join(', ')}
      >
        <View style={{ width: LABEL_W }}>
          {rungs.map((r) => (
            <View key={r.id} style={{ height: ROW, justifyContent: 'center' }}>
              <Text
                maxFontSizeMultiplier={1}
                numberOfLines={1}
                style={[TYPE.bodyBold, { color: r.typical ? P.ink : MUTE, fontSize: 12 }]}
              >
                {shortClubLabel({ club_type: r.clubType })}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ height: rungs.length * ROW, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: P.lineStrong }}>
            {ticks.map((t) => (
              <View key={t} style={{ position: 'absolute', left: `${pct(t)}%`, top: 0, bottom: 0, width: 1, backgroundColor: P.well }} />
            ))}
            {marked.map((g, i) => {
              const hole = shaded(g) === 'hole'
              const y0 = Math.min(rowOf(g.longer), rowOf(g.shorter)) * ROW + ROW / 2
              const y1 = Math.max(rowOf(g.longer), rowOf(g.shorter)) * ROW + ROW / 2
              return (
                <View
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `${pct(g.span!.low)}%`,
                    width: `${pct(g.span!.high) - pct(g.span!.low)}%`,
                    top: y0,
                    height: y1 - y0,
                    backgroundColor: hole ? HOLE_FILL : OVERLAP_FILL,
                    borderLeftWidth: hole ? 1 : 0,
                    borderRightWidth: hole ? 1 : 0,
                    borderStyle: 'dashed',
                    borderColor: P.warn,
                    overflow: 'hidden',
                  }}
                >
                  {hole ? <Hatch id={`hole-${i}`} /> : null}
                </View>
              )
            })}
            {rungs.map((r, i) => {
              const y = i * ROW + ROW / 2
              if (!r.typical) {
                return (
                  <Text
                    key={r.id}
                    maxFontSizeMultiplier={1}
                    style={[TYPE.serif, { position: 'absolute', left: 6, top: y - 9, fontSize: 12, lineHeight: 18, color: MUTE }]}
                  >
                    no number yet
                  </Text>
                )
              }
              const measured = r.typical.source === 'shots'
              const range = r.range
              return (
                <View key={r.id} pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}>
                  {range ? (
                    <View
                      style={{
                        position: 'absolute',
                        left: `${pct(range.low)}%`,
                        width: `${pct(range.high) - pct(range.low)}%`,
                        top: y - 5,
                        height: 10,
                        backgroundColor: BAR,
                        borderRadius: 1,
                      }}
                    />
                  ) : null}
                  <View
                    style={{
                      position: 'absolute',
                      left: `${pct(r.typical.yards)}%`,
                      marginLeft: -1,
                      top: y - 9,
                      width: 2,
                      height: 18,
                      backgroundColor: measured ? P.forest : MUTE,
                    }}
                  />
                  <Text
                    maxFontSizeMultiplier={1}
                    style={[
                      measured ? TYPE.serifUpright : TYPE.serif,
                      {
                        position: 'absolute',
                        left: `${pct(range?.high ?? r.typical.yards)}%`,
                        marginLeft: 5,
                        top: y - 9,
                        fontSize: 13,
                        lineHeight: 18,
                        color: measured ? P.ink : MUTE,
                      },
                    ]}
                  >
                    {d(r.typical.yards)}
                  </Text>
                </View>
              )
            })}
          </View>
          <View style={{ height: 18 }}>
            {ticks.map((t) => (
              <Text
                key={t}
                maxFontSizeMultiplier={1}
                style={[TYPE.body, { position: 'absolute', left: `${pct(t)}%`, marginLeft: -12, width: 24, textAlign: 'center', top: 3, fontSize: 10, color: P.inkDim }]}
              >
                {d(t)}
              </Text>
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 4, marginTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 18, height: 8, backgroundColor: BAR }}>
            <View style={{ position: 'absolute', left: 8, top: -4, width: 2, height: 16, backgroundColor: P.forest }} />
          </View>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[meta, { flexShrink: 1 }]}>
            Typical distance, and where two in three shots finish ({measured} club{measured === 1 ? '' : 's'} with{' '}
            {MIN_SAMPLES_FOR_STATS}+ shots)
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <View style={{ width: 2, height: 12, backgroundColor: MUTE }} />
          <Text maxFontSizeMultiplier={FONT_CAP} style={meta}>Your estimate</Text>
        </View>
        {ranked.some((g) => shaded(g) === 'hole') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 14, height: 10, backgroundColor: HOLE_FILL, borderWidth: 1, borderStyle: 'dashed', borderColor: P.warn, overflow: 'hidden' }}>
              <Hatch id="hole-key" />
            </View>
            <Text maxFontSizeMultiplier={FONT_CAP} style={meta}>Hole, {d(HOLE_YARDS)} {u} or more</Text>
          </View>
        ) : null}
        {ranked.some((g) => shaded(g) === 'overlap') ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <View style={{ width: 12, height: 10, backgroundColor: OVERLAP_FILL }} />
            <Text maxFontSizeMultiplier={FONT_CAP} style={meta}>Overlap</Text>
          </View>
        ) : null}
      </View>

      {unmeasured.length > 0 ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 8 }]}>
          No number yet for your {words(unmeasured.map((c) => clubNoun(c.clubType)))}: log five shots with{' '}
          {unmeasured.length === 1 ? 'it' : 'each'}, or open the club on the card and type a typical distance.
        </Text>
      ) : null}

      {ranked.length > 0 ? (
        <View style={{ marginTop: 12, borderTopWidth: 1, borderColor: P.line }}>
          {ranked.map((g, i) => {
            const hole = shaded(g) === 'hole'
            return (
              <View
                key={i}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: P.line }}
              >
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 14, flex: 1 }]}>
                  {hole ? 'Hole' : 'Overlap'} between {clubNoun(g.longer.clubType)} and {clubNoun(g.shorter.clubType)}
                  {g.unmeasured.length > 0 ? (
                    <Text style={{ color: P.inkDim }}> · no number yet for {words(g.unmeasured.map((c) => clubNoun(c.clubType)))}</Text>
                  ) : null}
                </Text>
                <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { fontSize: 15, color: hole ? P.warn : P.neg }]}>
                  {d(size(g))} {u}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
