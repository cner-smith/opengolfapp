import { useMemo } from 'react'
import { YARDS_TO_METERS, type DispersionPoint, type DistanceUnit, type DispersionStats } from '@oga/core'

// The same shots seen from the tee, also from above: each one a curve from
// the tee to where it finished at its true distance, so the shape (draw /
// fade) reads. Shots normalise to a common tee at their average aim distance;
// one scale on both axes. Drawn on the yardage-book grid of the hero plot.

const W = 440
const H = 470
const LEFT = 46
const TEE_Y = H - 34
const SERIF = 'Fraunces, Georgia, serif'
const SANS = 'Epilogue, sans-serif'

export function BallFlightChart({
  points,
  stats,
  unit,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  unit: DistanceUnit
}) {
  const geo = useMemo(() => {
    const aims = points.filter((p) => p.startDistanceOffsetYards != null).map((p) => -p.startDistanceOffsetYards!)
    const avgAim = aims.length ? aims.reduce((a, b) => a + b, 0) / aims.length : 0
    const aimOf = (p: DispersionPoint) => (p.startDistanceOffsetYards != null ? -p.startDistanceOffsetYards : avgAim)
    const max = Math.max(...points.map((p) => aimOf(p) + p.distanceOffsetYards), avgAim, 1) * 1.06
    const center = stats ? stats.avgLateralOffset : 0
    const lat = Math.max(...points.map((p) => Math.abs(p.lateralOffsetYards - center)), Math.abs(center), 8) * 1.15
    const scale = Math.min((TEE_Y - 14) / max, ((W - LEFT) / 2 - 10) / lat)
    return { avgAim, aimOf, max, center, scale }
  }, [points, stats])

  if (!points.some((p) => p.startDistanceOffsetYards != null) || geo.avgAim < 5) {
    return (
      <div className="flex items-center justify-center text-caddie-ink-dim" style={{ aspectRatio: `${W} / ${H}`, fontSize: 13, padding: 24, textAlign: 'center' }}>
        These shots have no start point saved, so there is no line from the tee to draw.
      </div>
    )
  }

  const { avgAim, aimOf, max, center, scale } = geo
  const midX = LEFT + (W - LEFT) / 2
  const x = (l: number) => midX + (l - center) * scale
  const y = (d: number) => TEE_Y - d * scale
  const teeX = x(0)
  const step = max <= 160 ? 10 : 25
  const labelEvery = 50
  const rules: number[] = []
  for (let d = step; d <= max; d += step) rules.push(d)
  const label = (yd: number) => String(Math.round(unit === 'meters' ? yd * YARDS_TO_METERS : yd))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Each shot from the tee to where it finished">
      {rules.map((d) => (
        <g key={d}>
          <line x1={LEFT} x2={W} y1={y(d)} y2={y(d)} stroke={d % labelEvery === 0 ? '#DCD5C3' : '#EAE4D5'} strokeWidth={1} />
          {d % labelEvery === 0 && (
            <text x={LEFT - 6} y={y(d) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill="#5C6356">{label(d)}</text>
          )}
        </g>
      ))}
      <line x1={LEFT} x2={LEFT} y1={0} y2={TEE_Y} stroke="#9F9580" strokeWidth={1} />
      <line x1={teeX} x2={teeX} y1={y(max)} y2={TEE_Y} stroke="#9F9580" strokeWidth={1} strokeDasharray="3 4" />
      <g fill="none">
        {points.map((p) => (
          <path
            key={p.id}
            d={`M ${teeX} ${TEE_Y} Q ${x(p.lateralOffsetYards)} ${y(aimOf(p))} ${x(p.lateralOffsetYards)} ${y(aimOf(p) + p.distanceOffsetYards)}`}
            stroke="#1C211C"
            strokeOpacity={0.22}
            strokeWidth={1.2}
          />
        ))}
        {stats && (
          <path
            d={`M ${teeX} ${TEE_Y} Q ${x(stats.avgLateralOffset)} ${y(avgAim)} ${x(stats.avgLateralOffset)} ${y(avgAim + stats.avgDistanceOffset)}`}
            stroke="#1F3D2C"
            strokeWidth={2.5}
          />
        )}
      </g>
      {points.map((p) => (
        <circle key={`d${p.id}`} cx={x(p.lateralOffsetYards)} cy={y(aimOf(p) + p.distanceOffsetYards)} r={3} fill="#1C211C" fillOpacity={0.78} />
      ))}
      {/* the aim, at the average aim distance */}
      <line x1={teeX} y1={y(avgAim)} x2={teeX} y2={y(avgAim) - 14} stroke="#A66A1F" strokeWidth={1.4} />
      <path d={`M ${teeX} ${y(avgAim) - 14} L ${teeX + 9} ${y(avgAim) - 11} L ${teeX} ${y(avgAim) - 8} Z`} fill="#A66A1F" />
      <circle cx={teeX} cy={TEE_Y} r={4.5} fill="#FBF8F1" stroke="#1C211C" strokeWidth={1.6} />
      <text x={teeX} y={TEE_Y + 20} textAnchor="middle" fontFamily={SANS} fontStyle="italic" fontSize={13} fill="#5C6356">tee</text>
      <text x={LEFT - 6} y={TEE_Y + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fill="#8A8B7E">{unit === 'meters' ? 'm' : 'yd'}</text>
    </svg>
  )
}
