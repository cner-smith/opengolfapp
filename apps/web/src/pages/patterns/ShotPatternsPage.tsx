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
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-fairway-700">Shot Patterns</h1>

      <div className="rounded-lg bg-white p-3 shadow-sm">
        <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Club</div>
        <div className="flex flex-wrap gap-1">
          {CLUBS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setClub(c)}
              className={`rounded-full px-3 py-1 text-xs ${
                club === c
                  ? 'bg-fairway-500 text-white'
                  : 'border border-gray-200 text-gray-700 hover:bg-fairway-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">
            Lie type
          </span>
          <select
            value={lieType}
            onChange={(e) => setLieType(e.target.value as LieType | '')}
            className="w-full rounded border border-gray-200 px-2 py-1.5"
          >
            <option value="">Any</option>
            {LIE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase text-gray-500">
            Lie slope
          </span>
          <select
            value={lieSlope}
            onChange={(e) => setLieSlope(e.target.value as LieSlope | '')}
            className="w-full rounded border border-gray-200 px-2 py-1.5"
          >
            <option value="">Any</option>
            {LIE_SLOPES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 lg:grid-cols-[auto,1fr]">
        <div className="rounded-lg bg-white p-4 shadow-sm">
          {isLoading ? (
            <div className="flex h-[420px] w-[420px] items-center justify-center text-fairway-700">
              Loading…
            </div>
          ) : points.length === 0 ? (
            <div className="flex h-[420px] w-[420px] items-center justify-center text-sm text-gray-500">
              No shots yet for {club}
              {lieType ? ` (${lieType})` : ''}
              {lieSlope ? ` (${lieSlope})` : ''}.
            </div>
          ) : (
            <DispersionPlot points={points} stats={stats} />
          )}
        </div>

        <div className="space-y-3">
          <div className="rounded-lg bg-white p-4 shadow-sm">
            <div className="text-xs font-semibold uppercase text-gray-500">
              Pattern summary
            </div>
            {stats ? (
              <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
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
              <p className="mt-2 text-sm text-gray-500">
                Need at least 5 shots with aim + landing coordinates to compute a pattern.
              </p>
            )}
          </div>
          {stats && (
            <div className="rounded-lg border border-fairway-200 bg-fairway-50 p-4 text-sm text-fairway-900">
              <div className="text-xs font-semibold uppercase text-fairway-700">
                Aim correction
              </div>
              <p className="mt-1">{getAimCorrection(stats)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="font-semibold capitalize text-gray-900">{value}</dd>
    </div>
  )
}

function pointColor(result: string | undefined): string {
  if (result === 'solid') return '#10b981'
  if (result === 'push_right' || result === 'pull_left') return '#f59e0b'
  if (result === undefined) return '#6b7280'
  return '#ef4444'
}

function DispersionPlot({
  points,
  stats,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
}) {
  const maxAbs = Math.max(
    ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
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
    ticks.push(t)
    ticks.push(-t)
  }

  return (
    <svg
      width={SVG_SIZE}
      height={SVG_SIZE}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      className="rounded bg-fairway-50"
    >
      {ticks.map((t) => (
        <g key={`v${t}`}>
          <line
            x1={px(t)}
            y1={0}
            x2={px(t)}
            y2={SVG_SIZE}
            stroke="#dcecdf"
            strokeWidth={1}
          />
          <line
            x1={0}
            y1={py(t)}
            x2={SVG_SIZE}
            y2={py(t)}
            stroke="#dcecdf"
            strokeWidth={1}
          />
        </g>
      ))}
      <line x1={cx} y1={0} x2={cx} y2={SVG_SIZE} stroke="#94a3b8" strokeWidth={1} />
      <line x1={0} y1={cy} x2={SVG_SIZE} y2={cy} stroke="#94a3b8" strokeWidth={1} />

      {stats && (
        <>
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone95.lateral * scale}
            ry={stats.cone95.distance * scale}
            fill="rgba(63, 141, 90, 0.08)"
            stroke="#3f8d5a"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(63, 141, 90, 0.18)"
            stroke="#23613b"
            strokeWidth={1.5}
          />
          <circle
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            r={3}
            fill="#23613b"
          />
        </>
      )}

      <circle cx={cx} cy={cy} r={5} fill="none" stroke="#0f172a" strokeWidth={1.5} />
      <line
        x1={cx - 8}
        y1={cy}
        x2={cx + 8}
        y2={cy}
        stroke="#0f172a"
        strokeWidth={1.5}
      />
      <line
        x1={cx}
        y1={cy - 8}
        x2={cx}
        y2={cy + 8}
        stroke="#0f172a"
        strokeWidth={1.5}
      />

      {points.map((p, i) => (
        <circle
          key={i}
          cx={px(p.lateralOffsetYards)}
          cy={py(p.distanceOffsetYards)}
          r={4}
          fill={pointColor(p.shotResult)}
          fillOpacity={0.7}
        />
      ))}

      <text x={cx + 6} y={14} fontSize={10} fill="#475569">
        long
      </text>
      <text x={cx + 6} y={SVG_SIZE - 6} fontSize={10} fill="#475569">
        short
      </text>
      <text x={6} y={cy - 6} fontSize={10} fill="#475569">
        left
      </text>
      <text x={SVG_SIZE - 32} y={cy - 6} fontSize={10} fill="#475569">
        right
      </text>
    </svg>
  )
}
