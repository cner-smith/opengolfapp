import { useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  DEFAULT_HANDICAP,
  formatBandLabel,
  formatSG,
  sgFinding,
  sgStandouts,
  type DetailedStats,
  type SGAverages,
} from '@oga/core'
import { useProfile } from '../../../hooks/useProfile'
import { useUnits } from '../../../hooks/useUnits'
import { Insufficient, Section, Subhead } from '../components/Section'
import { ApproachBandRow, SgTile } from '../components/StatTiles'

const TICK_STYLE = { fontSize: 11, fill: '#8A8B7E', fontFamily: 'Epilogue, sans-serif' } as const

const SG_SERIES = [
  { key: 'offTee', label: 'Off the tee', color: '#1F3D2C', dash: '0' },
  { key: 'approach', label: 'Approach', color: '#A33A2A', dash: '6 3' },
  { key: 'aroundGreen', label: 'Around the green', color: '#A66A1F', dash: '2 3' },
  { key: 'putting', label: 'Putting', color: '#1C211C', dash: '6 3 2 3' },
] as const

type SeriesKey = (typeof SG_SERIES)[number]['key']

// played_at is a calendar date; noon keeps it on the same day in any zone.
const toDate = (d: string) => new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00` : d)
const shortDate = (d: string) => toDate(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

function Key({ dash, color }: { dash: string; color: string }) {
  return (
    <svg width="18" height="8" aria-hidden style={{ flexShrink: 0 }}>
      <line x1="0" y1="4" x2="18" y2="4" stroke={color} strokeWidth="2" strokeDasharray={dash} />
    </svg>
  )
}

type TipEntry = { dataKey?: string | number; value?: number | string }

function TrendTip({
  active,
  payload,
  label,
  focus,
}: {
  active?: boolean
  payload?: TipEntry[]
  label?: string
  focus: SeriesKey | null
}) {
  if (!active || !payload?.length || !label) return null
  const value = (k: SeriesKey) => Number(payload.find((p) => p.dataKey === k)?.value ?? 0)
  const total = SG_SERIES.reduce((sum, s) => sum + value(s.key), 0)
  return (
    <div className="st-tip">
      <div className="flex items-baseline justify-between" style={{ gap: 14, marginBottom: 6 }}>
        <span className="text-caddie-ink-dim" style={{ fontSize: 12 }}>{toDate(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="font-serif tabular" style={{ fontSize: 17, fontStyle: 'italic', fontWeight: 500, color: total >= 0 ? '#1F3D2C' : '#A33A2A' }}>
          {formatSG(total)}
        </span>
      </div>
      {SG_SERIES.map((s) => {
        const v = value(s.key)
        return (
          <div
            key={s.key}
            className="flex items-center"
            style={{ gap: 8, padding: '2px 0', opacity: focus == null || focus === s.key ? 1 : 0.4 }}
          >
            <Key dash={s.dash} color={s.color} />
            <span className="text-caddie-ink" style={{ fontSize: 12, flex: 1 }}>{s.label}</span>
            <span className="font-serif tabular" style={{ fontSize: 15, fontStyle: 'italic', color: v >= 0 ? '#1C211C' : '#A33A2A' }}>
              {formatSG(v)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function StrokesGainedSection({ data, wholeCount }: { data: DetailedStats; wholeCount: number }) {
  const { data: profile } = useProfile()
  const { unit, toDisplay } = useUnits()
  // The trend opens on all four; picking one brings it forward.
  const [focus, setFocus] = useState<SeriesKey | null>(null)
  const handicap = Math.round(profile?.handicap_index ?? DEFAULT_HANDICAP)
  const standouts = sgStandouts(data.sg)
  const sgLabel = (key: keyof SGAverages) => SG_SERIES.find((s) => s.key === key)?.label ?? key
  const weakest = standouts.weakest
  const strongest = standouts.strongest
  const tileScale = Math.max(1, ...SG_SERIES.map((s) => Math.abs(data.sg[s.key] ?? 0)))

  // Approach track: zero where the data needs it (an edge when every band
  // sits on one side); the row's margins hold each value past its bar.
  const bandVals = data.approachByDistance.map((b) => b.avgSg).filter((v): v is number => v != null)
  const m = Math.max(0.1, ...bandVals.map(Math.abs))
  const lo = bandVals.some((v) => v < 0) ? -m * 1.05 : 0
  const hi = bandVals.some((v) => v > 0) || lo === 0 ? m * 1.05 : 0
  const worstBand = data.approachByDistance
    .filter((b) => b.avgSg != null && b.avgSg < 0 && b.shots > 0)
    .sort((a, b) => a.avgSg! - b.avgSg!)[0]

  return (
    <Section title="Strokes gained">
      {weakest && (
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 'clamp(24px, 2.6vw, 34px)', fontStyle: 'italic', fontWeight: 500, lineHeight: 1.22, maxWidth: 1000, margin: '0 0 8px' }}
        >
          {sgFinding(
            { label: sgLabel(weakest.key), value: weakest.value },
            strongest && { label: sgLabel(strongest.key), value: strongest.value },
            'softest area',
          )}
        </p>
      )}
      <div className="text-caddie-ink-dim" style={{ fontSize: 14, marginBottom: 20 }}>
        Per round, last {wholeCount} round{wholeCount === 1 ? '' : 's'}, against a {handicap}-handicap.
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: 16, marginBottom: 40 }}>
        {SG_SERIES.map((s, i) => (
          <SgTile
            key={s.key}
            index={i}
            label={s.label}
            color={s.color}
            dash={s.dash}
            value={data.sg[s.key]}
            scale={tileScale}
          />
        ))}
      </div>

      <Subhead>Round by round</Subhead>
      {data.sgTrend.length === 0 ? (
        <Insufficient note="The trend needs at least one round with strokes gained logged." />
      ) : (
        <div style={{ marginBottom: 40 }}>
          <div className="flex flex-wrap" role="group" aria-label="Bring a category forward" style={{ gap: 8, marginBottom: 14 }}>
            {[{ key: null, label: 'All four', color: '#1C211C', dash: '' }, ...SG_SERIES].map((s) => (
              <button
                key={s.label}
                type="button"
                aria-pressed={focus === s.key}
                onClick={() => setFocus(s.key)}
                className="key st-chip"
              >
                {s.dash && <Key dash={s.dash} color={s.color} />}
                {s.label}
              </button>
            ))}
          </div>
          <div
            key={`${data.rounds}-${data.sgTrend.length}`}
            className="st-reveal st-trend"
            style={{ height: 'clamp(260px, 26vw, 340px)' }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sgTrend} margin={{ top: 10, right: 12, bottom: 4, left: -14 }}>
                <CartesianGrid stroke="#E4DCC8" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={shortDate}
                  minTickGap={24}
                  dy={6}
                />
                <YAxis
                  tick={TICK_STYLE}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
                />
                <ReferenceLine y={0} stroke="#1C211C" strokeWidth={1} />
                <Tooltip
                  content={<TrendTip focus={focus} />}
                  cursor={{ stroke: '#1C211C', strokeWidth: 1, strokeDasharray: '2 3' }}
                  isAnimationActive={false}
                />
                {SG_SERIES.map((s) => {
                  const on = focus == null || focus === s.key
                  const lead = focus === s.key
                  return (
                    <Line
                      key={s.key}
                      type="linear"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeOpacity={on ? 1 : 0.14}
                      strokeWidth={lead ? 2.75 : 1.6}
                      strokeDasharray={lead ? '0' : s.dash}
                      dot={on ? { r: lead ? 3.5 : 2.5, fill: s.color, strokeWidth: 0 } : false}
                      activeDot={on ? { r: 4.5, fill: s.color, stroke: '#FBF8F1', strokeWidth: 2 } : false}
                      isAnimationActive={false}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <Subhead style={{ marginBottom: 4 }}>Approach by distance</Subhead>
      <p className="font-serif text-caddie-ink-dim" style={{ fontSize: 17, fontStyle: 'italic', margin: '0 0 12px', maxWidth: 640 }}>
        {worstBand
          ? `Your ${formatBandLabel(worstBand, unit, toDisplay)} approaches cost the most: ${Math.abs(worstBand.avgSg!).toFixed(2)} strokes a shot.`
          : 'Per shot, against the same baseline.'}
      </p>
      <div style={{ borderTop: '1px solid #E4DCC8' }}>
        {data.approachByDistance.map((b, i) => (
          <ApproachBandRow key={b.key} band={b} lo={lo} hi={hi} index={i} />
        ))}
      </div>
    </Section>
  )
}
