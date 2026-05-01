import { useState } from 'react'
import {
  CLUBS,
  LIE_TYPES,
  getAimCorrection,
  type Club,
  type LieSlopeForward,
  type LieSlopeSide,
  type LieType,
  type DispersionPoint,
  type DispersionStats,
} from '@oga/core'
import { useShotPatterns } from '../../hooks/useShotPatterns'
import { LieSlopeGrid } from '../../components/forms/LieSlopeGrid'
import { useUnits } from '../../hooks/useUnits'

const SVG_SIZE = 420
const SVG_VIEW_WIDTH = `min(${SVG_SIZE}px, 90vw)`

export function ShotPatternsPage() {
  const { unit, toDisplay } = useUnits()
  const [club, setClub] = useState<Club>('7i')
  const [lieType, setLieType] = useState<LieType | ''>('')
  const [lieSlopeForward, setLieSlopeForward] = useState<
    LieSlopeForward | undefined
  >(undefined)
  const [lieSlopeSide, setLieSlopeSide] = useState<LieSlopeSide | undefined>(
    undefined,
  )

  const { data, isLoading } = useShotPatterns({
    club,
    lieType: lieType || undefined,
    lieSlopeForward,
    lieSlopeSide,
  })

  const points = data?.points ?? []
  const stats = data?.stats ?? null

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <div className="kicker" style={{ marginBottom: 8 }}>
          Dispersion ledger
        </div>
        <h1
          className="font-serif text-caddie-ink"
          style={{ fontSize: 28, fontWeight: 500, lineHeight: 1.15 }}
        >
          Shot Patterns
        </h1>
        <div
          className="text-caddie-ink-dim"
          style={{ fontSize: 15, marginTop: 6, maxWidth: 560 }}
        >
          Per-club dispersion centered on the aim point you set before each shot.
        </div>
      </div>

      <Section kicker="Club">
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {CLUBS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClub(c)}
              style={chipStyle(club === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </Section>

      <div
        className="grid grid-cols-1 sm:grid-cols-2"
        style={{ gap: 28, marginBottom: 28 }}
      >
        <FilterSection kicker="Lie type">
          <SelectChips
            value={lieType}
            options={['', ...LIE_TYPES] as const}
            onChange={(v) => setLieType(v as LieType | '')}
            renderLabel={(v) => (v === '' ? 'any' : v.replace(/_/g, ' '))}
          />
        </FilterSection>
        <FilterSection kicker="Lie slope">
          <LieSlopeGrid
            forward={lieSlopeForward}
            side={lieSlopeSide}
            onChangeForward={setLieSlopeForward}
            onChangeSide={setLieSlopeSide}
            toggleable
          />
        </FilterSection>
      </div>

      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
        }}
      >
        <div className="kicker" style={{ marginBottom: 14 }}>
          Pattern
        </div>
        <div
          className="grid grid-cols-1 md:[grid-template-columns:minmax(0,auto)_minmax(0,1fr)]"
          style={{ gap: 22 }}
        >
          <div
            className="bg-caddie-surface"
            style={{
              border: '1px solid #D9D2BF',
              borderRadius: 4,
              padding: 14,
            }}
          >
            {isLoading ? (
              <div
                className="flex items-center justify-center text-caddie-ink-mute"
                style={{
                  width: SVG_VIEW_WIDTH,
                  height: SVG_VIEW_WIDTH,
                  fontSize: 13,
                }}
              >
                Loading…
              </div>
            ) : points.length === 0 ? (
              <div
                className="flex items-center justify-center text-caddie-ink-mute"
                style={{
                  width: SVG_VIEW_WIDTH,
                  height: SVG_VIEW_WIDTH,
                  fontSize: 13,
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                No shots yet for {club}
                {lieType ? ` (${lieType})` : ''}
                {lieSlopeForward ? ` (${lieSlopeForward})` : ''}
                {lieSlopeSide ? ` (${lieSlopeSide.replace('_', ' ')})` : ''}.
              </div>
            ) : (
              <DispersionPlot points={points} stats={stats} />
            )}
          </div>

          <div className="flex flex-col" style={{ gap: 22 }}>
            <div>
              <div className="kicker" style={{ marginBottom: 12 }}>
                Pattern summary
              </div>
              {stats ? (
                <dl
                  className="grid grid-cols-2"
                  style={{ gap: 18, rowGap: 18 }}
                >
                  <Stat label="Sample" value={`${stats.sampleSize} shots`} />
                  <Stat
                    label="Avg lateral"
                    value={toDisplay(stats.avgLateralOffset, 1)}
                  />
                  <Stat
                    label="Distance bias"
                    value={toDisplay(stats.avgDistanceOffset, 1)}
                  />
                  <Stat label="Shape" value={stats.shotShape} />
                  <Stat label="Dominant miss" value={stats.dominantMiss} />
                  <Stat
                    label="68% spread"
                    value={`±${toDisplay(stats.cone68.lateral, 1)} / ${toDisplay(stats.cone68.distance, 1)}`}
                  />
                </dl>
              ) : (
                <p
                  className="font-serif text-caddie-ink"
                  style={{
                    fontSize: 17,
                    lineHeight: 1.55,
                    maxWidth: 480,
                  }}
                >
                  Need at least <em>five shots</em> with aim and landing
                  coordinates to compute a pattern.
                </p>
              )}
            </div>
            {stats && (
              <div
                style={{
                  borderTop: '1px solid #D9D2BF',
                  paddingTop: 18,
                }}
              >
                <div className="kicker" style={{ marginBottom: 10 }}>
                  Aim correction
                </div>
                <p
                  className="font-serif text-caddie-ink"
                  style={{ fontSize: 17, lineHeight: 1.55, maxWidth: 480 }}
                >
                  {getAimCorrection(stats, unit)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: 28 }}>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div className="kicker">{kicker}</div>
      </div>
      {children}
    </section>
  )
}

function FilterSection({
  kicker,
  children,
}: {
  kicker: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div
        style={{
          borderTop: '1px solid #D9D2BF',
          paddingTop: 14,
          marginBottom: 14,
        }}
      >
        <div className="kicker">{kicker}</div>
      </div>
      {children}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#1F3D2C' : '#EBE5D6',
    color: active ? '#F2EEE5' : '#1C211C',
    border: 'none',
    borderRadius: 2,
    padding: '6px 10px',
    fontSize: 12,
    fontWeight: active ? 500 : 400,
    cursor: 'pointer',
  }
}

function SelectChips<T extends string>({
  value,
  options,
  onChange,
  renderLabel,
}: {
  value: T
  options: readonly T[]
  onChange: (v: T) => void
  renderLabel: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap" style={{ gap: 6 }}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          style={chipStyle(value === opt)}
        >
          {renderLabel(opt)}
        </button>
      ))}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="kicker" style={{ marginBottom: 6 }}>
        {label}
      </dt>
      <dd
        className="font-serif tabular text-caddie-ink"
        style={{
          fontSize: 22,
          fontWeight: 500,
          textTransform: 'capitalize',
          lineHeight: 1.1,
        }}
      >
        {value}
      </dd>
    </div>
  )
}

// Pattern point colors. Solid = ink (neutral, the goal); push/pull = warn
// amber; misses = neg brick. Stays inside the editorial palette.
function pointColor(result: string | undefined): { fill: string; opacity: number } {
  if (result === 'solid') return { fill: '#1C211C', opacity: 0.75 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#A66A1F', opacity: 0.75 }
  if (result === undefined) return { fill: '#8A8B7E', opacity: 0.5 }
  return { fill: '#A33A2A', opacity: 0.8 }
}

function DispersionPlot({
  points,
  stats,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
}) {
  const maxAbs = Math.max(
    ...points.map((p) =>
      Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards)),
    ),
    stats ? stats.cone95.lateral : 0,
    stats ? stats.cone95.distance : 0,
    20,
  )
  const range = maxAbs * 1.15
  const cx = SVG_SIZE / 2
  const cy = SVG_SIZE / 2
  const scale = (SVG_SIZE / 2) / range

  const px = (lat: number) => cx + lat * scale
  const py = (dist: number) => cy - dist * scale

  const tickStep = range > 50 ? 20 : range > 20 ? 10 : 5
  const ticks: number[] = []
  for (let t = tickStep; t < range; t += tickStep) {
    ticks.push(t, -t)
  }

  return (
    <svg
      width={SVG_VIEW_WIDTH}
      height={SVG_VIEW_WIDTH}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{ backgroundColor: '#F2EEE5', borderRadius: 2 }}
    >
      {ticks.map((t) => (
        <g key={`v${t}`}>
          <line
            x1={px(t)}
            y1={0}
            x2={px(t)}
            y2={SVG_SIZE}
            stroke="#EBE5D6"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={py(t)}
            x2={SVG_SIZE}
            y2={py(t)}
            stroke="#EBE5D6"
            strokeWidth={1}
          />
        </g>
      ))}
      <line x1={cx} y1={0} x2={cx} y2={SVG_SIZE} stroke="#9F9580" strokeWidth={1} />
      <line x1={0} y1={cy} x2={SVG_SIZE} y2={cy} stroke="#9F9580" strokeWidth={1} />

      {stats && (
        <>
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(31,61,44,0.06)"
            stroke="#1F3D2C"
            strokeDasharray="5 4"
            strokeWidth={1}
          />
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.12)"
            stroke="#1F3D2C"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}

      <circle cx={cx} cy={cy} r={3} fill="#A66A1F" />
      <text
        x={cx + 6}
        y={cy + 14}
        fontSize={10}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.14em"
        fill="#A66A1F"
      >
        AIM
      </text>

      {points.map((p) => {
        const c = pointColor(p.shotResult)
        return (
          <circle
            key={p.id}
            cx={px(p.lateralOffsetYards)}
            cy={py(p.distanceOffsetYards)}
            r={3.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      <text
        x={cx + 8}
        y={14}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        LONG
      </text>
      <text
        x={cx + 8}
        y={SVG_SIZE - 6}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        SHORT
      </text>
      <text
        x={6}
        y={cy - 6}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        L
      </text>
      <text
        x={SVG_SIZE - 14}
        y={cy - 6}
        fontSize={9}
        fontFamily="JetBrains Mono, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        R
      </text>
    </svg>
  )
}
