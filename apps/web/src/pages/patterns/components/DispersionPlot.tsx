import { useMemo } from 'react'
import type { DispersionPoint, DispersionStats } from '@oga/core'

export const SVG_SIZE = 420

// Pattern point colors. Solid = ink (neutral, the goal); push/pull = warn
// amber; misses = neg brick. Stays inside the editorial palette.
export function pointColor(
  result: string | undefined,
): { fill: string; opacity: number } {
  if (result === 'solid') return { fill: '#1C211C', opacity: 0.75 }
  if (result === 'push_right' || result === 'pull_left')
    return { fill: '#A66A1F', opacity: 0.75 }
  if (result === undefined) return { fill: '#8A8B7E', opacity: 0.5 }
  return { fill: '#A33A2A', opacity: 0.8 }
}

export function DispersionPlot({
  points,
  stats,
  size,
}: {
  points: DispersionPoint[]
  stats: DispersionStats | null
  // Fixed pixel size for the share card (viewport-independent capture).
  // Omitted on the page → SVG fills its parent (page wrapper caps the width).
  size?: number
}) {
  // Spread Math.max over every point ran on every render. Memoize the
  // dispersion-derived geometry; chip-toggle re-renders no longer
  // re-walk the points array.
  const { scale, ticks } = useMemo(() => {
    const max = Math.max(
      ...points.map((p) =>
        Math.max(Math.abs(p.lateralOffsetYards), Math.abs(p.distanceOffsetYards)),
      ),
      stats ? stats.cone95.lateral : 0,
      stats ? stats.cone95.distance : 0,
      20,
    )
    const r = max * 1.15
    const s = (SVG_SIZE / 2) / r
    const step = r > 50 ? 20 : r > 20 ? 10 : 5
    const t: number[] = []
    for (let v = step; v < r; v += step) {
      t.push(v, -v)
    }
    return { scale: s, ticks: t }
  }, [points, stats])

  const cx = SVG_SIZE / 2
  const cy = SVG_SIZE / 2

  const px = (lat: number) => cx + lat * scale
  const py = (dist: number) => cy - dist * scale

  const renderDim = size ?? '100%'

  return (
    <svg
      width={renderDim}
      height={renderDim}
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
        fontFamily="Inconsolata, monospace"
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
        fontFamily="Inconsolata, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        LONG
      </text>
      <text
        x={cx + 8}
        y={SVG_SIZE - 6}
        fontSize={9}
        fontFamily="Inconsolata, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        SHORT
      </text>
      <text
        x={6}
        y={cy - 6}
        fontSize={9}
        fontFamily="Inconsolata, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        L
      </text>
      <text
        x={SVG_SIZE - 14}
        y={cy - 6}
        fontSize={9}
        fontFamily="Inconsolata, monospace"
        letterSpacing="0.14em"
        fill="#8A8B7E"
      >
        R
      </text>
    </svg>
  )
}
