import { useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import Svg, { Circle, Defs, G, Line, Pattern, Polygon, Rect, Text as SvgText } from 'react-native-svg'
import {
  clubChangeCallouts,
  clubHistory,
  YARDS_TO_METERS,
  type ClubDistanceStat,
  type ClubHistoryPeriod,
  type ClubHistoryRow,
  type DistanceUnit,
} from '@oga/core'
import { getClubHistoryShots } from '@oga/supabase'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { TYPE } from '../../lib/typography'
import { SectionHead } from '../paper/Section'
import { Rocker } from '../paper/Paper'
import { Chip } from '../paper/Pickers'
import { FONT_CAP, P } from '../paper/tokens'

type Period = 'month' | 'rounds'
const PERIODS = [
  { value: 'month' as const, label: 'By month' },
  { value: 'rounds' as const, label: 'By 10 rounds' },
]
// A phone axis holds six periods; the table keeps the rest.
const CHART_PERIODS = 6
const SURFACE_2 = '#EBE5D6'

// Stats' Club history on a phone (#984): club keys, the headline callout,
// typical distance, ring and shape on one axis, and the numbers on request.
export function ClubHistory({ clubDistances, unit, width }: { clubDistances: ClubDistanceStat[]; unit: DistanceUnit; width: number }) {
  const { user } = useAuth()
  const mostUsed = useMemo(() => [...clubDistances].sort((a, b) => b.count - a.count)[0]?.club ?? null, [clubDistances])
  const [picked, setPicked] = useState<string | null>(null)
  const club = picked ?? mostUsed
  const [period, setPeriod] = useState<Period>('month')
  const [showTable, setShowTable] = useState(false)
  // Rows stay with their club so a new pick never draws the last one's shots.
  const [loaded, setLoaded] = useState<{ club: string; rows: ClubHistoryRow[]; error: boolean } | null>(null)

  useEffect(() => {
    if (!user || !club) return
    let active = true
    getClubHistoryShots(supabase, user.id, club).then(({ data, error }) => {
      if (!active) return
      if (error) {
        // eslint-disable-next-line no-console -- dev diagnostic; the section shows the error below
        console.error('[stats/getClubHistoryShots]', error.message)
      }
      setLoaded({ club, rows: (data as unknown as ClubHistoryRow[] | null) ?? [], error: !!error })
    })
    return () => {
      active = false
    }
  }, [user?.id, club])

  const current = loaded?.club === club ? loaded : null
  const periods = useMemo(
    () => (current && club ? clubHistory(current.rows, club, { period: period === 'month' ? 'month' : { rounds: 10 } }).slice(-12) : []),
    [current, club, period],
  )
  const callouts = useMemo(() => (club ? clubChangeCallouts(periods, { club, unit }) : null), [periods, club, unit])
  if (!club) return null
  const u = (y: number) => Math.round(unit === 'meters' ? y * YARDS_TO_METERS : y)
  const word = period === 'month' ? 'month' : 'window'

  return (
    <View style={{ marginBottom: 28 }}>
      <SectionHead title="Club history" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
        {clubDistances.map((c) => (
          <Chip key={c.club} label={c.club === 'driver' ? 'Driver' : c.club} state={c.club === club ? 'on' : 'set'} onPress={() => setPicked(c.club)} />
        ))}
      </ScrollView>
      <Rocker options={PERIODS} value={period} onChange={(v) => v && setPeriod(v)} height={38} fontSize={13} style={{ marginTop: 8, marginBottom: 12 }} />

      {!current ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>Loading…</Text>
      ) : current.error ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>Couldn't load this club's shots.</Text>
      ) : periods.length === 0 ? (
        <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 13 }]}>No shots with a start and a finish yet.</Text>
      ) : (
        <>
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serif, { color: P.ink, fontSize: 19, lineHeight: 25 }]}>
            {callouts && callouts.sentences.length > 0
              ? callouts.sentences[0]
              : callouts?.first
                ? `No change bigger than the noise since ${callouts.first.label}.`
                : `A change shows once two ${period === 'month' ? 'months' : 'windows of 10 rounds'} have 10 or more shots.`}
          </Text>
          {callouts?.sentences[1] && (
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.serifUpright, { color: P.ink, fontSize: 15, lineHeight: 21, marginTop: 6 }]}>
              {callouts.sentences[1]}
            </Text>
          )}
          <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.inkDim, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 12 }]}>
            {callouts?.first && callouts.last
              ? `${callouts.last.distanceShots} shots in ${callouts.last.label}, ${callouts.first.distanceShots} in ${callouts.first.label}. `
              : ''}
            Typical distance is where the ball finished.
          </Text>
          <Charts periods={periods.slice(-CHART_PERIODS)} unit={unit} width={width} />
          <Pressable accessibilityRole="button" onPress={() => setShowTable((s) => !s)} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
            <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: P.ink, fontSize: 13, textDecorationLine: 'underline' }]}>
              {showTable ? 'Hide the numbers' : `Show the numbers by ${word}`}
            </Text>
          </Pressable>
          {showTable && (
            <View style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: P.ink, paddingBottom: 4 }}>
                {[period === 'month' ? 'Month' : 'Last round', 'Shots', 'Typical', 'Ring'].map((h, i) => (
                  <Text key={h} maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { flex: i === 0 ? 1.3 : 1, textAlign: i === 0 ? 'left' : 'right', color: P.inkDim, fontSize: 12 }]}>
                    {h}
                  </Text>
                ))}
              </View>
              {periods.map((p) => {
                const color = p.thin ? '#8A8B7E' : P.ink
                const cell = [TYPE.serifUpright, { flex: 1, textAlign: 'right' as const, color, fontSize: 14, fontVariant: ['tabular-nums' as const] }]
                return (
                  <View key={p.from} style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: P.line, paddingVertical: 6 }}>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { flex: 1.3, color: p.thin ? '#8A8B7E' : P.inkDim, fontSize: 12 }]}>{p.label}</Text>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={cell}>{p.distanceShots}</Text>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={cell}>{p.typical == null ? '–' : u(p.typical)}</Text>
                    <Text maxFontSizeMultiplier={FONT_CAP} style={[...cell, { color: p.ringThin ? '#8A8B7E' : P.ink }]}>
                      {p.ring ? `${u(p.ring.width)} × ${u(p.ring.depth)}` : '–'}
                    </Text>
                  </View>
                )
              })}
              <Text maxFontSizeMultiplier={FONT_CAP} style={[TYPE.body, { color: '#8A8B7E', fontSize: 11, marginTop: 6 }]}>
                In {unit === 'meters' ? 'm' : 'yd'}; ring is width × depth, two in three shots. Grey: under 8 shots.
              </Text>
            </View>
          )}
        </>
      )}
    </View>
  )
}

// Round-number axis, at most five ticks (same rule as the web section).
function niceAxis(values: number[], minSpan: number): { lo: number; hi: number; ticks: number[] } {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = [5, 10, 20, 50, 100].find((s) => Math.max(max - min, minSpan) / s <= 4) ?? 100
  const lo = Math.floor(min / step) * step
  let hi = Math.ceil(max / step) * step
  if (hi - lo < minSpan) hi = lo + Math.ceil(minSpan / step) * step
  if (hi === lo) hi = lo + step
  return { lo, hi, ticks: Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step) }
}

function Charts({ periods, unit, width }: { periods: ClubHistoryPeriod[]; unit: DistanceUnit; width: number }) {
  const cv = (y: number) => (unit === 'meters' ? y * YARDS_TO_METERS : y)
  const n = periods.length
  const padL = 30
  const padR = 62
  const step = n > 1 ? (width - padL - padR - 20) / (n - 1) : 0
  const x = (i: number) => (n > 1 ? padL + 10 + i * step : (padL + width - padR) / 2)
  const last = periods[n - 1]!
  const us = unit === 'meters' ? 'm' : 'yd'

  const dVals = periods.flatMap((p) => [p.typical, p.p16, p.p84].filter((v): v is number => v != null).map(cv))
  const dA = niceAxis(dVals.length ? dVals : [0], 20)
  const D_TOP = 24
  const D_H = 90
  const dy = (v: number) => D_TOP + D_H - ((cv(v) - dA.lo) / (dA.hi - dA.lo)) * D_H
  const band = periods.flatMap((p, i) => (p.p16 != null && p.p84 != null ? [{ i, lo: p.p16, hi: p.p84 }] : []))

  const rVals = periods.flatMap((p) => (p.ring ? [cv(p.ring.width), cv(p.ring.depth)] : []))
  const rA = niceAxis(rVals.length ? rVals : [0], 10)
  const R_TOP = 150
  const R_H = 70
  const ry = (v: number) => R_TOP + R_H - ((cv(v) - rA.lo) / (rA.hi - rA.lo)) * R_H
  const lastRing = [...periods].reverse().find((p) => p.ring)

  const S_TOP = 250
  const S_H = 40
  const colW = Math.max(12, Math.min(24, (n > 1 ? step : 40) * 0.5))
  const H = 312

  const seg = (pts: ({ x: number; y: number; thin: boolean } | null)[], color: string, dash?: string) =>
    pts.slice(1).map((b, k) => {
      const a = pts[k]
      if (!a || !b) return null
      const thin = a.thin || b.thin
      return <Line key={k} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={thin ? 1.5 : 2} strokeDasharray={thin ? '3,3' : dash} />
    })
  const grid = (ticks: number[], y: (t: number) => number) =>
    ticks.map((t, i) => (
      <G key={t}>
        <Line x1={padL} y1={y(t)} x2={width - padR + 8} y2={y(t)} stroke={i === 0 ? P.lineStrong : P.line} strokeWidth={1} />
        <SvgText x={padL - 5} y={y(t) + 4} textAnchor="end" fontFamily={TYPE.body.fontFamily} fontSize={10} fill={P.inkDim}>
          {t}
        </SvgText>
      </G>
    ))

  return (
    <Svg width={width} height={H} accessibilityLabel={`${n} periods, ${periods[0]!.label} to ${last.label}. Show the numbers for every value.`}>
      <Defs>
        <Pattern id="chm-hatch" width={5} height={5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <Rect width={5} height={5} fill={P.raised} />
          <Line x1={0} y1={0} x2={0} y2={5} stroke={P.ink} strokeWidth={1.6} />
        </Pattern>
      </Defs>

      <SvgText x={0} y={12} fontFamily={TYPE.body.fontFamily} fontSize={12} fill={P.ink}>{`Typical distance, ${us}`}</SvgText>
      {grid(dA.ticks, (t) => D_TOP + D_H - ((t - dA.lo) / (dA.hi - dA.lo)) * D_H)}
      {band.length > 1 && (
        <Polygon
          points={[...band.map((b) => `${x(b.i)},${dy(b.hi)}`), ...[...band].reverse().map((b) => `${x(b.i)},${dy(b.lo)}`)].join(' ')}
          fill={SURFACE_2}
        />
      )}
      {seg(periods.map((p, i) => (p.typical == null ? null : { x: x(i), y: dy(p.typical), thin: p.thin })), P.ink)}
      {periods.map((p, i) =>
        p.typical == null ? null : (
          <Circle
            key={i}
            cx={x(i)}
            cy={dy(p.typical)}
            r={p.thin ? 4 : i === n - 1 ? 5 : 3.5}
            fill={p.thin ? P.raised : i === n - 1 ? P.forest : P.ink}
            stroke={P.ink}
            strokeWidth={p.thin ? 1.5 : 0}
          />
        ),
      )}
      {last.typical != null && (
        <SvgText x={x(n - 1)} y={dy(last.typical) - 10} textAnchor="middle" fontFamily={TYPE.serif.fontFamily} fontSize={16} fill={P.ink}>
          {String(Math.round(cv(last.typical)))}
        </SvgText>
      )}

      <SvgText x={0} y={138} fontFamily={TYPE.body.fontFamily} fontSize={12} fill={P.ink}>{`Ring width and depth, ${us}`}</SvgText>
      {rVals.length > 0 && grid(rA.ticks, (t) => R_TOP + R_H - ((t - rA.lo) / (rA.hi - rA.lo)) * R_H)}
      {seg(periods.map((p, i) => (p.ring ? { x: x(i), y: ry(p.ring.width), thin: p.ringThin } : null)), P.ink)}
      {seg(periods.map((p, i) => (p.ring ? { x: x(i), y: ry(p.ring.depth), thin: p.ringThin } : null)), P.inkDim, '6,3')}
      {lastRing?.ring && (
        <>
          <SvgText
            x={x(periods.indexOf(lastRing)) + 6}
            y={ry(lastRing.ring.width) + (lastRing.ring.width >= lastRing.ring.depth ? -5 : 13)}
            fontFamily={TYPE.serif.fontFamily}
            fontSize={12}
            fill={P.ink}
          >{`${Math.round(cv(lastRing.ring.width))} wide`}</SvgText>
          <SvgText
            x={x(periods.indexOf(lastRing)) + 6}
            y={ry(lastRing.ring.depth) + (lastRing.ring.width >= lastRing.ring.depth ? 13 : -5)}
            fontFamily={TYPE.serif.fontFamily}
            fontSize={12}
            fill={P.inkDim}
          >{`${Math.round(cv(lastRing.ring.depth))} deep`}</SvgText>
        </>
      )}

      <SvgText x={0} y={240} fontFamily={TYPE.body.fontFamily} fontSize={12} fill={P.ink}>Shape: fade · straight · draw</SvgText>
      {periods.map((p, i) => {
        const rec = p.shape.draw + p.shape.straight + p.shape.fade
        const left = x(i) - colW / 2
        if (rec < 5) {
          return <Rect key={i} x={left} y={S_TOP} width={colW} height={S_H} fill={P.raised} stroke={P.lineStrong} strokeDasharray="3,3" />
        }
        const fadeH = (p.shape.fade / rec) * S_H
        const straightH = (p.shape.straight / rec) * S_H
        const drawH = S_H - fadeH - straightH
        return (
          <G key={i}>
            <Rect x={left} y={S_TOP + S_H - fadeH} width={colW} height={fadeH} fill={P.ink} />
            <Rect x={left} y={S_TOP + drawH} width={colW} height={straightH} fill={SURFACE_2} stroke={P.lineStrong} />
            <Rect x={left} y={S_TOP} width={colW} height={drawH} fill="url(#chm-hatch)" stroke={P.ink} strokeWidth={0.5} />
          </G>
        )
      })}
      {periods.map((p, i) => (
        <SvgText key={i} x={x(i)} y={H - 4} textAnchor="middle" fontFamily={TYPE.body.fontFamily} fontSize={10} fill={p.thin ? '#8A8B7E' : P.inkDim}>
          {p.label}
        </SvgText>
      ))}
    </Svg>
  )
}
