import { useMemo } from 'react'
import { YARDS_TO_METERS, type DispersionPoint, type DispersionStats, type DistanceUnit } from '@oga/core'

// The pattern drawn like a yardage-book page: a ruled grid every 5 yd with the
// margin labelled, the aim as a small pennant, each shot's finish as a dot,
// the ring where about two shots in three finish, and a dashed line from the
// aim to the average finish. One scale on both axes, so the shape is true.

const W = 440
const LEFT = 48
const BOTTOM = 34
const TOP = 12
const RIGHT = 12
const AREA = W - LEFT - RIGHT // square plot area
const H = TOP + AREA + BOTTOM
const SERIF = 'Fraunces, Georgia, serif'
const SANS = 'Epilogue, sans-serif'

export function YardagePlot({
  points,
  stats,
  unit,
  empty,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  unit: DistanceUnit
  /** Shown over an empty grid when there are no points. */
  empty?: string
}) {
  const { half, scale } = useMemo(() => {
    const reach = Math.max(
      ...points.map((p) => Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards))),
      stats ? Math.abs(stats.avgLateralOffset) + stats.cone68.lateral : 0,
      stats ? Math.abs(stats.avgDistanceOffset) + stats.cone68.distance : 0,
      10,
    )
    const h = Math.ceil((reach * 1.1) / 5) * 5
    return { half: h, scale: AREA / 2 / h }
  }, [points, stats])

  const cx = LEFT + AREA / 2
  const cy = TOP + AREA / 2
  const px = (lat: number) => cx + lat * scale
  const py = (dist: number) => cy - dist * scale
  // Every 5 yd ruled; labelled every 5 unless that crowds the margin.
  const labelStep = 5 * scale >= 14 ? 5 : 10
  const rules: number[] = []
  for (let v = -half; v <= half; v += 5) rules.push(v)
  const label = (yd: number) => String(Math.round(Math.abs(unit === 'meters' ? yd * YARDS_TO_METERS : yd)))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="Where each shot finished, measured from your aim">
      {rules.map((v) => {
        const major = v % 10 === 0
        const axis = v === 0
        const stroke = axis ? '#9F9580' : major ? '#DCD5C3' : '#EAE4D5'
        return (
          <g key={v}>
            <line x1={LEFT} x2={LEFT + AREA} y1={py(v)} y2={py(v)} stroke={stroke} strokeWidth={1} />
            <line x1={px(v)} x2={px(v)} y1={TOP} y2={TOP + AREA} stroke={stroke} strokeWidth={1} />
            {v % labelStep === 0 && v !== 0 && Math.abs(v) !== half && (
              <>
                <text x={LEFT - 6} y={py(v) + 4} textAnchor="end" fontFamily={SERIF} fontSize={13} fill="#5C6356">
                  {label(v)}
                </text>
                <text x={px(v)} y={TOP + AREA + 16} textAnchor="middle" fontFamily={SERIF} fontSize={13} fill="#5C6356">
                  {label(v)}
                </text>
              </>
            )}
          </g>
        )
      })}
      <rect x={LEFT} y={TOP} width={AREA} height={AREA} fill="none" stroke="#9F9580" strokeWidth={1} />
      {/* margin words: which way is long, short, left, right */}
      <text x={LEFT - 6} y={TOP + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill="#5C6356">long</text>
      <text x={LEFT - 6} y={TOP + AREA + 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill="#5C6356">short</text>
      <text x={LEFT} y={H - 4} fontFamily={SANS} fontSize={12} fontStyle="italic" fill="#5C6356">left</text>
      <text x={LEFT + AREA} y={H - 4} textAnchor="end" fontFamily={SANS} fontSize={12} fontStyle="italic" fill="#5C6356">right</text>
      <text x={cx} y={H - 4} textAnchor="middle" fontFamily={SANS} fontSize={12} fill="#8A8B7E">{unit === 'meters' ? 'm' : 'yd'}</text>

      {stats && (
        <>
          <ellipse
            cx={px(stats.avgLateralOffset)}
            cy={py(stats.avgDistanceOffset)}
            rx={stats.cone68.lateral * scale}
            ry={stats.cone68.distance * scale}
            fill="rgba(31,61,44,0.07)"
            stroke="#1F3D2C"
            strokeWidth={1.2}
          />
          <line
            x1={cx}
            y1={cy}
            x2={px(stats.avgLateralOffset)}
            y2={py(stats.avgDistanceOffset)}
            stroke="#1C211C"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        </>
      )}

      {points.map((p) => (
        <circle key={p.id} cx={px(p.lateralOffsetYards)} cy={py(p.distanceOffsetYards)} r={3.6} fill="#1C211C" fillOpacity={0.78} />
      ))}

      {stats && (
        <circle cx={px(stats.avgLateralOffset)} cy={py(stats.avgDistanceOffset)} r={5} fill="#FBF8F1" stroke="#1F3D2C" strokeWidth={1.6} />
      )}

      {/* aim: a small pennant on a staff, foot on the aim point */}
      <g>
        <line x1={cx} y1={cy} x2={cx} y2={cy - 16} stroke="#A66A1F" strokeWidth={1.4} />
        <path d={`M ${cx} ${cy - 16} L ${cx + 10} ${cy - 12.5} L ${cx} ${cy - 9} Z`} fill="#A66A1F" />
        <circle cx={cx} cy={cy} r={2.2} fill="#A66A1F" />
        <text x={cx + 13} y={cy - 9} fontFamily={SERIF} fontStyle="italic" fontSize={14} fill="#A66A1F">aim</text>
      </g>

      {points.length === 0 && empty && (
        <g>
          <rect x={LEFT + 8} y={cy + 22} width={AREA - 16} height={30} fill="#FBF8F1" />
          <text x={cx} y={cy + 42} textAnchor="middle" fontFamily={SANS} fontSize={15} fill="#5C6356">{empty}</text>
        </g>
      )}
    </svg>
  )
}
