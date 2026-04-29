import { useState } from 'react'
import {
  CLUBS,
  LIE_SLOPES,
  LIE_TYPES,
  getAimCorrection,
  type Club,
  type LieSlope,
  type LieType,
  type DispersionPoint,
  type DispersionStats,
} from '@oga/core'
import { useShotPatterns } from '../../hooks/useShotPatterns'

const SVG_SIZE = 420

export function ShotPatternsPage() {
  const [club, setClub] = useState<Club>('7i')
  const [lieType, setLieType] = useState<LieType | ''>('')
  const [lieSlope, setLieSlope] = useState<LieSlope | ''>('')

  const { data, isLoading } = useShotPatterns({
    club,
    lieType: lieType || undefined,
    lieSlope: lieSlope || undefined,
  })

  const points = data?.points ?? []
  const stats = data?.stats ?? null

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h1
          className="text-oga-text-primary"
          style={{ fontSize: 22, fontWeight: 600, lineHeight: 1.3 }}
        >
          Shot Patterns
        </h1>
        <div
          className="text-oga-text-muted"
          style={{ fontSize: 13, marginTop: 2 }}
        >
          Per-club dispersion centered on your aim point
        </div>
      </div>

      <Card label="Club">
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
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card label="Lie type">
          <SelectChips
            value={lieType}
            options={['', ...LIE_TYPES] as const}
            onChange={(v) => setLieType(v as LieType | '')}
            renderLabel={(v) => (v === '' ? 'any' : v.replace(/_/g, ' '))}
          />
        </Card>
        <Card label="Lie slope">
          <SelectChips
            value={lieSlope}
            options={['', ...LIE_SLOPES] as const}
            onChange={(v) => setLieSlope(v as LieSlope | '')}
            renderLabel={(v) => (v === '' ? 'any' : v.replace(/_/g, ' '))}
          />
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-[auto,1fr]">
        <Card>
          {isLoading ? (
            <div
              className="flex items-center justify-center text-oga-text-muted"
              style={{ width: SVG_SIZE, height: SVG_SIZE, fontSize: 13 }}
            >
              Loading…
            </div>
          ) : points.length === 0 ? (
            <div
              className="flex items-center justify-center text-oga-text-muted"
              style={{ width: SVG_SIZE, height: SVG_SIZE, fontSize: 13 }}
            >
              No shots yet for {club}
              {lieType ? ` (${lieType})` : ''}
              {lieSlope ? ` (${lieSlope})` : ''}.
            </div>
          ) : (
            <DispersionPlot points={points} stats={stats} />
          )}
        </Card>

        <div className="flex flex-col gap-3">
          <Card label="Pattern summary">
            {stats ? (
              <dl className="grid grid-cols-2 gap-3">
                <Stat label="Sample" value={`${stats.sampleSize} shots`} />
                <Stat
                  label="Avg lateral"
                  value={`${stats.avgLateralOffset.toFixed(1)} yd`}
                />
                <Stat
                  label="Avg distance bias"
                  value={`${stats.avgDistanceOffset.toFixed(1)} yd`}
                />
                <Stat label="Shape" value={stats.shotShape} />
                <Stat label="Dominant miss" value={stats.dominantMiss} />
                <Stat
                  label="68% spread"
                  value={`±${stats.cone68.lateral.toFixed(1)} / ${stats.cone68.distance.toFixed(1)} yd`}
                />
              </dl>
            ) : (
              <p className="text-oga-text-muted" style={{ fontSize: 13 }}>
                Need at least 5 shots with aim and landing coords to compute a pattern.
              </p>
            )}
          </Card>
          {stats && (
            <div
              style={{
                backgroundColor: '#E1F5EE',
                borderRadius: 10,
                padding: '14px 16px',
              }}
            >
              <div
                className="uppercase"
                style={{
                  color: '#0F6E56',
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: 0.4,
                  marginBottom: 4,
                }}
              >
                Aim correction
              </div>
              <p style={{ color: '#0F6E56', fontSize: 13 }}>
                {getAimCorrection(stats)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Card({
  label,
  children,
}: {
  label?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="bg-oga-bg-card"
      style={{
        border: '0.5px solid #E4E4E0',
        borderRadius: 10,
        padding: '12px 14px',
      }}
    >
      {label && (
        <div
          className="text-oga-text-muted uppercase"
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 0.4,
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    backgroundColor: active ? '#E1F5EE' : '#F4F4F0',
    color: active ? '#0F6E56' : '#111111',
    border: `0.5px solid ${active ? '#1D9E75' : '#E0E0DA'}`,
    borderRadius: 7,
    padding: '7px 10px',
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
      <dt className="text-oga-text-muted" style={{ fontSize: 11 }}>
        {label}
      </dt>
      <dd
        className="font-medium tabular text-oga-text-primary"
        style={{ fontSize: 13, textTransform: 'capitalize' }}
      >
        {value}
      </dd>
    </div>
  )
}

function pointColor(result: string | undefined): { fill: string; opacity: number } {
  if (result === 'solid') return { fill: '#1D9E75', opacity: 0.7 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#EF9F27', opacity: 0.7 }
  if (result === undefined) return { fill: '#888880', opacity: 0.5 }
  return { fill: '#E24B4A', opacity: 0.8 }
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
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{ backgroundColor: '#F8F8F6', borderRadius: 8 }}
    >
      {ticks.map((t) => (
        <g key={`v${t}`}>
          <line
            x1={px(t)}
            y1={0}
            x2={px(t)}
            y2={SVG_SIZE}
            stroke="#E8E8E4"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={py(t)}
            x2={SVG_SIZE}
            y2={py(t)}
            stroke="#E8E8E4"
            strokeWidth={1}
          />
        </g>
      ))}
      <line x1={cx} y1={0} x2={cx} y2={SVG_SIZE} stroke="#D0D0CA" strokeWidth={1} />
      <line x1={0} y1={cy} x2={SVG_SIZE} y2={cy} stroke="#D0D0CA" strokeWidth={1} />

      {stats && (
        <>
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(29,158,117,0.08)"
            stroke="#1D9E75"
            strokeDasharray="5 4"
            strokeWidth={1}
          />
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(29,158,117,0.15)"
            stroke="#1D9E75"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
        </>
      )}

      <circle cx={cx} cy={cy} r={3} fill="#1D9E75" />
      <text
        x={cx + 6}
        y={cy + 14}
        fontSize={10}
        fill="#1D9E75"
      >
        target
      </text>

      {points.map((p, i) => {
        const c = pointColor(p.shotResult)
        return (
          <circle
            key={i}
            cx={px(p.lateralOffsetYards)}
            cy={py(p.distanceOffsetYards)}
            r={3.5}
            fill={c.fill}
            fillOpacity={c.opacity}
          />
        )
      })}

      <text x={cx + 6} y={14} fontSize={9} fill="#888880">
        long
      </text>
      <text x={cx + 6} y={SVG_SIZE - 6} fontSize={9} fill="#888880">
        short
      </text>
      <text x={6} y={cy - 6} fontSize={9} fill="#888880">
        L
      </text>
      <text x={SVG_SIZE - 14} y={cy - 6} fontSize={9} fill="#888880">
        R
      </text>
    </svg>
  )
}
