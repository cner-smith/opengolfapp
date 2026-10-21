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
import { DEFAULT_HANDICAP, sgStandouts, type DetailedStats, type SGAverages } from '@oga/core'
import { useProfile } from '../../../hooks/useProfile'
import { Insufficient, Section, Subhead } from '../components/Section'
import { ApproachBandRow, SgTile } from '../components/StatTiles'

const TICK_STYLE = { fontSize: 11, fill: '#8A8B7E' } as const
const TOOLTIP_STYLE = {
  backgroundColor: '#FBF8F1',
  border: '1px solid #D9D2BF',
  borderRadius: 4,
  fontSize: 11,
  padding: '8px 10px',
  fontFamily: 'Epilogue, sans-serif',
} as const

const SG_SERIES = [
  { key: 'offTee', label: 'Off the tee', color: '#1F3D2C', dash: '0' },
  { key: 'approach', label: 'Approach', color: '#A33A2A', dash: '6 3' },
  { key: 'aroundGreen', label: 'Around the green', color: '#A66A1F', dash: '2 3' },
  { key: 'putting', label: 'Putting', color: '#1C211C', dash: '6 3 2 3' },
] as const

function SGLegend() {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        fontSize: 12,
        fontFamily: 'Epilogue, sans-serif',
        marginBottom: 6,
      }}
    >
      {SG_SERIES.map((s) => (
        <span key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#5C6356' }}>
          <svg width="16" height="10" style={{ flexShrink: 0 }}>
            <line
              x1="0" y1="5" x2="16" y2="5"
              stroke={s.color}
              strokeWidth="1.5"
              strokeDasharray={s.dash}
            />
          </svg>
          {s.label}
        </span>
      ))}
    </div>
  )
}

type SeriesKey = (typeof SG_SERIES)[number]['key']

export function StrokesGainedSection({ data }: { data: DetailedStats }) {
  const { data: profile } = useProfile()
  // The trend opens on all four; picking one brings it forward.
  const [focus, setFocus] = useState<SeriesKey | null>(null)
  const handicap = Math.round(profile?.handicap_index ?? DEFAULT_HANDICAP)
  const standouts = sgStandouts(data.sg)
  const sgLabel = (key: keyof SGAverages) =>
    SG_SERIES.find((s) => s.key === key)?.label ?? key
  const bandMax = Math.max(0.5, ...data.approachByDistance.map((b) => Math.abs(b.avgSg ?? 0)))
  const weakest = standouts.weakest
  const strongest = standouts.strongest

  return (
    <Section title="Strokes gained">
      {weakest && (
        <p
          className="font-serif text-caddie-ink"
          style={{ fontSize: 20, fontStyle: 'italic', lineHeight: 1.35, maxWidth: 640, margin: '0 0 6px' }}
        >
          {/* Within ±0.05 the number rounds to 0.0: call it even, not "costs you 0.0" (#911). */}
          {weakest.value <= -0.05
            ? `${sgLabel(weakest.key)} costs you ${Math.abs(weakest.value).toFixed(1)} strokes a round`
            : weakest.value < 0.05
              ? `${sgLabel(weakest.key)} is your softest area, about even`
              : `${sgLabel(weakest.key)} is your softest area, still gaining ${weakest.value.toFixed(1)} a round`}
          {strongest && strongest.key !== weakest.key && strongest.value >= 0.05
            ? `; ${sgLabel(strongest.key).toLowerCase()} gains you ${strongest.value.toFixed(1)}.`
            : '.'}
        </p>
      )}
      <div className="text-caddie-ink-dim" style={{ fontSize: 13, marginBottom: 12 }}>
        Per round, last {data.rounds} round{data.rounds === 1 ? '' : 's'}, against a {handicap}-handicap.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 14, marginBottom: 22 }}>
        {SG_SERIES.map((s) => (
          <SgTile key={s.key} label={s.label} color={s.color} value={data.sg[s.key]} />
        ))}
      </div>

      <Subhead>Round by round</Subhead>
      {data.sgTrend.length === 0 ? (
        <Insufficient note="The trend needs at least one round with strokes gained logged." />
      ) : (
        <div style={{ marginBottom: 22 }}>
          <div className="flex flex-wrap" style={{ gap: 6, marginBottom: 10 }}>
            {[{ key: null, label: 'All four' }, ...SG_SERIES].map((s) => {
              const on = focus === s.key
              return (
                <button
                  key={s.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFocus(s.key)}
                  className={on ? 'bg-caddie-ink text-caddie-bg' : 'bg-caddie-chip text-caddie-ink'}
                  style={{ fontSize: 13, padding: '5px 10px', borderRadius: 2 }}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
          {focus == null && <SGLegend />}
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.sgTrend} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
                <CartesianGrid stroke="#EBE5D6" vertical={false} />
                <XAxis dataKey="date" tick={TICK_STYLE} tickLine={false} axisLine={false} />
                <YAxis tick={TICK_STYLE} tickLine={false} axisLine={false} />
                <ReferenceLine y={0} stroke="#8A8B7E" />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={{ color: '#8A8B7E' }} />
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
                      strokeOpacity={on ? 1 : 0.15}
                      strokeWidth={lead ? 2.5 : 1.5}
                      strokeDasharray={lead ? '0' : s.dash}
                      dot={on ? { r: lead ? 3.5 : 2.5, fill: s.color, strokeWidth: 0 } : false}
                      activeDot={on ? { r: 4 } : false}
                      isAnimationActive={false}
                    />
                  )
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <Subhead>Approach by distance</Subhead>
      <div style={{ maxWidth: 720 }}>
        {data.approachByDistance.map((b) => (
          <ApproachBandRow key={b.key} band={b} max={bandMax} />
        ))}
      </div>
    </Section>
  )
}
